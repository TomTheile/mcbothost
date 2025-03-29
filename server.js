const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');


// Minecraft-Bot-Modul importieren (Annahme: minecraftBot.js existiert)
const minecraftBot = require('./minecraftBot'); // Anpassen, falls der Pfad anders ist

// Express-App erstellen
const app = express();
const PORT = process.env.PORT || 3000;

// Body-Parser verwenden
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Datenbank lesen und schreiben (Annahme: database.js existiert)
const { readDatabase, writeDatabase } = require('./database'); // Anpassen, falls der Pfad anders ist


// Routen für Benutzerverwaltung

app.post('/api/users/register', async (req, res) => {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
        return res.status(400).json({
            success: false,
            error: 'E-Mail, Benutzername und Passwort sind erforderlich'
        });
    }

    const db = readDatabase();

    if (db.users && db.users[email]) {
        return res.status(400).json({
            success: false,
            error: 'E-Mail bereits registriert'
        });
    }

    const hashedPassword = await bcrypt.hash(password, 10);


    if (!db.users) {
        db.users = {};
    }

    db.users[email] = {
        uid: uuidv4(),
        email,
        username,
        password: hashedPassword,
        verified: false,
        created: new Date().toISOString()
    };

    writeDatabase(db);

    // Hier könnte man eine E-Mail zur Bestätigung senden


    res.json({
        success: true,
        message: 'Registrierung erfolgreich. Bitte überprüfe deine E-Mails zur Bestätigung.'
    });
});


app.post('/api/users/login', (req, res) => {
    console.log("Login-Anfrage erhalten:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'E-Mail und Passwort sind erforderlich'
        });
    }

    const db = readDatabase();

    if (!db.users || !db.users[email]) {
        return res.status(400).json({
            success: false,
            error: 'Benutzer nicht gefunden'
        });
    }

    bcrypt.compare(password, db.users[email].password, (err, result) => {
        if (err) {
            console.error("Fehler beim Passwortvergleich:", err);
            return res.status(500).json({ success: false, error: 'Interner Serverfehler' });
        }

        if (result) {
            //Login erfolgreich, Token generieren und senden
            const token = uuidv4();
            db.pending_logins = db.pending_logins || {};
            db.pending_logins[token] = { email, timestamp: Date.now() };
            writeDatabase(db);
            res.json({ success: true, token });

        } else {
            res.status(401).json({ success: false, error: 'Falsches Passwort' });
        }
    });
});

app.get('/api/users/verify/:token', (req, res) => {
    const token = req.params.token;
    const db = readDatabase();

    if (!db.pending_logins || !db.pending_logins[token]) {
        return res.status(400).send(`
            <html>
                <head>
                    <title>Fehler</title>
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
                            background-color: #ff0000;
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
                        <h1>Fehler</h1>
                        <p>Ungültiger oder abgelaufener Bestätigungslink.</p>
                        <a href="/" class="button">Zurück zur Hauptseite</a>
                    </div>
                </body>
            </html>
        `);
    }

    const userEmail = db.pending_logins[token].email;
    if (!db.users || !db.users[userEmail]) {
        return res.status(400).send(`
            <html>
                <head>
                    <title>Fehler</title>
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
                            background-color: #ff0000;
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
                        <h1>Fehler</h1>
                        <p>Der Benutzer wurde nicht gefunden.</p>
                        <a href="/" class="button">Zurück zur Hauptseite</a>
                    </div>
                </body>
            </html>
        `);
    }

    // Benutzer als bestätigt markieren
    db.users[userEmail].login_approved = true;

    // Token entfernen
    delete db.pending_logins[token];

    // Datenbank schreiben
    writeDatabase(db);

    // Erfolgsseite anzeigen
    return res.send(`
        <html>
            <head>
                <title>Login bestätigt</title>
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
                    h1 { color: #1eff00; }
                    .button {
                        background-color: #1eff00;
                        color: black;
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
                    <h1>Login bestätigt</h1>
                    <p>Der Admin-Login für ${db.users[userEmail].username} wurde erfolgreich bestätigt.</p>
                    <p>Der Benutzer kann sich jetzt anmelden.</p>
                    <a href="/" class="button">Zurück zur Hauptseite</a>
                </div>
            </body>
        </html>
    `);
});

