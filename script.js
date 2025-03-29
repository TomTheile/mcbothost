// Hilfsfunktionen für die gesamte Anwendung

// Status-Nachricht erstellen (Erfolg oder Fehler)
function createStatusMessage(message, isError = false) {
    const statusElement = document.createElement('div');
    statusElement.classList.add('status-message');
    
    if (isError) {
        statusElement.classList.add('error-message');
    } else {
        statusElement.classList.add('success-message');
    }
    
    statusElement.textContent = message;
    
    // Nach 5 Sekunden automatisch entfernen
    setTimeout(() => {
        statusElement.classList.add('fade-out');
        setTimeout(() => {
            statusElement.remove();
        }, 500);
    }, 5000);
    
    return statusElement;
}

// Status-Nachrichten entfernen
function clearStatusMessages(formElement) {
    const existingMessages = formElement.querySelectorAll('.status-message');
    existingMessages.forEach(message => message.remove());
}

// E-Mail direkt senden (Simulation)
async function sendEmailDirectly(toEmail, username) {
    try {
        // Simulierte Verzögerung für die Netzwerkanfrage
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`E-Mail würde gesendet werden an: ${toEmail} für User: ${username}`);
        
        // Erfolgreiche Simulation
        return {
            success: true,
            message: "E-Mail wurde erfolgreich gesendet!"
        };
    } catch (error) {
        console.error("Fehler beim Senden der E-Mail:", error);
        
        return {
            success: false,
            error: "Fehler beim Senden der E-Mail."
        };
    }
}
