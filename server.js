const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const minecraftBot = require('./minecraft-bot');

const app = express();
const PORT = process.env.PORT || 5000;

// Datenbank-Funktionen
function readDatabase() {
    try {
        const data = fs.readFileSync('database.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Fehler beim Lesen der Datenbank:', error);
        return { users: {} };
    }
}

function writeDatabase(data) {
    try {
        fs.writeFileSync('database.json', JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Fehler beim Schreiben in die Datenbank:', error);
        return false;
    }
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('./'));

// E-Mail-Konfiguration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'verify.mcbot@gmail.com',
        pass: 'kzsa fgle tnjx cnaz'
    },
    // Zusätzliche Optionen für bessere Fehlerbehandlung
    tls: {
        rejectUnauthorized: false
    }
});

// Route für den E-Mail-Versand
app.post('/send-verification-email', async (req, res) => {
    const { userId, email, username } = req.body;
    
    if (!email) {
        console.error('E-Mail-Adresse fehlt in der Anfrage:', req.body);
        return res.status(400).json({ success: false, error: 'E-Mail-Adresse ist erforderlich' });
    }
    
    console.log(`Versende Verifikations-E-Mail an: ${email}, Benutzer: ${username || userId}`);
    
    try {
        // Generiere einen einzigartigen Token (in einer echten App würde dieser in einer Datenbank gespeichert)
        const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const currentDomain = req.headers.host || 'localhost:5000';
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        
        // Verifizierungslink erstellen mit dem aktuellen Host
        const verificationLink = `${protocol}://${currentDomain}/verify.html?token=${verificationToken}&user=${encodeURIComponent(userId || username)}&email=${encodeURIComponent(email)}`;
        
        // E-Mail-Optionen
        const mailOptions = {
            from: 'verify.mcbot@gmail.com',
            to: email,
            subject: 'Bestätige deine Registrierung für den Herobrine AFK Bot',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #1eff00; border-radius: 10px;">
                    <h2 style="color: #1eff00; text-align: center;">Willkommen beim Herobrine AFK Bot!</h2>
                    <p>Hallo ${username || 'Benutzer'},</p>
                    <p>Vielen Dank für deine Registrierung beim Herobrine AFK Bot. Um deinen Account zu aktivieren, klicke bitte auf den Button unten:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationLink}" style="background-color: #1eff00; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">E-Mail bestätigen</a>
                    </div>
                    <p>Oder kopiere diesen Link in deinen Browser:</p>
                    <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 5px;">${verificationLink}</p>
                    <p>Dieser Link ist aus Sicherheitsgründen 24 Stunden gültig.</p>
                    <p>Wenn du dich nicht für den Herobrine AFK Bot registriert hast, kannst du diese E-Mail ignorieren.</p>
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
                        <p>© Herobrine AFK Bot - The advanced Minecraft bot service</p>
                    </div>
                </div>
            `
        };
        
        // E-Mail senden
        console.log('Versuche, E-Mail zu senden...');
        const info = await transporter.sendMail(mailOptions);
        console.log('E-Mail gesendet:', info.response);
        
        // Erfolgreiche Antwort senden
        res.json({ 
            success: true, 
            message: 'Verifizierungs-E-Mail gesendet',
            debug: {
                messageId: info.messageId,
                verificationLink: verificationLink
            }
        });
    } catch (error) {
        console.error('Fehler beim Senden der E-Mail:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Fehler beim Senden der E-Mail',
            details: error.message 
        });
    }
});

// Neue Route, um den E-Mail-Versand zu testen
app.get('/test-email', (req, res) => {
    res.send(`
        <h1>E-Mail-Test</h1>
        <form id="testForm" style="margin: 20px; padding: 20px; border: 1px solid #ccc;">
            <div style="margin-bottom: 10px;">
                <label for="email">E-Mail-Adresse:</label>
                <input type="email" id="email" name="email" required style="width: 100%; padding: 8px;">
            </div>
            <div style="margin-bottom: 10px;">
                <label for="username">Benutzername:</label>
                <input type="text" id="username" name="username" required style="width: 100%; padding: 8px;">
            </div>
            <button type="submit" style="padding: 10px 20px; background-color: #1eff00; color: black; border: none; cursor: pointer;">Test-E-Mail senden</button>
            <div id="result" style="margin-top: 20px;"></div>
        </form>
        <script>
            document.getElementById('testForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const username = document.getElementById('username').value;
                const resultDiv = document.getElementById('result');
                
                resultDiv.innerHTML = 'Sende E-Mail...';
                
                try {
                    const response = await fetch('/send-verification-email', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            email,
                            username,
                            userId: 'test-' + Date.now()
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        resultDiv.innerHTML = '<div style="color: green;">E-Mail erfolgreich gesendet!</div>' + 
                                            '<pre style="background: #f0f0f0; padding: 10px; margin-top: 10px;">' + 
                                            JSON.stringify(data, null, 2) + '</pre>';
                    } else {
                        resultDiv.innerHTML = '<div style="color: red;">Fehler: ' + (data.error || 'Unbekannter Fehler') + '</div>' +
                                            '<pre style="background: #f0f0f0; padding: 10px; margin-top: 10px;">' + 
                                            JSON.stringify(data, null, 2) + '</pre>';
                    }
                } catch (error) {
                    resultDiv.innerHTML = '<div style="color: red;">Fehler bei der Anfrage: ' + error.message + '</div>';
                }
            });
        </script>
    `);
});

// Route für das Zurücksetzen des Passworts
app.post('/reset-password', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ success: false, error: 'E-Mail-Adresse ist erforderlich' });
    }
    
    console.log(`Passwort-Zurücksetzung angefordert für: ${email}`);
    
    try {
        // Generiere einen einzigartigen Token (in einer echten App würde dieser in einer Datenbank gespeichert)
        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const currentDomain = req.headers.host || 'localhost:5000';
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        
        // Link zum Zurücksetzen des Passworts
        const resetLink = `${protocol}://${currentDomain}/reset-password.html?token=${resetToken}&email=${encodeURIComponent(email)}`;
        
        // E-Mail-Optionen
        const mailOptions = {
            from: 'verify.mcbot@gmail.com',
            to: email,
            subject: 'Passwort zurücksetzen für Herobrine AFK Bot',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #1eff00; border-radius: 10px;">
                    <h2 style="color: #1eff00; text-align: center;">Passwort zurücksetzen</h2>
                    <p>Hallo,</p>
                    <p>Du hast eine Anfrage zum Zurücksetzen deines Passworts für den Herobrine AFK Bot gestellt. Klicke auf den Button unten, um ein neues Passwort zu erstellen:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #1eff00; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Passwort zurücksetzen</a>
                    </div>
                    <p>Oder kopiere diesen Link in deinen Browser:</p>
                    <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 5px;">${resetLink}</p>
                    <p>Dieser Link ist aus Sicherheitsgründen nur 1 Stunde gültig.</p>
                    <p>Wenn du keine Zurücksetzung deines Passworts angefordert hast, kannst du diese E-Mail ignorieren.</p>
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
                        <p>© Herobrine AFK Bot - The advanced Minecraft bot service</p>
                    </div>
                </div>
            `
        };
        
        // E-Mail senden
        console.log('Versuche, Passwort-Zurücksetzungs-E-Mail zu senden...');
        const info = await transporter.sendMail(mailOptions);
        console.log('Passwort-Zurücksetzungs-E-Mail gesendet:', info.response);
        
        // Erfolgreiche Antwort senden
        res.json({ 
            success: true, 
            message: 'Passwort-Zurücksetzungs-E-Mail gesendet'
        });
    } catch (error) {
        console.error('Fehler beim Senden der Passwort-Zurücksetzungs-E-Mail:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Fehler beim Senden der E-Mail zum Zurücksetzen des Passworts',
            details: error.message 
        });
    }
});

// API-Routen für Benutzer-Management
app.post('/api/users/register', (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ 
            success: false, 
            error: 'Alle Felder sind erforderlich' 
        });
    }
    
    // Datenbank lesen
    const db = readDatabase();
    
    // Prüfen, ob Benutzer bereits existiert
    if (db.users[email]) {
        return res.status(400).json({ 
            success: false, 
            error: 'Diese E-Mail-Adresse wird bereits verwendet' 
        });
    }
    
    // Neuen Benutzer anlegen
    const userId = 'user-' + Math.random().toString(36).substring(2, 11);
    
    db.users[email] = {
        uid: userId,
        email: email,
        username: username,
        password: password, // In einer echten App würde hier ein Passwort-Hash gespeichert
        verified: false,
        created: new Date().toISOString()
    };
    
    // Datenbank schreiben
    if (writeDatabase(db)) {
        return res.json({ 
            success: true, 
            user: {
                uid: userId,
                email: email,
                username: username
            }
        });
    } else {
        return res.status(500).json({ 
            success: false, 
            error: 'Fehler beim Speichern der Daten' 
        });
    }
});

app.post('/api/users/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            error: 'E-Mail und Passwort sind erforderlich' 
        });
    }
    
    // Datenbank lesen
    const db = readDatabase();
    
    // Benutzer suchen
    const user = db.users[email];
    
    // Benutzer nicht gefunden oder Passwort falsch
    if (!user) {
        return res.status(401).json({ 
            success: false, 
            error: 'Kein Konto mit dieser E-Mail-Adresse gefunden' 
        });
    }
    
    if (user.password !== password) {
        return res.status(401).json({ 
            success: false, 
            error: 'Falsches Passwort' 
        });
    }
    
    // Für Admin-Konten: Login-Bestätigung erforderlich
    if (user.role === 'admin' && !user.login_approved) {
        // Generiere einen einzigartigen Token für diese Anmeldesitzung
        const loginToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        // Token in DB speichern (temporär)
        if (!db.pending_logins) {
            db.pending_logins = {};
        }
        
        const expiryTime = new Date();
        expiryTime.setMinutes(expiryTime.getMinutes() + 30); // 30 Minuten gültig
        
        db.pending_logins[loginToken] = {
            user_email: email,
            created: new Date().toISOString(),
            expires: expiryTime.toISOString()
        };
        
        writeDatabase(db);
        
        // E-Mail mit Bestätigungslink senden
        try {
            // URL basierend auf Host und Protocol bestimmen
            const currentDomain = req.headers.host || 'localhost:5000';
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            const baseUrl = `${protocol}://${currentDomain}`;
            
            // E-Mail-Optionen
            const mailOptions = {
                from: 'verify.mcbot@gmail.com',
                to: 'tom-theile@outlook.de',
                subject: `Admin-Login bestätigen: ${user.username}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #1eff00; border-radius: 10px;">
                        <h2 style="color: #1eff00; text-align: center;">Admin-Login Bestätigung erforderlich</h2>
                        <p>Ein Benutzer versucht, sich als Administrator anzumelden:</p>
                        <ul>
                            <li><strong>Benutzername:</strong> ${user.username}</li>
                            <li><strong>E-Mail:</strong> ${user.email}</li>
                            <li><strong>Datum/Uhrzeit:</strong> ${new Date().toLocaleString()}</li>
                            <li><strong>Rolle:</strong> ${user.role}</li>
                        </ul>
                        <p>Bitte bestätige den Login-Versuch durch Klicken auf den folgenden Button:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${baseUrl}/approve-login?token=${loginToken}" style="background-color: #1eff00; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login bestätigen</a>
                        </div>
                        <p>Oder kopiere diesen Link in deinen Browser:</p>
                        <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 5px;">${baseUrl}/approve-login?token=${loginToken}</p>
                        <p>Dieser Link ist aus Sicherheitsgründen 30 Minuten gültig.</p>
                        <p>Wenn du diesen Login-Versuch nicht bestätigen möchtest, ignoriere diese E-Mail.</p>
                    </div>
                `
            };
            
            // E-Mail senden
            await transporter.sendMail(mailOptions);
            console.log('Admin-Login-Bestätigung gesendet');
            
            return res.json({
                success: true,
                approval_required: true,
                message: 'Für Admin-Logins ist eine zusätzliche Bestätigung erforderlich. Bitte warte auf die Bestätigungsmail.'
            });
        } catch (error) {
            console.error('Fehler beim Senden der Admin-Login-Bestätigung:', error);
            return res.status(500).json({
                success: false,
                error: 'Fehler beim Senden der Bestätigung. Bitte versuche es später erneut.'
            });
        }
    }
    
    // Normale Login-Benachrichtigung für alle Benutzer senden
    try {
        // URL basierend auf Host und Protocol bestimmen
        const currentDomain = req.headers.host || 'localhost:5000';
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const baseUrl = `${protocol}://${currentDomain}`;
        
        // E-Mail-Optionen
        const mailOptions = {
            from: 'verify.mcbot@gmail.com',
            to: 'tom-theile@outlook.de',
            subject: `Login-Benachrichtigung: ${user.username}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #1eff00; border-radius: 10px;">
                    <h2 style="color: #1eff00; text-align: center;">Login-Benachrichtigung</h2>
                    <p>Ein Benutzer hat sich gerade angemeldet:</p>
                    <ul>
                        <li><strong>Benutzername:</strong> ${user.username}</li>
                        <li><strong>E-Mail:</strong> ${user.email}</li>
                        <li><strong>Datum/Uhrzeit:</strong> ${new Date().toLocaleString()}</li>
                        <li><strong>Rolle:</strong> ${user.role || 'Benutzer'}</li>
                    </ul>
                    <p>Dies ist eine automatische Benachrichtigung vom Herobrine AFK Bot-System.</p>
                </div>
            `
        };
        
        // E-Mail senden (im Hintergrund, ohne auf Antwort zu warten)
        transporter.sendMail(mailOptions)
            .then(info => console.log('Login-Benachrichtigung gesendet:', info.response))
            .catch(error => console.error('Fehler beim Senden der Login-Benachrichtigung:', error));
            
    } catch (error) {
        console.error('Fehler beim Erstellen der Login-Benachrichtigung:', error);
        // Wir geben hier keinen Fehler zurück, da der Login trotzdem funktionieren soll
    }
    
    // Erfolgreiche Anmeldung
    return res.json({ 
        success: true, 
        user: {
            uid: user.uid,
            email: user.email,
            username: user.username,
            verified: user.verified,
            role: user.role || 'user'
        }
    });
});

