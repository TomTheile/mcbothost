// Beim Laden der Seite prüfen, ob der Benutzer ein Admin ist
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
    setupTabNavigation();
});

// Admin/Console Tab-Navigation einrichten
function setupTabNavigation() {
    const adminPanelTab = document.getElementById('admin-panel-tab');
    const consoleTab = document.getElementById('console-tab');
    const adminPanelContent = document.getElementById('admin-panel-content');
    const consolePanelContent = document.getElementById('console-panel-content');
    
    // Admin-Panel Tab Click-Event
    adminPanelTab.addEventListener('click', () => {
        adminPanelTab.classList.add('active');
        consoleTab.classList.remove('active');
        adminPanelContent.classList.add('active');
        adminPanelContent.style.display = 'block';
        consolePanelContent.classList.remove('active');
        consolePanelContent.style.display = 'none';
    });
    
    // Console Tab Click-Event
    consoleTab.addEventListener('click', () => {
        consoleTab.classList.add('active');
        adminPanelTab.classList.remove('active');
        consolePanelContent.classList.add('active');
        consolePanelContent.style.display = 'block';
        adminPanelContent.classList.remove('active');
        adminPanelContent.style.display = 'none';
    });
}

// Admin-Zugriff überprüfen
async function checkAdminAccess() {
    try {
        // Überprüfen, ob der Benutzer im localStorage gespeichert ist
        const username = localStorage.getItem('username');
        const userEmail = localStorage.getItem('userEmail');
        
        if (!username || !userEmail) {
            redirectToLogin('Du musst dich zuerst anmelden');
            return;
        }
        
        // Benutzer aus dem Server abrufen
        const response = await fetch(`/api/users/get-by-email?email=${encodeURIComponent(userEmail)}`);
        const data = await response.json();
        
        if (!data.success || !data.user || data.user.role !== 'admin') {
            redirectToLogin('Du hast keinen Zugriff auf den Administratorbereich');
            return;
        }
        
        // Admin-Bereich anzeigen
        document.getElementById('admin-username').textContent = username;
        loadDashboardData();
        
    } catch (error) {
        console.error('Fehler beim Überprüfen des Admin-Zugriffs:', error);
        redirectToLogin('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
    }
}

// Weiterleitung zur Login-Seite
function redirectToLogin(message) {
    alert(message);
    window.location.href = 'index.html';
}

// Daten für das Dashboard laden
async function loadDashboardData() {
    try {
        const userEmail = localStorage.getItem('userEmail');
        
        // Statistiken laden
        const statsResponse = await fetch(`/api/admin/stats?admin_email=${encodeURIComponent(userEmail)}`);
        const statsData = await statsResponse.json();
        
        if (statsData.success) {
            document.getElementById('user-count').textContent = statsData.stats.userCount || '0';
            document.getElementById('active-bots').textContent = statsData.stats.activeBots || '0';
            document.getElementById('server-uptime').textContent = statsData.stats.uptime || '0h';
            document.getElementById('logins-today').textContent = statsData.stats.loginsToday || '0';
        }
        
        // Benutzerliste laden
        const usersResponse = await fetch(`/api/admin/users?admin_email=${encodeURIComponent(userEmail)}`);
        const usersData = await usersResponse.json();
        
        if (usersData.success) {
            renderUserList(usersData.users);
            // Event-Listener für Benutzeraktionen hinzufügen
            addUserActionListeners();
        }
        
        // Login-Logs laden
        const logsResponse = await fetch(`/api/admin/logs?admin_email=${encodeURIComponent(userEmail)}`);
        const logsData = await logsResponse.json();
        
        if (logsData.success) {
            renderLogs(logsData.logs);
        }
        
    } catch (error) {
        console.error('Fehler beim Laden der Dashboard-Daten:', error);
        alert('Fehler beim Laden der Dashboard-Daten. Bitte aktualisiere die Seite.');
    }
}

// Event-Listener für Benutzeraktionen hinzufügen
function addUserActionListeners() {
    const userEmail = localStorage.getItem('userEmail');
    
    // Event-Listener für Verifizierungsschaltflächen
    document.querySelectorAll('.verify-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', async () => {
            const targetEmail = btn.getAttribute('data-email');
            
            try {
                const response = await fetch('/api/admin/verify-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        admin_email: userEmail,
                        user_email: targetEmail
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert(data.message);
                    loadDashboardData(); // Dashboard aktualisieren
                } else {
                    alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
                }
            } catch (error) {
                console.error('Fehler beim Verifizieren des Benutzers:', error);
                alert('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
            }
        });
    });
    
    // Event-Listener für Sperr-/Entsperrschaltflächen
    document.querySelectorAll('.ban-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const targetEmail = btn.getAttribute('data-email');
            const isBanned = btn.classList.contains('active');
            
            // Wenn der Benutzer gesperrt werden soll, nach einem Grund fragen
            let banReason = '';
            if (!isBanned) {
                banReason = prompt('Gib bitte einen Grund für die Sperrung ein:');
                if (banReason === null) return; // Benutzer hat abgebrochen
            }
            
            try {
                const response = await fetch('/api/admin/toggle-ban', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        admin_email: userEmail,
                        user_email: targetEmail,
                        ban_status: !isBanned,
                        ban_reason: banReason
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert(data.message);
                    loadDashboardData(); // Dashboard aktualisieren
                } else {
                    alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
                }
            } catch (error) {
                console.error('Fehler beim Ändern des Sperrstatus:', error);
                alert('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
            }
        });
    });
}

