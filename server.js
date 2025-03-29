const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const cors = require('cors');

// Minecraft-Bot-Modul importieren
const minecraftBot = require('./minecraft-bot');

// Server-Startzeit für Uptime-Berechnung
const serverStartTime = Date.now();

// Statistikobjekt für Server-Infos
const serverStats = {
    total_requests: 0,
    logins: 0,
    failed_logins: 0,
    bot_starts: 0,
    errors: 0,
    last_errors: []
};

// Express-App erstellen
const app = express();
const PORT = process.env.PORT || 5000;

// CORS aktivieren
app.use(cors());

// Body-Parser verwenden
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware für Token-Authentifizierung
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    // Öffentliche Routen ohne Authentifizierung zulassen
    const publicRoutes = [
        '/api/users/login',
        '/api/users/register',
        '/api/users/verify',
        '/api/password/forgot',
        '/api/password/reset',
        '/api/password/verify-token'
    ];
    
    // Prüfen, ob dies eine öffentliche Route ist
    const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route));
    if (isPublicRoute) {
        return next();
    }
    
    // Prüfen, ob Authorization Header vorhanden ist
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Authentifizierung erforderlich'
        });
    }
    
    // Token aus Header extrahieren
    const token = authHeader.split(' ')[1];
    
    try {
        // Datenbank lesen
        const db = readDatabase();
        
        // Prüfen, ob der Token in den aktiven Sessions existiert
        if (!db.sessions || !db.sessions[token]) {
            logToFile(`Zugriff mit ungültigem Token auf: ${req.path}`, 'warning');
            return res.status(401).json({
                success: false,
                error: 'Ungültiger oder abgelaufener Token - bitte erneut anmelden'
            });
        }
        
        const session = db.sessions[token];
        
        // Prüfen, ob der Token abgelaufen ist
        const now = new Date();
        const expires = new Date(session.expires);
        
        if (now > expires) {
            // Token ist abgelaufen, Session entfernen
            delete db.sessions[token];
            writeDatabase(db);
            
            logToFile(`Abgelaufener Token für Benutzer: ${session.username}`, 'info');
            return res.status(401).json({
                success: false,
                error: 'Token ist abgelaufen, bitte melde dich erneut an'
            });
        }
        
        // Token ist gültig, Benutzerinformationen zur Anfrage hinzufügen
        req.user = {
            uid: session.userId,
            username: session.username,
            email: session.email
        };
        
        // Optionales Verlängern der Token-Gültigkeit bei jeder Anfrage
        session.expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 Tage
        writeDatabase(db);
        
        // Weiter zur nächsten Middleware
        next();
    } catch (error) {
        console.error('Fehler bei der Token-Authentifizierung:', error);
        res.status(500).json({
            success: false,
            error: 'Serverfehler bei der Authentifizierung'
        });
    }
};

// Statische Dateien aus dem aktuellen Verzeichnis bereitstellen
app.use(express.static('./'));

// Middleware für Authentifizierung anwenden (nach Statischen Dateien)
app.use(requireAuth);

// Datenbank verwenden
const { 
    initializeDatabase, 
    readDatabase, 
    writeDatabase, 
    registerUser, 
    loginUser, 
    sendVerificationEmail,
    getUserData,
    sendPasswordResetEmail,
    updatePassword 
} = require('./database');

// Initialisiere Datenbank, falls sie nicht existiert
initializeDatabase();

// Funktionen für logs
function createLogDirectory() {
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir);
    }
    return logsDir;
}

function logToFile(message, type = 'info') {
    const logsDir = createLogDirectory();
    const now = new Date();
    const logFile = path.join(logsDir, `server_${now.toISOString().replace(/:/g, '-')}.log`);
    const timestamp = now.toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
    
    fs.appendFileSync(logFile, logEntry);
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Routen für Benutzerverwaltung
app.post('/api/users/register', async (req, res) => {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
        return res.status(400).json({
            success: false,
            error: 'E-Mail, Benutzername und Passwort sind erforderlich'
        });
    }
    
    try {
        // Stärkere Validierung
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Das Passwort muss mindestens 8 Zeichen lang sein'
            });
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Bitte gib eine gültige E-Mail-Adresse ein'
            });
        }
        
        // Verbesserte Benutzerregistrierung verwenden
        const result = await registerUser(email, password, username);
        
        if (result.success) {
            // Log erstellen
            logToFile(`Neuer Benutzer registriert: ${username} (${email})`, 'info');
            
            // Erfolgsmeldung senden
            res.json({
                success: true,
                message: 'Registrierung erfolgreich. Du kannst dich jetzt anmelden.'
            });
        } else {
            // Fehler zurückgeben
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Fehler bei der Registrierung:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler bei der Registrierung'
        });
    }
});

app.post('/api/users/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`Login-Anfrage für: ${email}`);

    // Zähle die Gesamtanfragen und Login-Versuche für die Statistik
    serverStats.total_requests++;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'E-Mail und Passwort sind erforderlich'
        });
    }
    
    try {
        // Datenbank lesen
        const db = readDatabase();
        
        // Prüfen, ob der Benutzer existiert
        if (!db.users || !db.users[email]) {
            // Fehlgeschlagenen Login für Statistik zählen
            serverStats.failed_logins++;
            
            logToFile(`Fehlgeschlagener Login: ${email} - Benutzer existiert nicht`, 'warning');
            return res.status(401).json({
                success: false,
                error: "Ungültige E-Mail oder Passwort"
            });
        }
        
        // Benutzer gefunden, jetzt Passwort prüfen
        const user = db.users[email];
        
        // Wenn Benutzer gebannt ist, Zugriff verweigern
        if (user.banned) {
            // Fehlgeschlagenen Login für Statistik zählen
            serverStats.failed_logins++;
            
            logToFile(`Fehlgeschlagener Login: ${email} - Benutzer ist gesperrt`, 'warning');
            return res.status(401).json({
                success: false,
                error: "Dein Konto wurde gesperrt"
            });
        }
        
        // Prüfen, ob der Benutzer verifiziert ist
        if (!user.verified) {
            // Fehlgeschlagenen Login für Statistik zählen
            serverStats.failed_logins++;
            
            logToFile(`Fehlgeschlagener Login: ${email} - Benutzer ist nicht verifiziert`, 'warning');
            return res.status(401).json({
                success: false,
                error: "Bitte bestätige zuerst deine E-Mail-Adresse. Prüfe deinen Posteingang nach einem Bestätigungslink."
            });
        }
        
        // Einfacher Passwortvergleich (klartext)
        if (user.password === password) {
            // Erfolgreichen Login für Statistik zählen
            serverStats.logins++;
            
            // Log erstellen
            logToFile(`Erfolgreicher Login: ${user.username} (${email})`, 'info');
            
            // Session-Token generieren
            const token = uuidv4();
            
            // Session speichern
            db.sessions = db.sessions || {};
            db.sessions[token] = { 
                userId: user.uid, 
                email: email,
                username: user.username,
                created: new Date().toISOString(),
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 Tage
            };
            
            // Letzten Login speichern
            user.last_login = new Date().toISOString();
            user.login_count = (user.login_count || 0) + 1;
            
            writeDatabase(db);
            
            return res.json({ 
                success: true, 
                user: {
                    uid: user.uid,
                    email: user.email,
                    username: user.username,
                    verified: user.verified || false,
                    role: user.role || 'user'
                },
                token: token
            });
        } else {
            // Fehlgeschlagenen Login für Statistik zählen
            serverStats.failed_logins++;
            
            // Falsches Passwort
            logToFile(`Fehlgeschlagener Login: ${email} - Falsches Passwort`, 'warning');
            return res.status(401).json({
                success: false,
                error: "Ungültige E-Mail oder Passwort"
            });
        }
    } catch (error) {
        // Fehler für Statistik zählen
        serverStats.errors++;
        
        // Fehler im Fehlerpuffer speichern
        if (serverStats.last_errors.length >= 10) {
            serverStats.last_errors.shift(); // Ältesten Fehler entfernen
        }
        serverStats.last_errors.push({
            timestamp: new Date().toISOString(),
            error: error.message,
            route: '/api/users/login'
        });
        
        console.error('Fehler beim Login:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Login'
        });
    }
});