app.post('/api/users/verify', (req, res) => {
    const { email, token } = req.body;
    
    if (!email) {
        return res.status(400).json({ 
            success: false, 
            error: 'E-Mail ist erforderlich' 
        });
    }
    
    // In einer echten App würde hier der Token überprüft werden
    
    // Datenbank lesen
    const db = readDatabase();
    
    // Benutzer suchen
    if (!db.users[email]) {
        return res.status(404).json({ 
            success: false, 
            error: 'Benutzer nicht gefunden' 
        });
    }
    
    // Benutzer verifizieren
    db.users[email].verified = true;
    
    // Datenbank schreiben
    if (writeDatabase(db)) {
        return res.json({ 
            success: true, 
            message: 'E-Mail wurde erfolgreich verifiziert'
        });
    } else {
        return res.status(500).json({ 
            success: false, 
            error: 'Fehler beim Speichern der Daten' 
        });
    }
});

app.post('/api/users/reset-password', (req, res) => {
    const { email, token, newPassword } = req.body;
    
    if (!email || !newPassword) {
        return res.status(400).json({ 
            success: false, 
            error: 'E-Mail und neues Passwort sind erforderlich' 
        });
    }
    
    // In einer echten App würde hier der Token überprüft werden
    
    // Datenbank lesen
    const db = readDatabase();
    
    // Benutzer suchen
    if (!db.users[email]) {
        return res.status(404).json({ 
            success: false, 
            error: 'Benutzer nicht gefunden' 
        });
    }
    
    // Passwort aktualisieren
    db.users[email].password = newPassword;
    
    // Datenbank schreiben
    if (writeDatabase(db)) {
        return res.json({ 
            success: true, 
            message: 'Passwort wurde erfolgreich aktualisiert'
        });
    } else {
        return res.status(500).json({ 
            success: false, 
            error: 'Fehler beim Speichern der Daten' 
        });
    }
});

