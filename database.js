/**
 * In-Memory-Datenbank für das AFK Bot System
 * In einer Produktionsumgebung würde dies durch eine echte Datenbank ersetzt werden
 */

// In-Memory-Speicher
const db = {
    users: [],
    bots: [],
    logs: [],
    sessions: []
};

/**
 * Liest die Datenbank aus dem localStorage (falls vorhanden)
 */
function readDatabase() {
    try {
        const storedData = localStorage.getItem('afk_bot_db');
        if (storedData) {
            const parsedData = JSON.parse(storedData);
            Object.assign(db, parsedData);
            console.log('Datenbank erfolgreich aus localStorage geladen');
        }
    } catch (error) {
        console.error('Fehler beim Lesen der Datenbank:', error);
    }
}

/**
 * Schreibt die Datenbank in den localStorage
 */
function writeDatabase(data = db) {
    try {
        localStorage.setItem('afk_bot_db', JSON.stringify(data));
        console.log('Datenbank erfolgreich in localStorage gespeichert');
    } catch (error) {
        console.error('Fehler beim Schreiben der Datenbank:', error);
    }
}

/**
 * Initialisiert die Datenbank mit Beispieldaten
 */
function initializeDatabase() {
    // Prüfen, ob bereits Daten vorhanden sind
    readDatabase();
    
    // Wenn keine Benutzer vorhanden sind, Beispielbenutzer erstellen
    if (db.users.length === 0) {
        db.users = [
            {
                uid: 'admin_id',
                username: 'Administrator',
                email: 'admin@herobrine-bot.de',
                password: 'admin123', // In einer echten Anwendung würde dies gehasht werden
                role: 'admin',
                created_at: new Date().toISOString(),
                verified: true,
                last_login: new Date().toISOString()
            },
            {
                uid: 'user_1',
                username: 'TestUser',
                email: 'test@example.com',
                password: 'test123',
                role: 'user',
                created_at: new Date().toISOString(),
                verified: true,
                last_login: new Date().toISOString()
            }
        ];
        
        // Beispiel-Bot für den Testbenutzer erstellen
        db.bots = [
            {
                id: 'bot_1',
                user_id: 'user_1',
                server_address: 'mc.example.com',
                server_port: 25565,
                username: 'TestBot',
                status: 'offline',
                created_at: new Date().toISOString(),
                last_active: null,
                total_online_time: 0,
                config: {
                    auto_reconnect: true,
                    anti_afk: true,
                    chat_commands: []
                }
            }
        ];
        
        // Beispiel-Logs
        db.logs = [
            {
                id: 'log_1',
                bot_id: 'bot_1',
                timestamp: new Date().toISOString(),
                type: 'info',
                message: 'Bot wurde erstellt'
            }
        ];
        
        // Datenbank speichern
        writeDatabase();
        console.log('Datenbank mit Beispieldaten initialisiert');
    }
}

/**
 * Registriert einen neuen Benutzer
 * @param {string} email - E-Mail-Adresse des Benutzers
 * @param {string} password - Passwort des Benutzers
 * @param {string} username - Benutzername
 * @returns {Promise<Object>} - Ergebnis der Registrierung
 */
async function registerUser(email, password, username) {
    // Prüfen, ob die E-Mail bereits verwendet wird
    const existingUser = db.users.find(user => user.email === email);
    if (existingUser) {
        return { success: false, error: 'E-Mail-Adresse wird bereits verwendet' };
    }
    
    // Prüfen, ob der Benutzername bereits verwendet wird
    const existingUsername = db.users.find(user => user.username === username);
    if (existingUsername) {
        return { success: false, error: 'Benutzername wird bereits verwendet' };
    }
    
    // Neuen Benutzer erstellen
    const userId = 'user_' + Date.now();
    const newUser = {
        uid: userId,
        username,
        email,
        password, // In einer echten Anwendung würde dies gehasht werden
        role: 'user',
        created_at: new Date().toISOString(),
        verified: false, // Benutzer muss seine E-Mail bestätigen
        last_login: null
    };
    
    // Benutzer zur Datenbank hinzufügen
    db.users.push(newUser);
    writeDatabase();
    
    // Bestätigungs-E-Mail senden (in diesem Beispiel simuliert)
    try {
        await sendVerificationEmail(userId, email, username);
    } catch (error) {
        console.error('Fehler beim Senden der Bestätigungs-E-Mail:', error);
    }
    
    return { 
        success: true, 
        message: 'Benutzer erfolgreich registriert. Bitte überprüfe deine E-Mails zur Bestätigung deines Kontos.',
        user: { uid: userId, username, email, role: 'user' }
    };
}

/**
 * Meldet einen Benutzer an
 * @param {string} email - E-Mail-Adresse des Benutzers
 * @param {string} password - Passwort des Benutzers
 * @returns {Promise<Object>} - Ergebnis der Anmeldung
 */