// Aktivierung/Bestätigung eines Benutzerkontos
app.get('/api/users/verify/:token', (req, res) => {
    const token = req.params.token;
    const db = readDatabase();
    
    const errorHtml = (errorTitle, errorMessage) => {
        return `
        <html>
            <head>
                <title>${errorTitle}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background-color: #f5f5f5;
                    }
                    .container {
                        text-align: center;
                        background-color: white;
                        padding: 40px;
                        border-radius: 10px;
                        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                        max-width: 500px;
                    }
                    h1 { color: #ff0000; }
                    .button {
                        background-color: #4285f4;
                        color: white;
                        padding: 10px 20px;
                        text-decoration: none;
                        border-radius: 5px;
                        display: inline-block;
                        margin-top: 20px;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>${errorTitle}</h1>
                    <p>${errorMessage}</p>
                    <a href="/" class="button">Zurück zur Hauptseite</a>
                </div>
            </body>
        </html>
        `;
    };

    try {
        // Prüfen, ob der Token existiert und gültig ist
        if (!db.verifications || !db.verifications[token]) {
            logToFile(`Ungültiger Verifizierungsversuch mit Token: ${token}`, 'warning');
            return res.status(400).send(errorHtml('Ungültiger Link', 'Dieser Bestätigungslink ist ungültig oder abgelaufen.'));
        }
        
        const verification = db.verifications[token];
        const now = Date.now();
        
        // Prüfen, ob der Token abgelaufen ist (24 Stunden Gültigkeit)
        if (verification.timestamp + (24 * 60 * 60 * 1000) < now) {
            logToFile(`Abgelaufener Verifizierungstoken für: ${verification.email}`, 'warning');
            
            // Token entfernen
            delete db.verifications[token];
            writeDatabase(db);
            
            return res.status(400).send(errorHtml('Link abgelaufen', 'Dieser Bestätigungslink ist abgelaufen. Bitte fordere einen neuen Link an.'));
        }
        
        // Benutzer finden und aktivieren
        const userEmail = verification.email;
        if (!db.users || !db.users[userEmail]) {
            logToFile(`Benutzer für Verifizierung nicht gefunden: ${userEmail}`, 'error');
            return res.status(400).send(errorHtml('Fehler', 'Der zugehörige Benutzer wurde nicht gefunden.'));
        }
        
        // Benutzer aktivieren
        db.users[userEmail].verified = true;
        db.users[userEmail].login_approved = true;
        db.users[userEmail].verified_at = new Date().toISOString();
        
        // Token entfernen
        delete db.verifications[token];
        
        // Datenbank speichern
        writeDatabase(db);
        
        // Log erstellen
        logToFile(`Benutzer verifiziert: ${db.users[userEmail].username} (${userEmail})`, 'info');
        
        // Erfolgsseite anzeigen
        return res.send(`
            <html>
                <head>
                    <title>Konto aktiviert</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background-color: #f5f5f5;
                        }
                        .container {
                            text-align: center;
                            background-color: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                            max-width: 500px;
                        }
                        h1 { color: #34a853; }
                        .button {
                            background-color: #34a853;
                            color: white;
                            padding: 10px 20px;
                            text-decoration: none;
                            border-radius: 5px;
                            display: inline-block;
                            margin-top: 20px;
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Konto aktiviert</h1>
                        <p>Dein Konto für ${db.users[userEmail].username} wurde erfolgreich aktiviert!</p>
                        <p>Du kannst dich jetzt anmelden und deinen Minecraft-Bot konfigurieren.</p>
                        <a href="/" class="button">Zur Anmeldung</a>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Fehler bei der Kontoaktivierung:', error);
        logToFile(`Fehler bei der Kontoaktivierung: ${error.message}`, 'error');
        return res.status(500).send(errorHtml('Fehler', 'Bei der Bearbeitung deiner Anfrage ist ein Serverfehler aufgetreten.'));
    }
});

// Passwort-Reset API-Routen
app.post('/api/password/forgot', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({
            success: false,
            error: 'E-Mail-Adresse ist erforderlich'
        });
    }
    
    try {
        // Passwort-Reset-E-Mail senden
        const result = await sendPasswordResetEmail(email);
        
        if (result.success) {
            // Log erstellen
            logToFile(`Passwort-Reset angefordert für: ${email}`, 'info');
            
            // Antwort senden
            res.json({
                success: true,
                message: result.message
            });
        } else {
            logToFile(`Fehler bei Passwort-Reset für: ${email} - ${result.error}`, 'warning');
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Fehler beim Senden der Passwort-Reset-E-Mail:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Zurücksetzen des Passworts'
        });
    }
});

app.post('/api/password/reset', async (req, res) => {
    const { token, password } = req.body;
    
    if (!token || !password) {
        return res.status(400).json({
            success: false,
            error: 'Token und neues Passwort sind erforderlich'
        });
    }
    
    try {
        // Token in der Datenbank überprüfen
        const db = readDatabase();
        
        if (!db.password_resets || !db.password_resets[token]) {
            return res.status(400).json({
                success: false,
                error: 'Ungültiger oder abgelaufener Token'
            });
        }
        
        const now = Date.now();
        const resetData = db.password_resets[token];
        
        // Überprüfen, ob der Token abgelaufen ist
        if (resetData.expires < now) {
            delete db.password_resets[token];
            writeDatabase(db);
            
            return res.status(400).json({
                success: false,
                error: 'Dieser Link ist abgelaufen. Bitte fordere einen neuen Link an.'
            });
        }
        
        // Passwort aktualisieren
        const email = resetData.email;
        const updateResult = await updatePassword(email, password);
        
        // Token entfernen
        delete db.password_resets[token];
        writeDatabase(db);
        
        if (updateResult.success) {
            // Log erstellen
            logToFile(`Passwort wurde zurückgesetzt für: ${email}`, 'info');
            
            // Erfolg melden
            res.json({
                success: true,
                message: 'Dein Passwort wurde erfolgreich zurückgesetzt. Du kannst dich jetzt anmelden.'
            });
        } else {
            res.status(400).json({
                success: false,
                error: updateResult.error
            });
        }
    } catch (error) {
        console.error('Fehler beim Zurücksetzen des Passworts:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Zurücksetzen des Passworts'
        });
    }
});

app.get('/api/password/verify-token/:token', (req, res) => {
    const token = req.params.token;
    
    try {
        // Token in der Datenbank überprüfen
        const db = readDatabase();
        
        if (!db.password_resets || !db.password_resets[token]) {
            return res.status(400).json({
                success: false,
                error: 'Ungültiger Token'
            });
        }
        
        const now = Date.now();
        const resetData = db.password_resets[token];
        
        // Überprüfen, ob der Token abgelaufen ist
        if (resetData.expires < now) {
            return res.status(400).json({
                success: false,
                error: 'Abgelaufener Token'
            });
        }
        
        // Token ist gültig
        res.json({
            success: true,
            email: resetData.email
        });
    } catch (error) {
        console.error('Fehler bei der Token-Überprüfung:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler bei der Token-Überprüfung'
        });
    }
});

// Minecraft-Bot-API-Routen
app.post('/api/minecraft/start-bot', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const { username, serverIp, mcVersion, botName } = req.body;
    const userId = req.user.uid;
    
    // Für Statistik zählen
    serverStats.total_requests++;
    serverStats.bot_starts++;

    if (!username || !serverIp) {
        return res.status(400).json({
            success: false,
            error: 'Benutzername und Server-IP sind erforderlich'
        });
    }

    // Validiere Server-IP Format (erweiterte Regex für mehr Domains und optional Port)
    // Flexiblere Prüfung, die auch mehr Formate zulässt
    if (!serverIp || serverIp.trim() === '') {
        return res.status(400).json({
            success: false,
            error: 'Server-IP darf nicht leer sein'
        });
    }

    try {
        // Prüfen, ob der Benutzer bereits einen aktiven Bot hat
        const botStatus = minecraftBot.getBotStatus(username);
        
        if (botStatus && botStatus.active) {
            return res.status(400).json({
                success: false,
                error: 'Du hast bereits einen aktiven Bot. Bitte stoppe zuerst deinen aktuellen Bot, bevor du einen neuen startest.'
            });
        }

        // Benutzereigenschaften in der Datenbank aktualisieren, um den aktiven Bot zu speichern
        const db = readDatabase();
        const email = req.user.email;

        if (db.users && db.users[email]) {
            // Speichert den aktiven Bot-Status in der Benutzerdatenbank
            db.users[email].active_bot = {
                server_ip: serverIp,
                mc_version: mcVersion || '1.21.4',
                bot_name: botName || `${username}_Bot`,
                started_at: new Date().toISOString()
            };
            writeDatabase(db);
        }

        // Konfiguration für den Bot erstellen
        const botConfig = {
            username,
            userId, // userId hinzufügen, um den Bot mit dem Benutzer zu verknüpfen
            serverIp,
            mcVersion: mcVersion || '1.21.4',
            botName: botName || `${username}_Bot`  // Benutzerdefinierten Bot-Namen hinzufügen
        };

        // Notiere Bot-Start in Logs
        console.log(`Bot wird gestartet - Benutzer: ${username}, Server: ${serverIp}`);

        // Bot starten
        const result = await minecraftBot.startBot(botConfig);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                botName: result.botName || `${username}_Bot`
            });
        } else {
            // Wenn der Bot nicht gestartet werden konnte, entferne den aktiven Bot-Status
            if (db.users && db.users[email]) {
                delete db.users[email].active_bot;
                writeDatabase(db);
            }

            res.status(400).json({
                success: false,
                error: result.error || 'Fehler beim Verbinden'
            });
        }
    } catch (error) {
        console.error('Fehler beim Starten des Minecraft-Bots:', error);
        res.status(500).json({
            success: false,
            error: `Fehler beim Starten des Bots: ${error.message}`
        });
    }
});

app.post('/api/minecraft/stop-bot', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const { username } = req.body;
    const email = req.user.email;

    if (!username) {
        return res.status(400).json({
            success: false,
            error: 'Benutzername ist erforderlich'
        });
    }

    try {
        // Bot stoppen
        const result = await minecraftBot.stopBot(username);

        // Bot-Status aus der Datenbank entfernen
        const db = readDatabase();
        if (db.users && db.users[email]) {
            // Aktiven Bot-Status löschen
            delete db.users[email].active_bot;
            writeDatabase(db);
        }

        // Ergebnis zurückgeben
        if (result.success) {
            res.json({
                success: true,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Fehler beim Stoppen des Minecraft-Bots:', error);
        res.status(500).json({
            success: false,
            error: `Fehler beim Stoppen des Bots: ${error.message}`
        });
    }
});

app.post('/api/minecraft/send-command', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const { username, command } = req.body;

    if (!username || !command) {
        return res.status(400).json({
            success: false,
            error: 'Benutzername und Befehl sind erforderlich'
        });
    }

    try {
        // Befehl an Bot senden
        const result = await minecraftBot.sendCommand(username, command);

        // Ergebnis zurückgeben
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                data: result.data
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Fehler beim Senden des Befehls an den Minecraft-Bot:', error);
        res.status(500).json({
            success: false,
            error: `Fehler beim Senden des Befehls: ${error.message}`
        });
    }
});

app.get('/api/minecraft/bot-status', async (req, res) => {
    const username = req.query.username || req.user.username;
    const email = req.user.email;

    try {
        // Datenbank lesen, um aktiven Bot zu überprüfen
        const db = readDatabase();
        
        // Bot-Status aus der Datenbank lesen, falls vorhanden
        let activeBotFromDb = null;
        if (db.users && db.users[email] && db.users[email].active_bot) {
            activeBotFromDb = db.users[email].active_bot;
        }

        // Bot-Status vom Bot-Service abrufen
        const botStatus = minecraftBot.getBotStatus(username);
        
        // Bot-Logs abrufen
        const botLogs = minecraftBot.getBotLogs ? minecraftBot.getBotLogs(username) : [];
        
        // Überprüfen, ob der Bot bei uns als aktiv, aber im Service nicht mehr aktiv ist
        if (activeBotFromDb && (!botStatus || !botStatus.active)) {
            // Bot ist in der Datenbank als aktiv markiert, aber im Service nicht mehr aktiv
            // Entferne den aktiven Bot-Status aus der Datenbank
            delete db.users[email].active_bot;
            writeDatabase(db);
            
            // Melde zurück, dass kein Bot aktiv ist
            return res.json({
                success: true,
                active: false,
                message: 'Kein aktiver Bot gefunden'
            });
        }
        
        // Überprüfen, ob der Bot im Service als aktiv, aber in der Datenbank nicht als aktiv markiert ist
        if (botStatus && botStatus.active && !activeBotFromDb) {
            // Bot ist im Service aktiv, aber nicht in der Datenbank
            // Aktualisiere die Datenbank mit dem aktiven Bot
            if (db.users && db.users[email]) {
                db.users[email].active_bot = {
                    server_ip: botStatus.server || '',
                    mc_version: botStatus.version || '1.21.4',
                    bot_name: botStatus.botName || `${username}_Bot`,
                    started_at: new Date().toISOString()
                };
                writeDatabase(db);
            }
        }
        
        // Bot-Status zurückgeben
        if (botStatus && botStatus.active) {
            return res.json({
                success: true,
                active: true,
                ...botStatus,
                logs: botLogs
            });
        } else {
            // Wenn kein Bot aktiv ist, prüfe, ob in der Datenbank ein aktiver Bot gespeichert ist
            if (activeBotFromDb) {
                // Bot ist in der Datenbank als aktiv markiert, aber nicht im Service
                // Entferne den aktiven Bot-Status aus der Datenbank
                delete db.users[email].active_bot;
                writeDatabase(db);
            }
            
            return res.json({
                success: true,
                active: false,
                message: 'Kein aktiver Bot gefunden'
            });
        }
    } catch (error) {
        console.error('Fehler beim Abrufen des Bot-Status:', error);
        res.status(500).json({
            success: false,
            error: `Fehler beim Abrufen des Bot-Status: ${error.message}`
        });
    }
});

// Admin-API-Routen
app.get('/api/admin/users', async (req, res) => {
    try {
        // Prüfen, ob der Benutzer Admin-Rechte hat
        if (!req.user || req.user.role !== 'admin') {
            logToFile(`Unbefugter Zugriff auf Admin-API: ${req.user ? req.user.username : 'Unbekannt'}`, 'warning');
            return res.status(403).json({
                success: false,
                error: 'Keine Berechtigung für diese Aktion'
            });
        }
        
        // Benutzer aus der Datenbank lesen
        const db = readDatabase();
        
        if (!db.users) {
            return res.json({
                success: true,
                users: []
            });
        }
        
        // Benutzerliste erstellen (ohne Passwörter)
        const usersList = Object.values(db.users).map(user => {
            // Zusätzliche Informationen für bessere Verwaltung
            const hasActiveBot = user.active_bot ? true : false;
            const botDetails = user.active_bot || {};
            const serverIp = botDetails.server_ip || null;
            const botStartTime = botDetails.started_at ? new Date(botDetails.started_at) : null;
            
            // Berechne die Uptime des Bots, falls vorhanden
            let botUptime = null;
            if (botStartTime) {
                const uptime = Math.floor((new Date() - botStartTime) / (1000 * 60)); // in Minuten
                botUptime = uptime;
            }
            
            return {
                uid: user.uid,
                username: user.username,
                email: user.email,
                role: user.role || 'user',
                verified: user.verified || false,
                banned: user.banned || false,
                warnings: user.warnings || 0,
                created_at: user.created_at,
                last_login: user.last_login || null,
                login_count: user.login_count || 0,
                has_active_bot: hasActiveBot,
                bot_info: hasActiveBot ? {
                    server_ip: serverIp,
                    bot_name: botDetails.bot_name || `${user.username}_Bot`,
                    version: botDetails.mc_version || '1.21.4',
                    uptime: botUptime
                } : null
            };
        });
        
        // Ergebnis zurückgeben
        res.json({
            success: true,
            users: usersList
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Benutzerliste:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Abrufen der Benutzerliste'
        });
    }
});

app.post('/api/admin/user/ban', async (req, res) => {
    try {
        // Prüfen, ob der Benutzer Admin-Rechte hat
        if (!req.user || req.user.role !== 'admin') {
            logToFile(`Unbefugter Zugriff auf Admin-API (Ban): ${req.user ? req.user.username : 'Unbekannt'}`, 'warning');
            return res.status(403).json({
                success: false,
                error: 'Keine Berechtigung für diese Aktion'
            });
        }
        
        const { email, reason } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'E-Mail des zu sperrenden Benutzers ist erforderlich'
            });
        }
        
        // Benutzer aus der Datenbank lesen
        const db = readDatabase();
        
        if (!db.users || !db.users[email]) {
            return res.status(404).json({
                success: false,
                error: 'Benutzer nicht gefunden'
            });
        }
        
        // Benutzer sperren
        db.users[email].banned = true;
        db.users[email].ban_reason = reason || 'Gesperrt durch Administrator';
        db.users[email].banned_at = new Date().toISOString();
        db.users[email].banned_by = req.user.username;
        
        // Sessions des Benutzers beenden
        if (db.sessions) {
            for (const token in db.sessions) {
                if (db.sessions[token].email === email) {
                    delete db.sessions[token];
                }
            }
        }
        
        // Datenbank speichern
        writeDatabase(db);
        
        // Log erstellen
        logToFile(`Benutzer gesperrt: ${db.users[email].username} (${email}) durch ${req.user.username}`, 'warning');
        
        // Ergebnis zurückgeben
        res.json({
            success: true,
            message: `Benutzer ${db.users[email].username} wurde gesperrt`
        });
    } catch (error) {
        console.error('Fehler beim Sperren des Benutzers:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Sperren des Benutzers'
        });
    }
});

app.post('/api/admin/user/unban', async (req, res) => {
    try {
        // Prüfen, ob der Benutzer Admin-Rechte hat
        if (!req.user || req.user.role !== 'admin') {
            logToFile(`Unbefugter Zugriff auf Admin-API (Unban): ${req.user ? req.user.username : 'Unbekannt'}`, 'warning');
            return res.status(403).json({
                success: false,
                error: 'Keine Berechtigung für diese Aktion'
            });
        }
        
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'E-Mail des zu entsperrenden Benutzers ist erforderlich'
            });
        }
        
        // Benutzer aus der Datenbank lesen
        const db = readDatabase();
        
        if (!db.users || !db.users[email]) {
            return res.status(404).json({
                success: false,
                error: 'Benutzer nicht gefunden'
            });
        }
        
        // Benutzer entsperren
        db.users[email].banned = false;
        db.users[email].unbanned_at = new Date().toISOString();
        db.users[email].unbanned_by = req.user.username;
        
        // Datenbank speichern
        writeDatabase(db);
        
        // Log erstellen
        logToFile(`Benutzer entsperrt: ${db.users[email].username} (${email}) durch ${req.user.username}`, 'info');
        
        // Ergebnis zurückgeben
        res.json({
            success: true,
            message: `Benutzer ${db.users[email].username} wurde entsperrt`
        });
    } catch (error) {
        console.error('Fehler beim Entsperren des Benutzers:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Entsperren des Benutzers'
        });
    }
});

app.post('/api/admin/user/warn', async (req, res) => {
    try {
        // Prüfen, ob der Benutzer Admin-Rechte hat
        if (!req.user || req.user.role !== 'admin') {
            logToFile(`Unbefugter Zugriff auf Admin-API (Warn): ${req.user ? req.user.username : 'Unbekannt'}`, 'warning');
            return res.status(403).json({
                success: false,
                error: 'Keine Berechtigung für diese Aktion'
            });
        }
        
        const { email, reason } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'E-Mail des zu verwarnenden Benutzers ist erforderlich'
            });
        }
        
        if (!reason) {
            return res.status(400).json({
                success: false,
                error: 'Ein Grund für die Verwarnung ist erforderlich'
            });
        }
        
        // Benutzer aus der Datenbank lesen
        const db = readDatabase();
        
        if (!db.users || !db.users[email]) {
            return res.status(404).json({
                success: false,
                error: 'Benutzer nicht gefunden'
            });
        }
        
        // Benutzer verwarnen
        db.users[email].warnings = (db.users[email].warnings || 0) + 1;
        
        // Warnhistorie hinzufügen
        db.users[email].warning_history = db.users[email].warning_history || [];
        db.users[email].warning_history.push({
            reason: reason,
            timestamp: new Date().toISOString(),
            by: req.user.username
        });
        
        // Automatische Sperre bei zu vielen Verwarnungen (5)
        if (db.users[email].warnings >= 5 && !db.users[email].banned) {
            db.users[email].banned = true;
            db.users[email].ban_reason = 'Automatische Sperre nach 5 Verwarnungen';
            db.users[email].banned_at = new Date().toISOString();
            db.users[email].banned_by = 'System';
            
            // Sessions des Benutzers beenden
            if (db.sessions) {
                for (const token in db.sessions) {
                    if (db.sessions[token].email === email) {
                        delete db.sessions[token];
                    }
                }
            }
            
            logToFile(`Benutzer ${db.users[email].username} automatisch gesperrt nach 5 Verwarnungen`, 'warning');
        }
        
        // Datenbank speichern
        writeDatabase(db);
        
        // Log erstellen
        logToFile(`Benutzer verwarnt: ${db.users[email].username} (${email}) durch ${req.user.username}, Grund: ${reason}`, 'warning');
        
        // Ergebnis zurückgeben
        res.json({
            success: true,
            message: `Benutzer ${db.users[email].username} wurde verwarnt`,
            auto_banned: db.users[email].warnings >= 5
        });
    } catch (error) {
        console.error('Fehler beim Verwarnen des Benutzers:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Verwarnen des Benutzers'
        });
    }
});

// Token validieren
app.post('/api/users/validate-token', (req, res) => {
    const { userId, token } = req.body;
    const authHeader = req.headers.authorization;
    
    // Prüfe, ob Authorization Header vorhanden ist
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Ungültiger Authorization Header'
        });
    }
    
    // Token aus Header extrahieren und mit dem übermittelten Token vergleichen
    const tokenFromHeader = authHeader.split(' ')[1];
    
    if (tokenFromHeader !== token) {
        return res.status(401).json({
            success: false,
            error: 'Token-Werte stimmen nicht überein'
        });
    }
    
    try {
        // Datenbank lesen
        const db = readDatabase();
        
        // Prüfen, ob der Token in den aktiven Sessions existiert
        if (!db.sessions || !db.sessions[token]) {
            logToFile(`Ungültiger Token-Validierungsversuch für Benutzer-ID: ${userId}`, 'warning');
            return res.status(401).json({
                success: false,
                error: 'Token ist ungültig oder abgelaufen'
            });
        }
        
        const session = db.sessions[token];
        
        // Prüfen, ob die Benutzer-ID übereinstimmt
        if (session.userId !== userId) {
            logToFile(`Falsche Benutzer-ID bei Token-Validierung: ${userId} statt ${session.userId}`, 'warning');
            return res.status(401).json({
                success: false,
                error: 'Ungültige Benutzer-ID für diesen Token'
            });
        }
        
        // Prüfen, ob der Token abgelaufen ist
        const now = new Date();
        const expires = new Date(session.expires);
        
        if (now > expires) {
            // Token ist abgelaufen, Session entfernen
            delete db.sessions[token];
            writeDatabase(db);
            
            logToFile(`Abgelaufener Token für Benutzer-ID: ${userId}`, 'info');
            return res.status(401).json({
                success: false,
                error: 'Token ist abgelaufen, bitte melde dich erneut an'
            });
        }
        
        // Token ist gültig
        logToFile(`Erfolgreiche Token-Validierung für Benutzer: ${session.username}`, 'info');
        
        // Optional: Token-Gültigkeit verlängern
        session.expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 Tage
        writeDatabase(db);
        
        // Prüfen, ob der Benutzer einen aktiven Bot hat
        let activeBot = null;
        if (db.users && db.users[session.email] && db.users[session.email].active_bot) {
            activeBot = db.users[session.email].active_bot;
        }

        // Erfolgreiche Validierung zurückgeben
        res.json({
            success: true,
            message: 'Token ist gültig',
            user: {
                uid: session.userId,
                username: session.username,
                email: session.email,
                role: db.users[session.email] ? db.users[session.email].role || 'user' : 'user',
                has_active_bot: !!activeBot
            },
            active_bot: activeBot
        });
    } catch (error) {
        console.error('Fehler bei der Token-Validierung:', error);
        res.status(500).json({
            success: false,
            error: 'Serverfehler bei der Token-Validierung'
        });
    }
});

// Admin-Statistiken-Endpunkt
app.get('/api/admin/stats', async (req, res) => {
    try {
        // Prüfen, ob der Benutzer Admin-Rechte hat
        if (!req.user || req.user.role !== 'admin') {
            logToFile(`Unbefugter Zugriff auf Admin-Statistik-API: ${req.user ? req.user.username : 'Unbekannt'}`, 'warning');
            return res.status(403).json({
                success: false,
                error: 'Keine Berechtigung für diese Aktion'
            });
        }
        
        // Datenbank lesen
        const db = readDatabase();
        
        // Statistiken berechnen
        const stats = {
            users: {
                total: 0,
                verified: 0,
                unverified: 0,
                banned: 0,
                admins: 0,
                with_active_bots: 0
            },
            bots: {
                total_active: 0,
                minecraft_versions: {},
                servers: {}
            },
            logins: {
                today: 0,
                last_24h: 0,
                last_7d: 0
            },
            system: {
                server_start_time: serverStartTime,
                uptime_minutes: Math.floor((Date.now() - serverStartTime) / (1000 * 60)),
                version: '1.5.0', // Version des Servers
                environment: process.env.NODE_ENV || 'development'
            }
        };
        
        // Statistiken zu Benutzern berechnen
        if (db.users) {
            stats.users.total = Object.keys(db.users).length;
            
            Object.values(db.users).forEach(user => {
                if (user.verified) stats.users.verified++;
                else stats.users.unverified++;
                
                if (user.banned) stats.users.banned++;
                if (user.role === 'admin') stats.users.admins++;
                if (user.active_bot) {
                    stats.users.with_active_bots++;
                    stats.bots.total_active++;
                    
                    // Bot-Versionsstatistiken
                    const botVersion = user.active_bot.mc_version || '1.21.4';
                    stats.bots.minecraft_versions[botVersion] = (stats.bots.minecraft_versions[botVersion] || 0) + 1;
                    
                    // Server-Statistiken
                    const serverIp = user.active_bot.server_ip;
                    if (serverIp) {
                        stats.bots.servers[serverIp] = (stats.bots.servers[serverIp] || 0) + 1;
                    }
                }
                
                // Login-Statistiken der letzten 24h/7d
                if (user.last_login) {
                    const lastLogin = new Date(user.last_login);
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
                    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
                    
                    if (lastLogin >= today) {
                        stats.logins.today++;
                    }
                    
                    if (lastLogin >= oneDayAgo) {
                        stats.logins.last_24h++;
                    }
                    
                    if (lastLogin >= sevenDaysAgo) {
                        stats.logins.last_7d++;
                    }
                }
            });
        }
        
        // Ergebnis zurückgeben
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Admin-Statistiken:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Abrufen der Statistiken'
        });
    }
});

// Admin-Bot-Verwaltung-Endpunkt
app.get('/api/admin/bots', async (req, res) => {
    try {
        // Prüfen, ob der Benutzer Admin-Rechte hat
        if (!req.user || req.user.role !== 'admin') {
            logToFile(`Unbefugter Zugriff auf Admin-Bot-API: ${req.user ? req.user.username : 'Unbekannt'}`, 'warning');
            return res.status(403).json({
                success: false,
                error: 'Keine Berechtigung für diese Aktion'
            });
        }
        
        // Datenbank lesen
        const db = readDatabase();
        
        // Liste aktiver Bots erstellen
        const activeBotsArray = [];
        
        if (db.users) {
            Object.entries(db.users).forEach(([email, user]) => {
                if (user.active_bot) {
                    const botStartTime = user.active_bot.started_at ? new Date(user.active_bot.started_at) : null;
                    let botUptime = null;
                    
                    if (botStartTime) {
                        const uptime = Math.floor((new Date() - botStartTime) / (1000 * 60)); // in Minuten
                        botUptime = uptime;
                    }
                    
                    // Bot-Status vom Bot-Service abfragen
                    const botStatus = minecraftBot.getBotStatus(user.username);
                    
                    activeBotsArray.push({
                        bot_name: user.active_bot.bot_name || `${user.username}_Bot`,
                        server_ip: user.active_bot.server_ip,
                        mc_version: user.active_bot.mc_version || '1.21.4',
                        uptime: botUptime,
                        owner: {
                            uid: user.uid,
                            username: user.username,
                            email: email
                        },
                        status: botStatus && botStatus.active ? 'online' : 'offline',
                        details: botStatus || null
                    });
                }
            });
        }
        
        // Ergebnis zurückgeben
        res.json({
            success: true,
            bots: activeBotsArray
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der aktiven Bots:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Abrufen der aktiven Bots'
        });
    }
});

// Admin-Bot-Stopp-Endpunkt
app.post('/api/admin/bot/stop', async (req, res) => {
    try {
        // Prüfen, ob der Benutzer Admin-Rechte hat
        if (!req.user || req.user.role !== 'admin') {
            logToFile(`Unbefugter Zugriff auf Admin-Bot-Stop-API: ${req.user ? req.user.username : 'Unbekannt'}`, 'warning');
            return res.status(403).json({
                success: false,
                error: 'Keine Berechtigung für diese Aktion'
            });
        }
        
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Benutzername ist erforderlich'
            });
        }
        
        // Bot über Bot-Service stoppen
        const stopResult = await minecraftBot.stopBot(username);
        
        if (!stopResult.success) {
            return res.json({
                success: false,
                error: stopResult.error || 'Fehler beim Stoppen des Bots'
            });
        }
        
        // Datenbank lesen und aktualisieren
        const db = readDatabase();
        
        if (db.users) {
            // Finde den Benutzer anhand des Benutzernamens
            let userEmail = null;
            
            for (const [email, user] of Object.entries(db.users)) {
                if (user.username === username) {
                    userEmail = email;
                    break;
                }
            }
            
            if (userEmail && db.users[userEmail]) {
                // Aktiven Bot-Status entfernen
                delete db.users[userEmail].active_bot;
                writeDatabase(db);
                
                logToFile(`Admin ${req.user.username} hat Bot für Benutzer ${username} gestoppt`, 'warning');
            }
        }
        
        // Ergebnis zurückgeben
        res.json({
            success: true,
            message: `Bot für Benutzer ${username} wurde erfolgreich gestoppt`
        });
    } catch (error) {
        console.error('Fehler beim Stoppen des Bots:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Stoppen des Bots'
        });
    }
});

// Admin-Konfiguration-Endpunkt
app.get('/api/admin/config', async (req, res) => {
    try {
        // Prüfen, ob der Benutzer Admin-Rechte hat
        if (!req.user || req.user.role !== 'admin') {
            logToFile(`Unbefugter Zugriff auf Admin-Config-API: ${req.user ? req.user.username : 'Unbekannt'}`, 'warning');
            return res.status(403).json({
                success: false,
                error: 'Keine Berechtigung für diese Aktion'
            });
        }
        
        // Datenbank lesen
        const db = readDatabase();
        
        // Systemkonfiguration abrufen oder erstellen
        if (!db.config) {
            db.config = {
                max_bots_per_user: 1,
                supported_versions: ['1.8', '1.12', '1.16', '1.17', '1.18', '1.19', '1.20', '1.21.4'],
                default_version: '1.21.4',
                auto_ban_after_warnings: 5,
                server_whitelist: [],
                server_blacklist: [],
                verification_required: true,
                max_inactive_days: 90
            };
            writeDatabase(db);
        }
        
        // Ergebnis zurückgeben
        res.json({
            success: true,
            config: db.config
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Konfiguration:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Abrufen der Konfiguration'
        });
    }
});

// Admin-Konfiguration-Update-Endpunkt
app.post('/api/admin/config/update', async (req, res) => {
    try {
        // Prüfen, ob der Benutzer Admin-Rechte hat
        if (!req.user || req.user.role !== 'admin') {
            logToFile(`Unbefugter Zugriff auf Admin-Config-Update-API: ${req.user ? req.user.username : 'Unbekannt'}`, 'warning');
            return res.status(403).json({
                success: false,
                error: 'Keine Berechtigung für diese Aktion'
            });
        }
        
        const { config } = req.body;
        
        if (!config) {
            return res.status(400).json({
                success: false,
                error: 'Keine Konfigurationsdaten erhalten'
            });
        }
        
        // Datenbank lesen
        const db = readDatabase();
        
        // Aktuelle Konfiguration mit neuen Werten aktualisieren
        db.config = { ...(db.config || {}), ...config };
        writeDatabase(db);
        
        logToFile(`Admin ${req.user.username} hat die Systemkonfiguration aktualisiert`, 'info');
        
        // Ergebnis zurückgeben
        res.json({
            success: true,
            message: 'Konfiguration wurde erfolgreich aktualisiert',
            config: db.config
        });
    } catch (error) {
        console.error('Fehler beim Aktualisieren der Konfiguration:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Aktualisieren der Konfiguration'
        });
    }
});

// Admin-Logs-Endpunkt
app.get('/api/admin/logs', async (req, res) => {
    try {
        // Prüfen, ob der Benutzer Admin-Rechte hat
        if (!req.user || req.user.role !== 'admin') {
            logToFile(`Unbefugter Zugriff auf Admin-Logs-API: ${req.user ? req.user.username : 'Unbekannt'}`, 'warning');
            return res.status(403).json({
                success: false,
                error: 'Keine Berechtigung für diese Aktion'
            });
        }
        
        const { type = 'server', limit = 100 } = req.query;
        
        // Logs aus der Logdatei lesen
        const logsDir = path.join(__dirname, 'logs');
        let logEntries = [];
        
        if (fs.existsSync(logsDir)) {
            // Alle Logdateien im Verzeichnis auflisten
            const logFiles = fs.readdirSync(logsDir).filter(file => file.startsWith('server_')).sort().reverse();
            
            // Neueste Logdatei nehmen
            if (logFiles.length > 0) {
                const latestLogFile = logFiles[0];
                try {
                    const logContent = fs.readFileSync(path.join(logsDir, latestLogFile), 'utf8');
                    const logLines = logContent.split('\n').filter(line => line.trim() !== '');
                    
                    // Die letzten X Einträge zurückgeben (neueste zuerst)
                    logEntries = logLines
                        .slice(-limit)
                        .map(line => {
                            // Versuche, Zeitstempel und Logtyp zu extrahieren
                            const parts = line.match(/^\[(.*?)\]\s+\[(.*?)\]:\s+(.*)$/);
                            if (parts) {
                                return {
                                    timestamp: parts[1],
                                    type: parts[2].toLowerCase(),
                                    message: parts[3]
                                };
                            }
                            return { message: line, type: 'unknown', timestamp: null };
                        })
                        .reverse();
                } catch (err) {
                    console.error('Fehler beim Lesen der Logdatei:', err);
                }
            }
        }
        
        // Ergebnis zurückgeben
        res.json({
            success: true,
            logs: logEntries
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Server-Logs:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Abrufen der Server-Logs'
        });
    }
});

// Admin-Benutzer-Details-Endpunkt
app.get('/api/admin/user/:userId', async (req, res) => {
    try {
        // Prüfen, ob der Benutzer Admin-Rechte hat
        if (!req.user || req.user.role !== 'admin') {
            logToFile(`Unbefugter Zugriff auf Admin-User-Details-API: ${req.user ? req.user.username : 'Unbekannt'}`, 'warning');
            return res.status(403).json({
                success: false,
                error: 'Keine Berechtigung für diese Aktion'
            });
        }
        
        const userId = req.params.userId;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Benutzer-ID ist erforderlich'
            });
        }
        
        // Datenbank lesen
        const db = readDatabase();
        
        if (!db.users) {
            return res.status(404).json({
                success: false,
                error: 'Keine Benutzer gefunden'
            });
        }
        
        // Benutzer anhand der ID finden
        let userDetails = null;
        let userEmail = null;
        
        for (const [email, user] of Object.entries(db.users)) {
            if (user.uid === userId) {
                // Passwort aus der Antwort entfernen
                const { password, ...userWithoutPassword } = user;
                userDetails = userWithoutPassword;
                userEmail = email;
                break;
            }
        }
        
        if (!userDetails) {
            return res.status(404).json({
                success: false,
                error: 'Benutzer nicht gefunden'
            });
        }
        
        // Aktive Sessions des Benutzers abrufen
        const activeSessions = [];
        
        if (db.sessions) {
            for (const [token, session] of Object.entries(db.sessions)) {
                if (session.email === userEmail) {
                    activeSessions.push({
                        created: session.created,
                        expires: session.expires,
                        last_active: session.last_active || session.created
                    });
                }
            }
        }
        
        // Ergebnis zurückgeben
        res.json({
            success: true,
            user: userDetails,
            active_sessions: activeSessions
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Benutzerdetails:', error);
        res.status(500).json({
            success: false,
            error: 'Interner Serverfehler beim Abrufen der Benutzerdetails'
        });
    }
});

// Dotenv-Konfiguration laden
dotenv.config();

// Verbesserte Fehlerbehandlung
app.use((err, req, res, next) => {
    // Ausführliche Fehlerprotokollierung im Server-Log
    console.error('Serverfehler aufgetreten:');
    console.error(`Zeitpunkt: ${new Date().toISOString()}`);
    console.error(`Anfrage-Pfad: ${req.method} ${req.path}`);
    console.error(`Benutzer: ${req.body && req.body.username ? req.body.username : 'Unbekannt'}`);
    console.error(`Fehlermeldung: ${err.message}`);
    console.error(`Fehler-Stack: ${err.stack}`);
    
    // Benutzerfreundliche Fehlernachricht an Client senden
    let userMessage = 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.';
    
    // Spezifische Fehlertypen identifizieren
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        userMessage = 'Verbindungsproblem mit dem Minecraft-Server. Bitte überprüfe die Server-Adresse und versuche es erneut.';
    } else if (err.message && err.message.includes('timeout')) {
        userMessage = 'Die Anfrage hat zu lange gedauert. Bitte überprüfe deine Internetverbindung und versuche es erneut.';
    } else if (err.message && err.message.includes('authentication')) {
        userMessage = 'Authentifizierungsfehler. Der Server erlaubt möglicherweise keine Nicht-Premium-Accounts.';
    }
    
    // Eindeutige Fehler-ID für Nachverfolgung
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    // Fehlerdetails in Logdatei schreiben
    const logsDir = path.join(__dirname, 'logs');
    if (fs.existsSync(logsDir)) {
        const errorLog = `
Fehler-ID: ${errorId}
Zeit: ${new Date().toISOString()}
Benutzer: ${req.body && req.body.username ? req.body.username : 'Unbekannt'}
Anfrage: ${req.method} ${req.path}
Fehler: ${err.message}
Stack: ${err.stack}
--------------------------------------
`;
        fs.appendFile(path.join(logsDir, 'error.log'), errorLog, (appendErr) => {
            if (appendErr) console.error('Fehler beim Schreiben des Fehlerprotokolls:', appendErr);
        });
    }
    
    // HTTP-Status beibehalten, aber bessere Antwort senden
    res.status(500).json({
        success: false,
        error: userMessage,
        errorId: errorId
    });
});

// Überprüfen, ob Benutzer Admin-Rechte hat
const requireAdmin = (req, res, next) => {
    try {
        const db = readDatabase();
        const userEmail = req.user.email;
        
        if (!db.users || !db.users[userEmail]) {
            return res.status(401).json({
                success: false,
                error: 'Benutzer nicht gefunden'
            });
        }
        
        const user = db.users[userEmail];
        
        if (user.role !== 'admin') {
            logToFile(`Unerlaubter Admin-Zugriff von: ${userEmail}`, 'warning');
            return res.status(403).json({
                success: false,
                error: 'Zugriff verweigert. Admin-Rechte erforderlich.'
            });
        }
        
        next();
    } catch (error) {
        console.error('Fehler bei der Admin-Berechtigungsprüfung:', error);
        res.status(500).json({
            success: false,
            error: 'Serverfehler bei der Berechtigungsprüfung'
        });
    }
};

// Admin-Routen
// Benutzerliste abrufen
app.get('/api/admin/users', requireAdmin, (req, res) => {
    try {
        const db = readDatabase();
        
        if (!db.users) {
            return res.json({ success: true, users: [] });
        }
        
        // Benutzerliste erstellen
        const users = Object.keys(db.users).map(email => {
            const user = db.users[email];
            return {
                uid: user.uid,
                username: user.username,
                email: email,
                verified: user.verified || false,
                banned: user.banned || false,
                warnings: user.warnings || 0,
                role: user.role || 'user',
                created: user.created,
                last_login: user.last_login || null
            };
        });
        
        res.json({ success: true, users });
    } catch (error) {
        console.error('Fehler beim Abrufen der Benutzerliste:', error);
        res.status(500).json({
            success: false,
            error: 'Fehler beim Abrufen der Benutzerliste'
        });
    }
});

// Benutzer sperren
app.post('/api/admin/user/ban', requireAdmin, (req, res) => {
    const { email, reason } = req.body;
    const adminEmail = req.user.email;
    
    if (!email || !reason) {
        return res.status(400).json({
            success: false,
            error: 'E-Mail und Grund sind erforderlich'
        });
    }
    
    try {
        const db = readDatabase();
        
        if (!db.users || !db.users[email]) {
            return res.status(404).json({
                success: false,
                error: 'Benutzer nicht gefunden'
            });
        }
        
        // Admin kann sich nicht selbst sperren
        if (email === adminEmail) {
            return res.status(400).json({
                success: false,
                error: 'Du kannst dich nicht selbst sperren'
            });
        }
        
        // Benutzer sperren
        db.users[email].banned = true;
        db.users[email].banned_at = new Date().toISOString();
        db.users[email].banned_by = adminEmail;
        db.users[email].ban_reason = reason;
        
        // Aktive Sessions des gesperrten Benutzers löschen
        if (db.sessions) {
            Object.keys(db.sessions).forEach(token => {
                if (db.sessions[token].email === email) {
                    delete db.sessions[token];
                }
            });
        }
        
        writeDatabase(db);
        
        logToFile(`Benutzer gesperrt: ${email} durch ${adminEmail}. Grund: ${reason}`, 'warning');
        
        res.json({ success: true });
    } catch (error) {
        console.error('Fehler beim Sperren des Benutzers:', error);
        res.status(500).json({
            success: false,
            error: 'Fehler beim Sperren des Benutzers'
        });
    }
});

// Benutzer entsperren
app.post('/api/admin/user/unban', requireAdmin, (req, res) => {
    const { email } = req.body;
    const adminEmail = req.user.email;
    
    if (!email) {
        return res.status(400).json({
            success: false,
            error: 'E-Mail ist erforderlich'
        });
    }
    
    try {
        const db = readDatabase();
        
        if (!db.users || !db.users[email]) {
            return res.status(404).json({
                success: false,
                error: 'Benutzer nicht gefunden'
            });
        }
        
        // Benutzer entsperren
        db.users[email].banned = false;
        db.users[email].unbanned_at = new Date().toISOString();
        db.users[email].unbanned_by = adminEmail;
        
        writeDatabase(db);
        
        logToFile(`Benutzer entsperrt: ${email} durch ${adminEmail}`, 'info');
        
        res.json({ success: true });
    } catch (error) {
        console.error('Fehler beim Entsperren des Benutzers:', error);
        res.status(500).json({
            success: false,
            error: 'Fehler beim Entsperren des Benutzers'
        });
    }
});

// Benutzer verwarnen
app.post('/api/admin/user/warn', requireAdmin, (req, res) => {
    const { email, reason } = req.body;
    const adminEmail = req.user.email;
    
    if (!email || !reason) {
        return res.status(400).json({
            success: false,
            error: 'E-Mail und Grund sind erforderlich'
        });
    }
    
    try {
        const db = readDatabase();
        
        if (!db.users || !db.users[email]) {
            return res.status(404).json({
                success: false,
                error: 'Benutzer nicht gefunden'
            });
        }
        
        // Admin kann sich nicht selbst verwarnen
        if (email === adminEmail) {
            return res.status(400).json({
                success: false,
                error: 'Du kannst dich nicht selbst verwarnen'
            });
        }
        
        // Warnungen initialisieren, falls nicht vorhanden
        db.users[email].warnings = db.users[email].warnings || 0;
        db.users[email].warnings++;
        
        // Warnungshistorie speichern
        db.users[email].warning_history = db.users[email].warning_history || [];
        db.users[email].warning_history.push({
            timestamp: new Date().toISOString(),
            reason: reason,
            by: adminEmail
        });
        
        let auto_banned = false;
        
        // Automatische Sperrung nach 5 Verwarnungen
        if (db.users[email].warnings >= 5 && !db.users[email].banned) {
            db.users[email].banned = true;
            db.users[email].banned_at = new Date().toISOString();
            db.users[email].banned_by = 'system';
            db.users[email].ban_reason = 'Automatische Sperrung nach 5 Verwarnungen';
            
            // Aktive Sessions des gesperrten Benutzers löschen
            if (db.sessions) {
                Object.keys(db.sessions).forEach(token => {
                    if (db.sessions[token].email === email) {
                        delete db.sessions[token];
                    }
                });
            }
            
            auto_banned = true;
            logToFile(`Benutzer automatisch gesperrt: ${email} (5 Verwarnungen)`, 'warning');
        }
        
        writeDatabase(db);
        
        logToFile(`Benutzer verwarnt: ${email} durch ${adminEmail}. Grund: ${reason}`, 'warning');
        
        res.json({ 
            success: true,
            warnings_count: db.users[email].warnings,
            auto_banned
        });
    } catch (error) {
        console.error('Fehler beim Verwarnen des Benutzers:', error);
        res.status(500).json({
            success: false,
            error: 'Fehler beim Verwarnen des Benutzers'
        });
    }
});

// Server starten 
const host = '0.0.0.0';
app.listen(PORT, host, (err) => {
    if (err) {
        console.error('Fehler beim Starten des Servers:', err);
        process.exit(1);
    }
    const startupTime = new Date().toISOString();
    console.log(`Herobrine AFK Bot Server gestartet auf http://${host}:${PORT} (${startupTime})`);
    console.log(`Betriebsmodus: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Minecraft-Bot-Version: ${process.env.DEFAULT_BOT_VERSION || '1.21.4'}`);

    // Logs-Verzeichnis erstellen
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // Server-Log erstellen
    const logFileName = `server_${startupTime.replace(/:/g, '-').replace(/\./g, '-')}.log`;
    fs.writeFileSync(
        path.join(logsDir, logFileName),
        `Herobrine AFK Bot Server gestartet\nZeit: ${startupTime}\nPort: ${PORT}\n`,
        'utf8'
    );

    // Admin-Benutzer anlegen/aktualisieren (falls nicht vorhanden)
    const db = readDatabase();

    if (!db.users) {
        db.users = {};
    }

    // Admin-Konto für Testzwecke
    if (!db.users['admin@herobrine.de']) {
        bcrypt.hash('admin123', 10, (err, hash) => {
            if (err) {
                console.error('Fehler beim Hashen des Admin-Passworts:', err);
                return;
            }
            
            db.users['admin@herobrine.de'] = {
                uid: 'admin-1',
                email: 'admin@herobrine.de',
                username: 'Admin',
                password: hash,
                verified: true,
                created: new Date().toISOString(),
                login_approved: true,
                role: 'admin'
            };
            
            writeDatabase(db);
            console.log('Admin-Konto wurde erstellt oder aktualisiert');
        });
    }
});