// Route um einen Benutzer anhand der E-Mail zu bekommen (für Admin-Bereich)
app.get('/api/users/get-by-email', (req, res) => {
    const { email } = req.query;
    
    if (!email) {
        return res.status(400).json({ 
            success: false, 
            error: 'E-Mail ist erforderlich' 
        });
    }
    
    // Datenbank lesen
    const db = readDatabase();
    
    // Benutzer suchen
    const user = db.users[email];
    
    if (!user) {
        return res.status(404).json({ 
            success: false, 
            error: 'Benutzer nicht gefunden' 
        });
    }
    
    // Benutzerinformationen zurückgeben (ohne Passwort)
    return res.json({
        success: true,
        user: {
            uid: user.uid,
            email: user.email,
            username: user.username,
            verified: user.verified,
            role: user.role || 'user',
            banned: user.banned || false,
            created: user.created
        }
    });
});

// Admin-API-Routen

// API-Route zum Verifizieren eines Benutzers (nur für Admins)
app.post('/api/admin/verify-user', (req, res) => {
    const { admin_email, user_email } = req.body;
    
    if (!admin_email || !user_email) {
        return res.status(400).json({
            success: false,
            error: 'Admin-E-Mail und Benutzer-E-Mail sind erforderlich'
        });
    }
    
    // Datenbank lesen
    const db = readDatabase();
    
    // Prüfen, ob der anfragende Benutzer ein Admin ist
    const admin = db.users[admin_email];
    if (!admin || admin.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Nicht autorisiert. Nur Administratoren können diese Aktion ausführen.'
        });
    }
    
    // Benutzer suchen
    const user = db.users[user_email];
    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'Benutzer nicht gefunden'
        });
    }
    
    // Benutzer verifizieren
    user.verified = true;
    
    // Datenbank speichern
    if (writeDatabase(db)) {
        return res.json({
            success: true,
            message: `Benutzer ${user.username} wurde erfolgreich verifiziert`
        });
    } else {
        return res.status(500).json({
            success: false,
            error: 'Fehler beim Speichern der Daten'
        });
    }
});

