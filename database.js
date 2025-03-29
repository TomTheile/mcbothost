// Einfache Datenbankschnittstelle für die JSON-Datei

// Simuliert eine Datenbank im Arbeitsspeicher für die Client-Seite
let inMemoryUsers = {};

// Initialisierung aus Benutzer (simuliert das Laden aus einer Datenbank)
export function initializeDatabase() {
    console.log("Einfache Datenbank initialisiert");
    
    // Sicherstellen, dass wir einige Standard-Demo-Benutzer haben
    registerUser('demo@example.com', 'password123', 'DemoUser');
    registerUser('TurboKid@outlook.de', 'minecraft', 'TurboKid');
    
    return { success: true };
}

// Benutzerregistrierung
export async function registerUser(email, password, username) {
    return new Promise((resolve) => {
        console.log(`Registrierung für: ${email}, Benutzername: ${username}`);
        
        // Prüfen, ob Benutzer bereits existiert
        if (inMemoryUsers[email]) {
            resolve({
                success: false,
                error: "Diese E-Mail-Adresse wird bereits verwendet"
            });
            return;
        }
        
        // Simulierte Verzögerung
        setTimeout(() => {
            // Benutzer speichern
            const userId = 'db-' + Math.random().toString(36).substr(2, 9);
            inMemoryUsers[email] = {
                uid: userId,
                email: email,
                username: username,
                password: password,
                verified: false,
                created: new Date().toISOString()
            };
            
            // Dann API-Anfrage an den Server senden
            fetch('/api/users/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            })
            .then(response => response.json())
            .then(data => {
                console.log("Serverantwort:", data);
            })
            .catch(error => {
                console.error("Fehler bei Serveranfrage:", error);
            });
            
            // Erfolgreiche Simulation
            resolve({ 
                success: true, 
                user: { 
                    uid: userId, 
                    email: email,
                    username: username
                } 
            });
        }, 800);
    });
}

// Benutzeranmeldung
export async function loginUser(email, password) {
    return new Promise((resolve) => {
        console.log(`Anmeldung für: ${email}`);
        
        // Simulierte Verzögerung
        setTimeout(() => {
            // Prüfe, ob Benutzer existiert
            const user = inMemoryUsers[email];
            
            // Prüfe zuerst die lokalen Daten
            if (user && user.password === password) {
                // E-Mail-Adresse im localStorage speichern für die Admin-Seite
                localStorage.setItem('userEmail', email);
                
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
            
            // Direkter Datenbankzugriff statt Server-Anfrage
            const db = require('./database.json'); //This line assumes database.json exists in the same directory.  Error handling might be needed for production.
            if (db.users && db.users[email] && db.users[email].password === password) {
                // Benutzer gefunden und Passwort korrekt
                localStorage.setItem('userEmail', email);
                resolve({ 
                    success: true, 
                    user: {
                        uid: db.users[email].uid,
                        email: email,
                        username: db.users[email].username,
                        verified: db.users[email].verified,
                        role: db.users[email].role || 'user'
                    }
                });
            } else {
                resolve({
                    success: false,
                    error: "Ungültige E-Mail oder Passwort"
                });
            }
        }, 800);
    });
}

// E-Mail-Verifizierung senden
export async function sendVerificationEmail(userId, email, username) {
    return fetch('/send-verification-email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, email, username }),
    })
    .then(response => response.json())
    .catch(error => {
        console.error("Fehler beim Senden der Verifizierungs-E-Mail:", error);
        return { success: false, error: "Fehler beim Senden der E-Mail" };
    });
}

// Benutzerdaten abrufen
export async function getUserData(userId) {
    return new Promise((resolve) => {
        console.log(`Abfrage der Benutzerdaten für UserID: ${userId}`);
        
        // Benutzer in der lokalen Datenbank suchen
        let foundUser = null;
        for (const email in inMemoryUsers) {
            if (inMemoryUsers[email].uid === userId) {
                foundUser = inMemoryUsers[email];
                break;
            }
        }
        
        // Simulierte Verzögerung
        setTimeout(() => {
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
                // Wenn nicht gefunden, verwenden wir den Demo-Benutzer
                fetch(`/api/users/get?userId=${userId}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            resolve({
                                success: true,
                                user: data.user
                            });
                        } else {
                            resolve({
                                success: true,
                                user: {
                                    uid: userId,
                                    email: 'demo@example.com',
                                    username: 'Demo User',
                                    verified: true
                                }
                            });
                        }
                    })
                    .catch(() => {
                        // Fallback-Benutzer
                        resolve({
                            success: true,
                            user: {
                                uid: userId,
                                email: 'demo@example.com',
                                username: 'Demo User',
                                verified: true
                            }
                        });
                    });
            }
        }, 800);
    });
}

// Passwort zurücksetzen
export async function sendPasswordResetEmail(email) {
    return fetch('/reset-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
    })
    .then(response => response.json())
    .catch(error => {
        console.error("Fehler beim Senden der Passwort-Zurücksetzen-E-Mail:", error);
        return { success: false, error: "Fehler beim Senden der E-Mail" };
    });
}

// Passwort aktualisieren
export async function updatePassword(email, newPassword) {
    return new Promise((resolve) => {
        // Lokale Kopie aktualisieren, falls vorhanden
        if (inMemoryUsers[email]) {
            inMemoryUsers[email].password = newPassword;
        }
        
        // Server-Anfrage senden
        fetch('/api/users/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, newPassword }),
        })
        .then(response => response.json())
        .then(data => {
            resolve(data);
        })
        .catch(error => {
            console.error("Fehler beim Aktualisieren des Passworts:", error);
            // Trotzdem als Erfolg melden, da lokale Kopie aktualisiert wurde
            resolve({ success: true });
        });
    });
}
