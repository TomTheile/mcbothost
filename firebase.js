// Firebase-ähnliche Konfiguration (Simuliert Firebase-Funktionalität)
const firebaseConfig = {
    apiKey: "simulierte-api-key",
    authDomain: "simuliert.example.com",
    projectId: "simulierte-project-id",
    storageBucket: "simuliert.example.com",
    messagingSenderId: "123456789",
    appId: "simulierte-app-id"
};

// Simulierter lokaler Speicher für registrierte Benutzer
const users = {};

// Initialisierungsfunktion (simuliert die Einrichtung von Firebase)
function initializeFirebase() {
    console.log("Firebase simuliert initialisiert");
    return { success: true };
}

// Benutzerregistrierung (simuliert)
async function registerUser(email, password, username) {
    // Simuliert eine asynchrone Operation (wie bei Firebase Auth)
    return new Promise((resolve) => {
        console.log(`Simuliere Registrierung für: ${email}, Benutzername: ${username}`);
        
        // Simulierte Verzögerung für die Netzwerkanfrage
        setTimeout(() => {
            // Benutzer simuliert speichern
            const userId = 'sim-' + Math.random().toString(36).substr(2, 9);
            users[email] = {
                uid: userId,
                email: email,
                username: username,
                password: password, // In einer echten App würde das Passwort niemals im Klartext gespeichert werden
                verified: false
            };
            
            // Erfolgreiche Simulation
            resolve({ 
                success: true, 
                user: { 
                    uid: userId, 
                    email: email,
                    username: username
                } 
            });
        }, 1000);
    });
}

// Benutzeranmeldung (simuliert)
async function loginUser(email, password) {
    // Simuliert eine asynchrone Operation (wie bei Firebase Auth)
    return new Promise((resolve) => {
        console.log(`Simuliere Anmeldung für: ${email}`);
        
        // Simulierte Verzögerung für die Netzwerkanfrage
        setTimeout(() => {
            // Prüfe, ob Benutzer existiert und Passwort korrekt ist
            const user = users[email];
            
            // Simulierte Anmeldung mit Passwortprüfung
            if (user && user.password === password) {
                resolve({ 
                    success: true, 
                    user: { 
                        uid: user.uid, 
                        email: user.email,
                        username: user.username,
                        verified: user.verified
                    } 
                });
            } else if (user && user.password !== password) {
                // Passwort ist falsch
                resolve({
                    success: false,
                    error: "Falsches Passwort. Bitte überprüfe deine Eingabe."
                });
            } else {
                // Benutzer nicht gefunden
                resolve({
                    success: false,
                    error: "Kein Konto mit dieser E-Mail-Adresse gefunden."
                });
                
                // Demo-Benutzer anlegen (nur für Testzwecke)
                // In einer echten App würde diese Zeile nie existieren!
                users[email] = {
                    uid: 'sim-' + Math.random().toString(36).substr(2, 9),
                    email: email,
                    username: email.split('@')[0],
                    password: password,
                    verified: true
                };
            }
        }, 1000);
    });
}

// E-Mail-Verifizierung (simuliert)
async function sendVerificationEmail(userId, email) {
    // In einer echten Implementierung würde hier Firebase Cloud Functions verwendet werden
    console.log(`Sending verification email to: ${email} for user: ${userId}`);
    
    try {
        // API-Aufruf an unseren Backend-Server
        const response = await fetch('/send-verification-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, email }),
        });
        
        const data = await response.json();
        
        // Wenn der Benutzer existiert, setze ihn auf verifiziert
        if (users[email]) {
            users[email].verified = true;
        }
        
        return data;
    } catch (error) {
        console.error("Error sending verification email:", error);
        return {
            success: false,
            error: "Failed to send verification email"
        };
    }
}

// Benutzerdaten abrufen (simuliert)
async function getUserData(userId) {
    return new Promise((resolve) => {
        console.log(`Simuliere Abfrage der Benutzerdaten für UserID: ${userId}`);
        
        // Suche nach dem Benutzer in der simulierten Datenbank
        let foundUser = null;
        
        for (const email in users) {
            if (users[email].uid === userId) {
                foundUser = users[email];
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
                // Für Demo-Zwecke erzeugen wir einen Dummy-Benutzer, wenn keiner gefunden wurde
                resolve({
                    success: true,
                    user: {
                        uid: userId,
                        email: 'user@example.com',
                        username: 'Demo User',
                        verified: true
                    }
                });
            }
        }, 800);
    });
}

// Passwort zurücksetzen (simuliert)
async function sendPasswordResetEmail(email) {
    return new Promise((resolve) => {
        console.log(`Simuliere Passwort-Zurücksetzungs-E-Mail für: ${email}`);
        
        // Simulierte Verzögerung für die Netzwerkanfrage
        setTimeout(() => {
            resolve({ success: true });
        }, 1000);
    });
}

// Passwort aktualisieren (simuliert)
async function updatePassword(email, newPassword) {
    return new Promise((resolve) => {
        console.log(`Simuliere Passwort-Aktualisierung für: ${email}`);
        
        // Prüfen, ob der Benutzer existiert
        if (users[email]) {
            // Passwort aktualisieren
            users[email].password = newPassword;
            
            // Erfolgreiche Simulation
            setTimeout(() => {
                resolve({ success: true });
            }, 1000);
        } else {
            // Benutzer nicht gefunden, aber für Demo-Zwecke als Erfolg melden
            setTimeout(() => {
                resolve({ success: true });
            }, 1000);
        }
    });
}

module.exports = {
    firebaseConfig,
    initializeFirebase,
    registerUser,
    loginUser,
    sendVerificationEmail,
    getUserData,
    sendPasswordResetEmail,
    updatePassword
};