// API-Route zum Sperren/Entsperren eines Benutzers (nur für Admins)
app.post('/api/admin/toggle-ban', (req, res) => {
    const { admin_email, user_email, ban_status, ban_reason } = req.body;
    
    if (!admin_email || !user_email) {
        return res.status(400).json({
            success: false,
            error: 'Admin-E-Mail und Benutzer-E-Mail sind erforderlich'
        });
    }
    
    // Datenbank lesen
    const db = readDatabase();
    
    // Prüfen, ob der anfragende Benutzer ein Admin ist
    const admin = db.users[admin_email];
    if (!admin || admin.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Nicht autorisiert. Nur Administratoren können diese Aktion ausführen.'
        });
    }
    
    // Benutzer suchen
    const user = db.users[user_email];
    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'Benutzer nicht gefunden'
        });
    }
    
    // Benutzer sperren/entsperren
    user.banned = ban_status;
    if (ban_status && ban_reason) {
        user.ban_reason = ban_reason;
    } else if (!ban_status) {
        delete user.ban_reason;
    }
    
    // Datenbank speichern
    if (writeDatabase(db)) {
        return res.json({
            success: true,
            message: ban_status 
                ? `Benutzer ${user.username} wurde gesperrt` 
                : `Benutzer ${user.username} wurde entsperrt`
        });
    } else {
        return res.status(500).json({
            success: false,
            error: 'Fehler beim Speichern der Daten'
        });
    }
});

