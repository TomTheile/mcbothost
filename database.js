// Einfache Datenbankschnittstelle für die JSON-Datei
const fs = require('fs');
const path = require('path');

// Der Pfad zur Datenbankdatei
const DB_PATH = path.join(__dirname, 'database.json');

// JSON-Datenbank lesen
function readDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Fehler beim Lesen der Datenbank:', error);
    }
    return { users: {} };
}

// JSON-Datenbank schreiben
function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Fehler beim Schreiben der Datenbank:', error);
        return false;
    }
}

// Initialisierung der Datenbank
function initializeDatabase() {
    console.log("Datenbank wird initialisiert...");
    
    // Prüfen, ob die Datenbankdatei existiert
    if (!fs.existsSync(DB_PATH)) {
        // Leere Datenbank erstellen
        writeDatabase({ users: {} });
        console.log("Neue Datenbank wurde erstellt.");
    } else {
        console.log("Existierende Datenbank gefunden.");
    }
    
    return { success: true };
}

// Simuliert eine Datenbank im Arbeitsspeicher für die Client-Seite
let inMemoryUsers = {};

// Benutzerregistrierung
async function registerUser(email, password, username) {
    return new Promise(async (resolve) => {
        console.log(`Registrierung für: ${email}, Benutzername: ${username}`);
        
        // Benutzer in der Datenbank speichern
        const db = readDatabase();
        
        // Prüfen, ob Benutzer bereits existiert
        if (db.users && db.users[email]) {
            resolve({
                success: false,
                error: "Diese E-Mail-Adresse wird bereits verwendet"
            });
            return;
        }
        
        // Prüfen, ob der Benutzername bereits existiert
        for (const userEmail in db.users) {
            if (db.users[userEmail].username === username) {
                resolve({
                    success: false,
                    error: "Dieser Benutzername wird bereits verwendet"
                });
                return;
            }
        }
        
        try {
            // Benutzer speichern
            const userId = 'user-' + Math.random().toString(36).substr(2, 9);
            
            if (!db.users) {
                db.users = {};
            }
            
            db.users[email] = {
                uid: userId,
                email: email,
                username: username,
                password: password, // Passwort im Klartext speichern (nur für Testzwecke!)
                verified: true, // Für Testzwecke auf true gesetzt, im Produktionssystem würde hier false stehen
                created: new Date().toISOString(),
                login_approved: true
            };
            
            writeDatabase(db);
            
            // Erfolgreiche Registrierung
            resolve({ 
                success: true, 
                user: { 
                    uid: userId, 
                    email: email,
                    username: username
                } 
            });
        } catch (error) {
            console.error('Fehler bei der Benutzerregistrierung:', error);
            resolve({
                success: false,
                error: "Interner Serverfehler bei der Registrierung"
            });
        }
    });
}

// Benutzeranmeldung
async function loginUser(email, password) {
    return new Promise(async (resolve) => {
        console.log(`Anmeldung für: ${email}`);
        
        try {
            // Benutzer in der Datenbank suchen
            const db = readDatabase();
            
            // Prüfe, ob Benutzer existiert
            if (db.users && db.users[email]) {
                const user = db.users[email];
                
                // Prüfe ob das Konto verifiziert ist
                if (!user.verified) {
                    resolve({
                        success: false,
                        error: "Dein Konto wurde noch nicht verifiziert. Bitte prüfe deine E-Mails."
                    });
                    return;
                }
                
                // Prüfe ob Login-Berechtigung erteilt wurde
                if (!user.login_approved) {
                    resolve({
                        success: false,
                        error: "Dein Konto wartet noch auf die Freischaltung durch einen Administrator."
                    });
                    return;
                }
                
                // Direkt Passwort vergleichen (Klartext)
                if (user.password === password) {
                    // Erfolgreicher Login - Zeitstempel aktualisieren
                    db.users[email].last_login = new Date().toISOString();
                    writeDatabase(db);
                    
                    resolve({ 
                        success: true, 
                        user: { 
                            uid: user.uid, 
                            email: user.email,
                            username: user.username,
                            verified: user.verified,
                            role: user.role || 'user'
                        } 
                    });
                    return;
                }
            }
            
            // Benutzer nicht gefunden oder falsches Passwort
            resolve({
                success: false,
                error: "Ungültige E-Mail oder Passwort"
            });
        } catch (error) {
            console.error('Fehler beim Login:', error);
            resolve({
                success: false,
                error: "Interner Serverfehler beim Login"
            });
        }
    });
}

