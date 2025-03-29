// Import der Datenbankfunktionen
import { initializeDatabase, registerUser, loginUser, sendVerificationEmail } from './database.js';

// Datenbank initialisieren
initializeDatabase();

// DOM-Elemente
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginButton = document.getElementById('login-btn');
const registerButton = document.getElementById('register-btn');

// Event-Listener für Tab-Wechsel
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
});

// Funktion zum Erstellen von Statusnachrichten
function createStatusMessage(message, isError = false) {
    const statusDiv = document.createElement('div');
    statusDiv.classList.add('status-message');
    statusDiv.classList.add(isError ? 'error' : 'success');
    statusDiv.textContent = message;
    return statusDiv;
}

// Funktion zum Löschen aller Statusnachrichten
function clearStatusMessages(formElement) {
    const messages = formElement.querySelectorAll('.status-message');
    messages.forEach(msg => msg.remove());
}

// Event-Listener für Registrierungsformular
registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatusMessages(registerForm);
    
    // Formulardaten abrufen
    const username = registerForm.querySelector('input[type="text"]').value;
    const email = registerForm.querySelector('input[type="email"]').value;
    const password = registerForm.querySelectorAll('input[type="password"]')[0].value;
    const confirmPassword = registerForm.querySelectorAll('input[type="password"]')[1].value;
    
    // Einfache Validierung
    if (password !== confirmPassword) {
        const errorMsg = createStatusMessage('Passwörter stimmen nicht überein!', true);
        registerForm.appendChild(errorMsg);
        return;
    }
    
    try {
        // Benutzer registrieren
        registerButton.disabled = true;
        registerButton.textContent = 'Registriere...';
        
        const result = await registerUser(email, password, username);
        
        if (result.success) {
            // Status-Nachricht anzeigen
            const processingMsg = createStatusMessage('Registrierung erfolgreich! Sende Verifizierungs-E-Mail...');
            registerForm.appendChild(processingMsg);
            
            console.log("Registrierung erfolgreich. Sende Verifizierungs-E-Mail...");
            console.log("User-Objekt:", result.user);
            
            // E-Mail-Verifizierung über Backend senden
            try {
                const userId = result.user?.uid || username;
                const emailResult = await sendEmailDirectly(email, username);
                
                if (emailResult.success) {
                    // Alte Statusnachricht entfernen und neue hinzufügen
                    clearStatusMessages(registerForm);
                    const successMsg = createStatusMessage('Verifizierungs-E-Mail wurde an ' + email + ' gesendet! Bitte überprüfe deinen Posteingang und klicke auf den Verifizierungslink.');
                    registerForm.appendChild(successMsg);
                    
                    // Formular zurücksetzen nach kurzer Verzögerung
                    setTimeout(() => {
                        registerForm.reset();
                    }, 3000);
                } else {
                    clearStatusMessages(registerForm);
                    const errorMsg = createStatusMessage('E-Mail konnte nicht gesendet werden: ' + (emailResult.error || 'Unbekannter Fehler'), true);
                    registerForm.appendChild(errorMsg);
                }
            } catch (emailError) {
                console.error('Fehler beim Senden der E-Mail:', emailError);
                clearStatusMessages(registerForm);
                const errorMsg = createStatusMessage('Fehler beim Senden der E-Mail: ' + emailError.message, true);
                registerForm.appendChild(errorMsg);
            }
        } else {
            const errorMsg = createStatusMessage('Registrierung fehlgeschlagen: ' + (result.error || 'Unbekannter Fehler'), true);
            registerForm.appendChild(errorMsg);
        }
    } catch (error) {
        console.error('Registrierungsfehler:', error);
        const errorMsg = createStatusMessage('Ein Fehler ist aufgetreten: ' + error.message, true);
        registerForm.appendChild(errorMsg);
    } finally {
        registerButton.disabled = false;
        registerButton.textContent = 'Register';
    }
});

// Event-Listener für Login-Formular
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatusMessages(loginForm);
    
    // Formulardaten abrufen
    const email = loginForm.querySelector('input[type="email"]').value;
    const password = loginForm.querySelector('input[type="password"]').value;
    
    try {
        // Benutzer anmelden
        loginButton.disabled = true;
        loginButton.textContent = 'Anmeldung...';
        
        const result = await loginUser(email, password);
        
        if (result.success) {
            const successMsg = createStatusMessage('Anmeldung erfolgreich! Weiterleitung...');
            loginForm.appendChild(successMsg);
            
            // Benutzernamen aus dem Result nehmen oder aus der E-Mail extrahieren
            const username = result.user?.username || email.split('@')[0];
            
            // Benutzernamen im localStorage speichern für die Dashboard-Seite
            localStorage.setItem('username', username);
            
            // Weiterleitung zum Dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else if (result.pendingApproval) {
            // Wenn Admin-Login eine Bestätigung erfordert
            const infoMsg = createStatusMessage(result.message || 'Für Admin-Logins ist eine E-Mail-Bestätigung erforderlich. Bitte warte auf die Bestätigungsmail.', false);
            loginForm.appendChild(infoMsg);
        } else {
            const errorMsg = createStatusMessage('Anmeldung fehlgeschlagen: ' + (result.error || 'Ungültige Anmeldedaten'), true);
            loginForm.appendChild(errorMsg);
        }
    } catch (error) {
        console.error('Anmeldefehler:', error);
        const errorMsg = createStatusMessage('Ein Fehler ist aufgetreten: ' + error.message, true);
        loginForm.appendChild(errorMsg);
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
});

// Funktion zum direkten Versenden von E-Mails über Backend
async function sendEmailDirectly(toEmail, username) {
    console.log(`Sende E-Mail an: ${toEmail} für Benutzer: ${username}`);
    
    try {
        // API-Aufruf an unseren Backend-Server
        const response = await fetch('/send-verification-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: toEmail,
                username: username,
                userId: username // In einer echten App würde hier eine UUID verwendet werden
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log("E-Mail erfolgreich gesendet");
            return { success: true };
        } else {
            console.error("E-Mail konnte nicht gesendet werden:", data.error);
            return { success: false, error: data.error || "E-Mail konnte nicht gesendet werden" };
        }
    } catch (error) {
        console.error("Fehler beim Senden der E-Mail:", error);
        return { success: false, error: "E-Mail konnte nicht gesendet werden" };
    }
}