async function loginUser(email, password) {
    // Benutzer in der Datenbank suchen
    const user = db.users.find(user => user.email === email);
    
    // Prüfen, ob der Benutzer existiert
    if (!user) {
        return { success: false, error: 'Ungültige Anmeldedaten' };
    }
    
    // Passwort überprüfen
    if (user.password !== password) { // In einer echten Anwendung würde dies gehashed verglichen werden
        return { success: false, error: 'Ungültige Anmeldedaten' };
    }
    
    // Prüfen, ob die E-Mail-Adresse bestätigt wurde
    if (!user.verified) {
        return { success: false, error: 'Bitte bestätige zuerst deine E-Mail-Adresse' };
    }
    
    // Anmeldezeit aktualisieren
    user.last_login = new Date().toISOString();
    writeDatabase();
    
    // Token generieren (in einer echten Anwendung würde ein JWT verwendet werden)
    const token = 'token_' + Date.now();
    
    // Session erstellen
    db.sessions.push({
        token,
        user_id: user.uid,
        created_at: new Date().toISOString()
    });
    
    return {
        success: true,
        token,
        user: {
            uid: user.uid,
            username: user.username,
            email: user.email,
            role: user.role
        }
    };
}

/**
 * Sendet eine Bestätigungs-E-Mail an einen Benutzer
 * @param {string} userId - ID des Benutzers
 * @param {string} email - E-Mail-Adresse des Benutzers
 * @param {string} username - Benutzername
 * @returns {Promise<boolean>} - Erfolg oder Misserfolg
 */
async function sendVerificationEmail(userId, email, username) {
    console.log(`Sende Bestätigungs-E-Mail an ${email} (${username})...`);
    
    // In einer echten Anwendung würde hier eine E-Mail über einen Dienst wie SendGrid gesendet werden
    return new Promise((resolve) => {
        // Simuliere eine Verzögerung von 1 Sekunde
        setTimeout(() => {
            console.log(`Bestätigungs-E-Mail an ${email} gesendet!`);
            
            // Für Testzwecke: Benutzer automatisch bestätigen
            const user = db.users.find(user => user.uid === userId);
            if (user) {
                user.verified = true;
                writeDatabase();
                console.log(`Benutzer ${username} automatisch bestätigt (nur für Testzwecke)`);
            }
            
            resolve(true);
        }, 1000);
    });
}

/**
 * Gibt die Daten eines Benutzers zurück
 * @param {string} userId - ID des Benutzers
 * @returns {Object|null} - Benutzerdaten oder null, wenn nicht gefunden
 */
async function getUserData(userId) {
    const user = db.users.find(user => user.uid === userId);
    
    if (!user) {
        return null;
    }
    
    // Sensible Daten entfernen
    const { password, ...userData } = user;
    
    // Bots des Benutzers ermitteln
    const userBots = db.bots.filter(bot => bot.user_id === userId);
    
    return {
        ...userData,
        bots: userBots
    };
}

/**
 * Sendet eine E-Mail zum Zurücksetzen des Passworts
 * @param {string} email - E-Mail-Adresse des Benutzers
 * @returns {Promise<Object>} - Ergebnis des Vorgangs
 */
async function sendPasswordResetEmail(email) {
    // Benutzer in der Datenbank suchen
    const user = db.users.find(user => user.email === email);
    
    // Prüfen, ob der Benutzer existiert
    if (!user) {
        return { success: false, error: 'Benutzer nicht gefunden' };
    }
    
    console.log(`Sende Passwort-Reset-E-Mail an ${email} (${user.username})...`);
    
    // In einer echten Anwendung würde hier eine E-Mail über einen Dienst wie SendGrid gesendet werden
    return new Promise((resolve) => {
        // Simuliere eine Verzögerung von 1 Sekunde
        setTimeout(() => {
            console.log(`Passwort-Reset-E-Mail an ${email} gesendet!`);
            
            resolve({
                success: true,
                message: 'Eine E-Mail zum Zurücksetzen des Passworts wurde gesendet.'
            });
        }, 1000);
    });
}

/**
 * Aktualisiert das Passwort eines Benutzers
 * @param {string} email - E-Mail-Adresse des Benutzers
 * @param {string} newPassword - Neues Passwort
 * @returns {Promise<Object>} - Ergebnis des Vorgangs
 */
async function updatePassword(email, newPassword) {
    // Benutzer in der Datenbank suchen
    const user = db.users.find(user => user.email === email);
    
    // Prüfen, ob der Benutzer existiert
    if (!user) {
        return { success: false, error: 'Benutzer nicht gefunden' };
    }
    
    // Passwort aktualisieren
    user.password = newPassword; // In einer echten Anwendung würde dies gehasht werden
    writeDatabase();
    
    return {
        success: true,
        message: 'Passwort erfolgreich aktualisiert'
    };
}

// Exportiere die Funktionen
export {
    initializeDatabase,
    registerUser,
    loginUser,
    sendVerificationEmail,
    getUserData,
    sendPasswordResetEmail,
    updatePassword
};