// Minecraft-Bot-API-Routen
app.post('/api/minecraft/start-bot', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const { username, serverIp, serverPort, mcVersion } = req.body;

    if (!username || !serverIp) {
        return res.status(400).json({
            success: false,
            error: 'Benutzername und Server-IP sind erforderlich'
        });
    }

    // Validiere Server-IP Format (erweiterte Regex für mehr Domains)
    const ipRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]$/;
    if (!ipRegex.test(serverIp) && serverIp !== 'localhost') {
        return res.status(400).json({
            success: false,
            error: 'Ungültige Server-IP'
        });
    }

    // Validiere Port
    const port = parseInt(serverPort) || 25565;
    if (port < 1 || port > 65535) {
        return res.status(400).json({
            success: false,
            error: 'Ungültiger Port (muss zwischen 1 und 65535 liegen)'
        });
    }

    try {
        // Konfiguration für den Bot erstellen
        const botConfig = {
            username,
            serverIp,
            serverPort: serverPort || '25565',
            mcVersion: mcVersion || '1.21.4'
        };

        // Notiere Bot-Start in Logs
        console.log(`Bot wird gestartet - Benutzer: ${username}, Server: ${serverIp}:${serverPort}`);

        // Bot starten
        minecraftBot.startBot(botConfig)
        .then(result => {
            if (result.success) {
                res.json({
                    success: true,
                    message: result.message,
                    botName: `${username}_Bot`
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error || 'Fehler beim Verbinden'
                });
            }
        })
        .catch(error => {
            res.status(500).json({
                success: false,
                error: `Verbindungsfehler: ${error.message}`
            });
        });
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

    if (!username) {
        return res.status(400).json({
            success: false,
            error: 'Benutzername ist erforderlich'
        });
    }

    try {
        // Bot stoppen
        const result = await minecraftBot.stopBot(username);

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

app.get('/api/minecraft/bot-status', (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({
            success: false,
            error: 'Benutzername ist erforderlich'
        });
    }

    try {
        // Bot-Status abrufen
        const result = minecraftBot.getBotStatus(username);

        // Ergebnis zurückgeben
        if (result.success) {
            res.json({
                success: true,
                ...result
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
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

// Server starten
// Dotenv-Konfiguration laden
dotenv.config();

// Server starten 
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
app.listen(PORT, host, (err) => {
    if (err) {
        console.error('Fehler beim Starten des Servers:', err);
        process.exit(1);
    }
    const startupTime = new Date().toISOString();
    console.log(`Herobrine AFK Bot Server gestartet auf http://0.0.0.0:${PORT} (${startupTime})`);
    console.log(`Betriebsmodus: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Minecraft-Bot-Version: ${process.env.DEFAULT_BOT_VERSION || '1.21.4'}`);
    console.log('GitHub Integration aktiviert');

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

    // Admin-Konto
    if (!db.users['admin@herobrine.de']) {
        db.users['admin@herobrine.de'] = {
            uid: 'admin-1',
            email: 'admin@herobrine.de',
            username: 'Admin',
            password: 'admin123',
            verified: true,
            role: 'admin',
            created: new Date().toISOString()
        };

        // Demo-Benutzer hinzufügen
        if (!db.users['demo@example.com']) {
            db.users['demo@example.com'] = {
                uid: 'user-demo',
                email: 'demo@example.com',
                username: 'DemoUser',
                password: 'demo123',
                verified: true,
                created: new Date().toISOString()
            };

            console.log("Registrierung für: demo@example.com, Benutzername: DemoUser");
        }

        // Zusätzlichen Benutzer hinzufügen
        if (!db.users['TurboKid@outlook.de']) {
            db.users['TurboKid@outlook.de'] = {
                uid: 'user-turbokid',
                email: 'TurboKid@outlook.de',
                username: 'TurboKid',
                password: 'turbo123',
                verified: true,
                created: new Date().toISOString()
            };

            console.log("Registrierung für: TurboKid@outlook.de, Benutzername: TurboKid");
        }

        writeDatabase(db);
        console.log("Einfache Datenbank initialisiert");
    }
});