// Benutzerliste rendern
function renderUserList(users) {
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    
    // Mit echten Benutzerdaten arbeiten
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        
        // Banngrund-Text erstellen, wenn der Benutzer gesperrt ist
        const banReasonText = user.banned && user.ban_reason 
            ? `<div style="font-size: 0.8rem; color: #ff3838;">Grund: ${user.ban_reason}</div>` 
            : '';
        
        userItem.innerHTML = `
            <div class="user-info">
                <strong>${user.username}</strong> (${user.email})
                <div style="font-size: 0.8rem; color: #a0a0a0;">
                    Rolle: ${user.role === 'admin' ? 'Administrator' : 'Benutzer'} | 
                    Status: ${user.verified ? 'Verifiziert' : 'Nicht verifiziert'}
                    ${user.banned ? ' | <span style="color: #ff3838;">Gesperrt</span>' : ''}
                </div>
                ${banReasonText}
            </div>
            <div class="user-actions">
                <button class="verify-btn" data-email="${user.email}" ${user.verified ? 'disabled' : ''}>
                    ${user.verified ? 'Verifiziert' : 'Verifizieren'}
                </button>
                <button class="ban-btn ${user.banned ? 'active' : ''}" data-email="${user.email}">
                    ${user.banned ? 'Entsperren' : 'Sperren'}
                </button>
            </div>
        `;
        userList.appendChild(userItem);
    });
}

// Logs rendern
function renderLogs(logs) {
    const logsList = document.getElementById('login-logs');
    logsList.innerHTML = '';
    
    // Echte Logs anzeigen
    if (logs && logs.length > 0) {
        logs.forEach(log => {
            const logItem = document.createElement('div');
            logItem.className = 'log-item';
            logItem.innerHTML = `
                <strong>${log.date}</strong> - Benutzer <span>${log.username}</span> hat sich angemeldet
                ${log.ip ? `<div style="font-size: 0.8rem; color: #777;">IP: ${log.ip}</div>` : ''}
            `;
            logsList.appendChild(logItem);
        });
    } else {
        // Fallback, wenn keine Logs vorhanden sind
        logsList.innerHTML = '<div class="log-item">Keine Login-Protokolle vorhanden</div>';
    }
}

// Tab-Wechsel-Funktion
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        // Alle Tabs deaktivieren
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Alle Tab-Inhalte ausblenden
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        // Angeklickten Tab aktivieren
        button.classList.add('active');
        
        // Entsprechenden Tab-Inhalt anzeigen
        const tabId = button.getAttribute('data-tab');
        document.getElementById(tabId).style.display = 'flex';
        
        // Bot-Tab-Daten laden, wenn Bot-Tab geöffnet wird
        if (tabId === 'bot-tab') {
            loadBotData();
        }
    });
});

// Bot-Daten laden (für den Bot-Tab)
function loadBotData() {
    // Simulierte Daten für die Demonstration
    document.getElementById('total-bots').textContent = '5';
    document.getElementById('connected-bots').textContent = '2';
    document.getElementById('servers-count').textContent = '2';
    document.getElementById('total-uptime').textContent = '24h';
    
    // In einer echten Anwendung würden wir hier Daten vom Server laden
}

// Abmelden-Link
document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('username');
    localStorage.removeItem('userEmail');
    window.location.href = 'index.html';
});