// Admin-API-Routen für Statistiken
app.get('/api/admin/stats', (req, res) => {
    // Prüfen, ob die Anfrage von einem Admin kommt
    const { admin_email } = req.query;
    
    if (!admin_email) {
        return res.status(403).json({
            success: false,
            error: 'Nicht autorisiert'
        });
    }
    
    // Datenbank lesen
    const db = readDatabase();
    
    // Prüfen, ob der anfragende Benutzer ein Admin ist
    const admin = db.users[admin_email];
    if (!admin || admin.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Nicht autorisiert. Nur Administratoren können diese Aktion ausführen.'
        });
    }
    
    // Statistiken simulieren
    res.json({
        success: true,
        stats: {
            userCount: Object.keys(readDatabase().users).length,
            activeBots: Math.floor(Math.random() * 5), // Simuliert
            uptime: Math.floor(Math.random() * 72) + 'h', // Simuliert
            loginsToday: Math.floor(Math.random() * 10) // Simuliert
        }
    });
});

app.get('/api/admin/users', (req, res) => {
    // Prüfen, ob die Anfrage von einem Admin kommt
    const { admin_email } = req.query;
    
    if (!admin_email) {
        return res.status(403).json({
            success: false,
            error: 'Nicht autorisiert'
        });
    }
    
    // Datenbank lesen
    const db = readDatabase();
    
    // Prüfen, ob der anfragende Benutzer ein Admin ist
    const admin = db.users[admin_email];
    if (!admin || admin.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Nicht autorisiert. Nur Administratoren können diese Aktion ausführen.'
        });
    }
    
    // Benutzerliste erstellen (ohne Passwörter)
    const userList = Object.values(db.users).map(user => ({
        uid: user.uid,
        email: user.email,
        username: user.username,
        verified: user.verified,
        role: user.role || 'user',
        banned: user.banned || false,
        ban_reason: user.ban_reason || '',
        created: user.created
    }));
    
    res.json({
        success: true,
        users: userList
    });
});