// E-Mail-Verifizierung senden
async function sendVerificationEmail(userId, email, username) {
    console.log(`Verifizierungs-E-Mail wird vorbereitet für: ${email} (${username})`);
    
    try {
        // Hilfsfunktionen für E-Mail-Versand
        const nodemailer = require('nodemailer');
        const { v4: uuidv4 } = require('uuid');
        
        // Datenbank lesen
        const db = readDatabase();
        
        // Verifikations-Token erstellen
        const token = uuidv4();
        const now = Date.now();
        
        // Token in der Datenbank speichern
        db.verifications = db.verifications || {};
        db.verifications[token] = {
            userId,
            email,
            username,
            timestamp: now
        };
        
        // Datenbank aktualisieren
        writeDatabase(db);
        
        // Verwende lokalen Testserver für E-Mail (im Entwicklungsmodus)
        // In der Produktion würde hier die Konfiguration für einen richtigen SMTP-Server stehen
        const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: {
                user: process.env.EMAIL_USER || 'ethereal.user@ethereal.email',
                pass: process.env.EMAIL_PASS || 'ethereal_pass'
            }
        });
        
        // Basis-URL bestimmen
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
        
        // Verifizierungs-URL erstellen
        const verificationUrl = `${baseUrl}/api/users/verify/${token}`;
        
        // E-Mail-Inhalt vorbereiten
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Herobrine AFK Bot" <noreply@herobrine-bot.de>',
            to: email,
            subject: 'Bestätige dein Herobrine AFK Bot Konto',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h2 style="color: #333; text-align: center;">Willkommen bei Herobrine AFK Bot!</h2>
                    <p>Hallo <strong>${username}</strong>,</p>
                    <p>vielen Dank für deine Registrierung! Um dein Konto zu aktivieren, klicke bitte auf den folgenden Link:</p>
                    <p style="text-align: center;">
                        <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Konto aktivieren</a>
                    </p>
                    <p>Alternativ kannst du auch diesen Link in deinen Browser kopieren:</p>
                    <p style="background-color: #f5f5f5; padding: 10px; border-radius: 3px; word-break: break-all;">
                        ${verificationUrl}
                    </p>
                    <p>Dieser Link ist 24 Stunden gültig.</p>
                    <p>Falls du diese E-Mail nicht angefordert hast, kannst du sie einfach ignorieren.</p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                    <p style="color: #777; font-size: 12px; text-align: center;">
                        Dies ist eine automatisch generierte E-Mail. Bitte antworte nicht auf diese Nachricht.
                    </p>
                </div>
            `
        };
        
        // In der Entwicklungsumgebung einfach Link ausgeben, keine echte E-Mail senden
        if (process.env.NODE_ENV !== 'production') {
            console.log('| ------------ ENTWICKLUNGSMODUS --------------|');
            console.log('| Aktivierungs-Link (nur in der Entwicklung):  |');
            console.log(`| ${verificationUrl}`);
            console.log('|----------------------------------------------|');
            return { 
                success: true, 
                verificationUrl, // Nur im Entwicklungsmodus zurückgeben
                message: 'Verifizierungslink wurde generiert (Entwicklungsmodus)'
            };
        }
        
        // In der Produktion E-Mail senden
        const info = await transporter.sendMail(mailOptions);
        console.log('Verifizierungs-E-Mail gesendet:', info.messageId);
        
        return { 
            success: true,
            message: 'Verifizierungs-E-Mail wurde gesendet' 
        };
    } catch (error) {
        console.error('Fehler beim Senden der Verifizierungs-E-Mail:', error);
        return { 
            success: false, 
            error: 'E-Mail konnte nicht gesendet werden'
        };
    }
}

// Benutzerdaten abrufen
async function getUserData(userId) {
    return new Promise((resolve) => {
        console.log(`Abfrage der Benutzerdaten für UserID: ${userId}`);
        
        // Datenbank lesen
        const db = readDatabase();
        
        // Benutzer in der Datenbank suchen
        let foundUser = null;
        
        for (const email in db.users) {
            if (db.users[email].uid === userId) {
                foundUser = db.users[email];
                break;
            }
        }
        
        if (foundUser) {
            resolve({
                success: true,
                user: {
                    uid: foundUser.uid,
                    email: foundUser.email,
                    username: foundUser.username,
                    verified: foundUser.verified
                }
            });
        } else {
            // Benutzer nicht gefunden
            resolve({
                success: false,
                error: "Benutzer nicht gefunden"
            });
        }
    });
}

// Passwort zurücksetzen
async function sendPasswordResetEmail(email) {
    console.log(`Passwort-Reset-E-Mail wird vorbereitet für: ${email}`);
    
    try {
        // Datenbank einlesen
        const db = readDatabase();
        
        // Prüfen, ob Benutzer existiert
        if (!db.users || !db.users[email]) {
            console.log(`Benutzer mit E-Mail ${email} existiert nicht`);
            // Erfolg trotzdem melden, um keine Informationen preiszugeben
            return { 
                success: true, 
                message: 'Falls ein Konto mit dieser E-Mail existiert, wurde eine Anleitung zum Zurücksetzen des Passworts gesendet'
            };
        }
        
        const user = db.users[email];
        
        // Hilfsfunktionen für E-Mail-Versand und Token
        const nodemailer = require('nodemailer');
        const { v4: uuidv4 } = require('uuid');
        
        // Reset-Token erstellen
        const token = uuidv4();
        const now = Date.now();
        
        // Token in der Datenbank speichern
        db.password_resets = db.password_resets || {};
        db.password_resets[token] = {
            email,
            timestamp: now,
            expires: now + (24 * 60 * 60 * 1000) // 24 Stunden gültig
        };
        
        // Datenbank aktualisieren
        writeDatabase(db);
        
        // Verwende lokalen Testserver für E-Mail (im Entwicklungsmodus)
        const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: {
                user: process.env.EMAIL_USER || 'ethereal.user@ethereal.email',
                pass: process.env.EMAIL_PASS || 'ethereal_pass'
            }
        });
        
        // Basis-URL bestimmen
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
        
        // Reset-URL erstellen
        const resetUrl = `${baseUrl}/reset-password.html?token=${token}`;
        
        // E-Mail-Inhalt vorbereiten
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Herobrine AFK Bot" <noreply@herobrine-bot.de>',
            to: email,
            subject: 'Passwort zurücksetzen für Herobrine AFK Bot',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h2 style="color: #333; text-align: center;">Passwort zurücksetzen</h2>
                    <p>Hallo <strong>${user.username}</strong>,</p>
                    <p>wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Klicke auf den folgenden Link, um ein neues Passwort zu erstellen:</p>
                    <p style="text-align: center;">
                        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4285f4; color: white; text-decoration: none; border-radius: 5px;">Passwort zurücksetzen</a>
                    </p>
                    <p>Alternativ kannst du auch diesen Link in deinen Browser kopieren:</p>
                    <p style="background-color: #f5f5f5; padding: 10px; border-radius: 3px; word-break: break-all;">
                        ${resetUrl}
                    </p>
                    <p>Dieser Link ist 24 Stunden gültig.</p>
                    <p>Falls du kein neues Passwort angefordert hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.</p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                    <p style="color: #777; font-size: 12px; text-align: center;">
                        Dies ist eine automatisch generierte E-Mail. Bitte antworte nicht auf diese Nachricht.
                    </p>
                </div>
            `
        };
        
        // In der Entwicklungsumgebung einfach Link ausgeben, keine echte E-Mail senden
        if (process.env.NODE_ENV !== 'production') {
            console.log('| ------------ ENTWICKLUNGSMODUS --------------|');
            console.log('| Passwort-Reset Link (nur in der Entwicklung): |');
            console.log(`| ${resetUrl}`);
            console.log('|----------------------------------------------|');
            return { 
                success: true,
                resetUrl, // Nur im Entwicklungsmodus zurückgeben 
                message: 'Passwort-Reset Link wurde generiert (Entwicklungsmodus)'
            };
        }
        
        // In der Produktion E-Mail senden
        const info = await transporter.sendMail(mailOptions);
        console.log('Passwort-Reset-E-Mail gesendet:', info.messageId);
        
        return { 
            success: true, 
            message: 'Falls ein Konto mit dieser E-Mail existiert, wurde eine Anleitung zum Zurücksetzen des Passworts gesendet'
        };
    } catch (error) {
        console.error('Fehler beim Senden der Passwort-Reset-E-Mail:', error);
        return { 
            success: false, 
            error: 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.'
        };
    }
}

// Passwort aktualisieren
async function updatePassword(email, newPassword) {
    return new Promise(async (resolve) => {
        try {
            // Datenbank lesen
            const db = readDatabase();
            
            // Prüfen, ob Benutzer existiert
            if (db.users && db.users[email]) {
                // Passwort direkt im Klartext speichern
                db.users[email].password = newPassword;
                db.users[email].password_updated = new Date().toISOString();
                
                // Datenbank speichern
                writeDatabase(db);
                
                resolve({ success: true });
            } else {
                // Benutzer nicht gefunden
                resolve({
                    success: false,
                    error: "Benutzer nicht gefunden"
                });
            }
        } catch (error) {
            console.error('Fehler beim Aktualisieren des Passworts:', error);
            resolve({
                success: false,
                error: "Interner Serverfehler beim Aktualisieren des Passworts"
            });
        }
    });
}

module.exports = {
    initializeDatabase,
    readDatabase,
    writeDatabase,
    registerUser,
    loginUser,
    sendVerificationEmail,
    getUserData,
    sendPasswordResetEmail,
    updatePassword
};
