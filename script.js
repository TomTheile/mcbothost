/**
 * Erstellt eine Statusmeldung (Erfolg oder Fehler) für die Anzeige im Formular
 * @param {string} message - Die anzuzeigende Nachricht
 * @param {boolean} isError - Ob es sich um eine Fehlermeldung handelt (Standard: false)
 * @returns {HTMLElement} - Das erstellte Statusmeldungselement
 */
function createStatusMessage(message, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('status-message');
    
    if (isError) {
        messageDiv.classList.add('error');
    } else {
        messageDiv.classList.add('success');
    }
    
    messageDiv.textContent = message;
    return messageDiv;
}

/**
 * Entfernt alle vorhandenen Statusmeldungen aus einem Formularelement
 * @param {HTMLElement} formElement - Das Formularelement, aus dem die Meldungen entfernt werden sollen
 */
function clearStatusMessages(formElement) {
    const existingMessages = formElement.querySelectorAll('.status-message');
    existingMessages.forEach(message => message.remove());
}

/**
 * Sendet eine E-Mail direkt an den Benutzer (für Testzwecke)
 * @param {string} toEmail - Die E-Mail-Adresse des Empfängers
 * @param {string} username - Der Benutzername des Empfängers
 * @returns {Promise<boolean>} - Erfolgreich oder nicht
 */
async function sendEmailDirectly(toEmail, username) {
    console.log(`Sende E-Mail an ${toEmail} (${username})...`);
    
    // In einer echten Anwendung würde hier eine E-Mail über einen Dienst wie SendGrid gesendet werden
    return new Promise((resolve) => {
        // Simuliere eine Verzögerung von 1 Sekunde
        setTimeout(() => {
            console.log(`E-Mail an ${toEmail} gesendet!`);
            resolve(true);
        }, 1000);
    });
}

/**
 * Überprüft, ob der Benutzer angemeldet ist und leitet ggf. zur Anmeldeseite weiter
 * Diese Funktion sollte auf jeder geschützten Seite aufgerufen werden
 */
function checkAuthentication() {
    const authToken = localStorage.getItem('auth_token');
    const userId = localStorage.getItem('user_id');
    
    if (!authToken || !userId) {
        // Nicht angemeldet, zur Anmeldeseite weiterleiten
        window.location.href = 'index.html';
        return false;
    }
    
    // Benutzerinformationen laden
    const username = localStorage.getItem('username') || 'Benutzer';
    const userRole = localStorage.getItem('user_role') || 'user';
    
    // Benutzernamen anzeigen, falls entsprechendes Element vorhanden
    const usernameElement = document.getElementById('username-display');
    if (usernameElement) {
        usernameElement.textContent = username;
    }
    
    // Admin-Elemente anzeigen/ausblenden, falls vorhanden
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(element => {
        if (userRole === 'admin') {
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    });
    
    return true;
}

/**
 * Meldet den Benutzer ab und leitet zur Anmeldeseite weiter
 */
function logout() {
    // Alle relevanten Daten aus dem lokalen Speicher entfernen
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    localStorage.removeItem('user_role');
    
    // Zur Anmeldeseite weiterleiten
    window.location.href = 'index.html';
}

/**
 * Formatiert ein Datum in ein lesbares Format
 * @param {Date|string} date - Das zu formatierende Datum oder ein Datums-String
 * @returns {string} - Das formatierte Datum
 */
function formatDate(date) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
        return 'Ungültiges Datum';
    }
    
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Formatiert eine Zeitdauer in ein lesbares Format
 * @param {number} durationInSeconds - Die Dauer in Sekunden
 * @returns {string} - Die formatierte Dauer
 */
function formatDuration(durationInSeconds) {
    if (durationInSeconds < 60) {
        return `${durationInSeconds} Sek.`;
    } else if (durationInSeconds < 3600) {
        const minutes = Math.floor(durationInSeconds / 60);
        const seconds = durationInSeconds % 60;
        return `${minutes} Min. ${seconds} Sek.`;
    } else {
        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);
        return `${hours} Std. ${minutes} Min.`;
    }
}

/**
 * Erstellt ein Chart-Element mit Chart.js
 * @param {string} elementId - Die ID des Canvas-Elements
 * @param {string} type - Der Chart-Typ ('line', 'bar', 'pie', etc.)
 * @param {Array} labels - Die Labels für die X-Achse
 * @param {Array} data - Die Datenpunkte
 * @param {Object} options - Zusätzliche Optionen für das Chart
 */
function createChart(elementId, type, labels, data, options = {}) {
    const ctx = document.getElementById(elementId).getContext('2d');
    
    // Standard-Optionen für Chart.js
    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: '#e0e0e0'
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: '#a0a0a0'
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                }
            },
            y: {
                ticks: {
                    color: '#a0a0a0'
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                }
            }
        }
    };
    
    // Optionen zusammenführen
    const chartOptions = { ...defaultOptions, ...options };
    
    // Chart erstellen
    new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: options.label || 'Daten',
                data: data,
                backgroundColor: options.backgroundColor || 'rgba(30, 255, 0, 0.2)',
                borderColor: options.borderColor || '#1eff00',
                borderWidth: 1,
                tension: 0.4
            }]
        },
        options: chartOptions
    });
}

/**
 * Zeigt eine Toast-Benachrichtigung an
 * @param {string} message - Die anzuzeigende Nachricht
 * @param {string} type - Der Typ der Benachrichtigung ('success', 'error', 'warning', 'info')
 * @param {number} duration - Die Anzeigedauer in Millisekunden
 */
function showToast(message, type = 'info', duration = 3000) {
    // Toast-Container erstellen, falls nicht vorhanden
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    // Toast-Element erstellen
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Toast-Styling
    toast.style.backgroundColor = type === 'success' ? 'rgba(0, 255, 0, 0.2)' :
                               type === 'error' ? 'rgba(255, 0, 0, 0.2)' :
                               type === 'warning' ? 'rgba(255, 255, 0, 0.2)' :
                               'rgba(0, 0, 255, 0.2)';
    toast.style.color = type === 'success' ? '#55ff55' :
                     type === 'error' ? '#ff5555' :
                     type === 'warning' ? '#ffff55' :
                     '#5555ff';
    toast.style.padding = '12px 20px';
    toast.style.marginBottom = '10px';
    toast.style.borderRadius = '5px';
    toast.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
    toast.style.borderLeft = `3px solid ${type === 'success' ? '#55ff55' :
                                      type === 'error' ? '#ff5555' :
                                      type === 'warning' ? '#ffff55' :
                                      '#5555ff'}`;
    
    // Toast zum Container hinzufügen
    toastContainer.appendChild(toast);
    
    // Toast-Animation
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    
    // Kurze Verzögerung, um die Animation zu starten
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Toast nach einer bestimmten Zeit ausblenden
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        
        // Toast entfernen, nachdem die Animation abgeschlossen ist
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}