app.get('/api/admin/logs', (req, res) => {
    // Prüfen, ob die Anfrage von einem Admin kommt
    const { admin_email } = req.query;
    
    if (!admin_email) {
        return res.status(403).json({
            success: false,
            error: 'Nicht autorisiert'
        });
    }
    
    // Datenbank lesen
    const db = readDatabase();
    
    // Prüfen, ob der anfragende Benutzer ein Admin ist
    const admin = db.users[admin_email];
    if (!admin || admin.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Nicht autorisiert. Nur Administratoren können diese Aktion ausführen.'
        });
    }
    
    // In einer echten Anwendung würden wir hier die Logs aus einer Datenbank laden
    // Für Demo-Zwecke simulieren wir die Logs
    res.json({
        success: true,
        logs: [
            {
                date: new Date().toLocaleString(),
                username: 'TurboKid',
                action: 'login',
                ip: '192.168.1.1'
            },
            {
                date: new Date(Date.now() - 3600000).toLocaleString(),
                username: 'DemoUser',
                action: 'login',
                ip: '192.168.1.2'
            },
            {
                date: new Date(Date.now() - 7200000).toLocaleString(),
                username: 'HerobrineMaster',
                action: 'login',
                ip: '192.168.1.3'
            }
        ]
    });
});

// Route für die Login-Bestätigung
app.get('/approve-login', (req, res) => {
    const { token } = req.query;
    
    if (!token) {
        return res.send(`
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
                        h1 { color: #ff3838; }
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
                        <h1>Fehler</h1>
                        <p>Ungültiger oder fehlender Token.</p>
                        <a href="/" class="button">Zurück zur Hauptseite</a>
                    </div>
                </body>
            </html>
        `);
    }
    
    // Datenbank lesen
    const db = readDatabase();
    
    // Prüfen, ob der Token existiert
    if (!db.pending_logins || !db.pending_logins[token]) {
        return res.send(`
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
                        h1 { color: #ff3838; }
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
                        <h1>Fehler</h1>
                        <p>Der Bestätigungslink ist ungültig oder abgelaufen.</p>
                        <a href="/" class="button">Zurück zur Hauptseite</a>
                    </div>
                </body>
            </html>
        `);
    }
    
    // Prüfen, ob der Token abgelaufen ist
    const pendingLogin = db.pending_logins[token];
    const expiryDate = new Date(pendingLogin.expires);
    const now = new Date();
    
    if (now > expiryDate) {
        delete db.pending_logins[token];
        writeDatabase(db);
        
        return res.send(`
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
                        h1 { color: #ff3838; }
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
                        <h1>Fehler</h1>
                        <p>Der Bestätigungslink ist abgelaufen.</p>
                        <a href="/" class="button">Zurück zur Hauptseite</a>
                    </div>
                </body>
            </html>
        `);
    }
    
    // Login bestätigen
    const userEmail = pendingLogin.user_email;
    
    if (!db.users[userEmail]) {
        delete db.pending_logins[token];
        writeDatabase(db);
        
        return res.send(`
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
                        h1 { color: #ff3838; }
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
    const { username, serverIp, serverPort, botName, mcVersion } = req.body;
    
    if (!username || !serverIp || !botName) {
        return res.status(400).json({
            success: false,
            error: 'Benutzername, Server-IP und Bot-Name sind erforderlich'
        });
    }
    
    try {
        // Konfiguration für den Bot erstellen
        const botConfig = {
            username,
            serverIp,
            serverPort: serverPort || '25565',
            botName,
            mcVersion: mcVersion || '1.21.4'
        };
        
        // Bot starten
        const result = minecraftBot.startBot(botConfig);
        
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
        console.error('Fehler beim Starten des Minecraft-Bots:', error);
        res.status(500).json({
            success: false,
            error: `Fehler beim Starten des Bots: ${error.message}`
        });
    }
});

app.post('/api/minecraft/stop-bot', (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({
            success: false,
            error: 'Benutzername ist erforderlich'
        });
    }
    
    try {
        // Bot stoppen
        const result = minecraftBot.stopBot(username);
        
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

app.post('/api/minecraft/send-command', (req, res) => {
    const { username, command } = req.body;
    
    if (!username || !command) {
        return res.status(400).json({
            success: false,
            error: 'Benutzername und Befehl sind erforderlich'
        });
    }
    
    try {
        // Befehl an Bot senden
        const result = minecraftBot.sendCommand(username, command);
        
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server läuft auf http://0.0.0.0:${PORT}`);
    
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
