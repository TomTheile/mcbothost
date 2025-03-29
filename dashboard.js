// Dashboard Funktionalität

// DOM-Elemente
const usernameElement = document.getElementById('username');
const botStatusElement = document.getElementById('bot-status');
const serverIpInput = document.getElementById('server-ip');
const botNameInput = document.getElementById('bot-name');
const mcVersionSelect = document.getElementById('mc-version');
const startBotButton = document.getElementById('start-bot');
const stopBotButton = document.getElementById('stop-bot');
const consoleWindow = document.getElementById('console-window');
const clearConsoleButton = document.getElementById('clear-console');
const commandInput = document.getElementById('command-input');
const sendCommandButton = document.getElementById('send-command');
const onlineTimeElement = document.getElementById('online-time');
const positionElement = document.getElementById('position');
const healthFill = document.getElementById('health-fill');
const healthValue = document.getElementById('health-value');
const foodFill = document.getElementById('food-fill');
const foodValue = document.getElementById('food-value');

// Admin-Elemente
const adminModeButton = document.getElementById('admin-mode-btn');
const adminPanel = document.getElementById('admin-panel');
const adminOverlay = document.getElementById('admin-overlay');
const closeAdminButton = document.getElementById('close-admin');
const userListContainer = document.getElementById('user-list-container');
const warnEmailInput = document.getElementById('warn-email');
const warnReasonInput = document.getElementById('warn-reason');
const submitWarningButton = document.getElementById('submit-warning');
const banEmailInput = document.getElementById('ban-email');
const banReasonInput = document.getElementById('ban-reason');
const submitBanButton = document.getElementById('submit-ban');

// Globaler Status
let isAdmin = false;
let adminMode = false;

// Benutzerdaten abrufen und Auth prüfen
const loadUserData = () => {
    // Auth-Token abrufen
    const token = localStorage.getItem('auth_token');
    const username = localStorage.getItem('username');
    const userId = localStorage.getItem('user_id');
    
    // Prüfen, ob der Benutzer eingeloggt ist
    if (!token || !username || !userId) {
        // Nicht eingeloggt, zum Login umleiten
        console.log('Nicht eingeloggt - Weiterleitung zum Login');
        window.location.href = 'index.html';
        return;
    }
    
    // Token validieren und Benutzerdaten abrufen
    fetch('/api/users/validate-token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, token })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Token gültig, Benutzerdaten anzeigen
            usernameElement.textContent = username;
            
            // Prüfen, ob Benutzer Admin-Rechte hat
            const userRole = data.user.role;
            localStorage.setItem('user_role', userRole);
            
            if (userRole === 'admin') {
                isAdmin = true;
                adminModeButton.style.display = 'block';
            }
            
            // Prüfen, ob Benutzer einen aktiven Bot hat
            if (data.user.has_active_bot && data.active_bot) {
                // Bot ist bereits aktiv, fülle die Felder aus und aktualisiere den Bot-Status
                serverIpInput.value = data.active_bot.server_ip || '';
                mcVersionSelect.value = data.active_bot.mc_version || '1.21.4';
                botNameInput.value = data.active_bot.bot_name || `${username}_Bot`;
                
                // Bot-Status auf "active" setzen
                botStatusElement.textContent = 'Online';
                botStatusElement.className = 'status-online';
                
                // Start-Button deaktivieren, Stop-Button aktivieren
                startBotButton.disabled = true;
                stopBotButton.disabled = false;
                commandInput.disabled = false;
                sendCommandButton.disabled = false;
                
                // Konsole aktualisieren
                addConsoleMessage(`System > Bot ist bereits aktiv und verbunden mit ${data.active_bot.server_ip}`, 'success');
                
                // Bot-Status-Polling starten
                onBotConnected();
            } else {
                // Vorausfüllen des Bot-Namens mit dem Benutzernamen + "_Bot"
                botNameInput.value = `${username}_Bot`;
                
                // Bot ist nicht aktiv, normale Startseite anzeigen
                botStatusElement.textContent = 'Offline';
                botStatusElement.className = 'status-offline';
                
                // Start-Button aktivieren, Stop-Button deaktivieren
                startBotButton.disabled = false;
                stopBotButton.disabled = true;
                commandInput.disabled = true;
                sendCommandButton.disabled = true;
            }
        } else {
            // Token ungültig, zum Login umleiten
            console.log('Ungültiger Token - Weiterleitung zum Login');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('username');
            localStorage.removeItem('user_id');
            window.location.href = 'index.html';
        }
    })
    .catch(error => {
        console.error('Fehler bei der Token-Validierung:', error);
        
        // Bei Fehlern trotzdem Benutzerdaten anzeigen, um Benutzerfreundlichkeit zu erhalten
        usernameElement.textContent = username;
        botNameInput.value = `${username}_Bot`;
        
        // Warnung im Konsolenfenster anzeigen
        addConsoleMessage('System > Verbindungsprobleme beim Authentifizieren, einige Funktionen könnten eingeschränkt sein', 'warning');
    });
};

// Konsolen-Nachricht hinzufügen
const addConsoleMessage = (message, type = 'normal') => {
    const line = document.createElement('div');
    line.classList.add('console-line');

    if (type !== 'normal') {
        line.classList.add(`console-${type}`);
    }

    line.textContent = message;
    consoleWindow.appendChild(line);

    // Automatisches Scrollen zum Ende der Konsole
    consoleWindow.scrollTop = consoleWindow.scrollHeight;
};

// Konsolenfenster löschen
clearConsoleButton.addEventListener('click', () => {
    consoleWindow.innerHTML = '';
    addConsoleMessage('System > Konsole wurde gelöscht');
});

// Bot-Start-Logik
startBotButton.addEventListener('click', () => {
    const serverIp = serverIpInput.value.trim();
    const mcVersion = mcVersionSelect.value;

    // Validierung
    if (!serverIp) {
        addConsoleMessage('System > Bitte gib eine Server-IP ein!', 'error');
        return;
    }

    // Buttons und Elemente aktualisieren
    startBotButton.disabled = true;
    stopBotButton.disabled = false;
    commandInput.disabled = false;
    sendCommandButton.disabled = false;

    botStatusElement.textContent = 'Verbinden...';

    // Authentifizierungstoken abrufen
    const token = localStorage.getItem('auth_token');
    
    // Anfrage an den Server senden, um den echten Minecraft-Bot zu starten
    fetch('/api/minecraft/start-bot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            username: localStorage.getItem('username'),
            userId: localStorage.getItem('user_id'),
            serverIp: serverIp,
            mcVersion: mcVersion,
            botName: botNameInput.value || `${localStorage.getItem('username')}_Bot` // Benutzerdefinierten Bot-Namen hinzufügen
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Erfolgreich verbunden
            botStatusElement.textContent = 'Online';
            botStatusElement.className = 'status-online';

            addConsoleMessage(`System > Verbindung zum Bot hergestellt`, 'success');
            addConsoleMessage(`Bot > Verbinde mit ${serverIp} (Minecraft ${mcVersion})...`);

            // Nach einer kurzen Verzögerung wird die Verbindung zum Server simuliert
            setTimeout(() => {
                addConsoleMessage(`Bot > Erfolgreich mit dem Server verbunden!`, 'success');
                addConsoleMessage(`Bot > Spielername: ${data.botName}`); // Use botName from server response
                addConsoleMessage(`Server > Willkommen auf dem Server, ${data.botName}!`);

                // Starte Timer und Bot-Simulation
                startBotSimulation();
                
                // Status-Polling starten
                onBotConnected();
            }, 1500);
        } else {
            // Fehler beim Verbinden
            botStatusElement.textContent = 'Fehler';
            botStatusElement.className = 'status-error';

            // Benutzerfreundliche Fehlermeldung hinzufügen
            addConsoleMessage(`System > ⚠️ Problem mit der Verbindung zum Bot-Server: ${data.error}`, 'error');
            
            // Tipps zur Fehlerbehebung hinzufügen mit detaillierten Schritten
            if (data.error.includes('offline') || data.error.includes('blockiert') || data.error.includes('Verbindung') || 
                data.error.includes('zurückgesetzt') || data.error.includes('nicht gefunden')) {
                
                addConsoleMessage(`System > ⚠️ Hilfe zur Fehlerbehebung:`, 'info');
                
                // Allgemeine Tipps
                addConsoleMessage(`System > 1️⃣ Überprüfe, ob der Minecraft-Server online ist:`, 'info');
                addConsoleMessage(`System >    • Starte Minecraft und versuche selbst, dich mit dem Server zu verbinden`, 'info');
                addConsoleMessage(`System >    • Prüfe auf der Server-Webseite, ob Wartungsarbeiten stattfinden`, 'info');
                
                // IP-Adresse und Port
                addConsoleMessage(`System > 2️⃣ Prüfe die Server-IP und den Port:`, 'info');
                addConsoleMessage(`System >    • Achte auf Tippfehler in der IP-Adresse`, 'info');
                addConsoleMessage(`System >    • Füge den Port hinzu, falls erforderlich (z.B. mc.server.net:25565)`, 'info');
                
                // Version
                addConsoleMessage(`System > 3️⃣ Wähle die richtige Minecraft-Version:`, 'info');
                addConsoleMessage(`System >    • Die meisten Server funktionieren mit der ausgewählten Version`, 'info');
                addConsoleMessage(`System >    • Für ältere Server wähle 1.8, 1.12 oder 1.16`, 'info');
                
                // Premium-Accounts
                if (data.error.includes('Authentifizierung') || data.error.includes('Premium')) {
                    addConsoleMessage(`System > 4️⃣ Der Server erlaubt nur Premium-Accounts:`, 'warning');
                    addConsoleMessage(`System >    • Aktuell unterstützt der Bot nur Server im Offline-Modus`, 'warning');
                    addConsoleMessage(`System >    • Versuche einen anderen Server, der Cracked/Offline-Accounts erlaubt`, 'warning');
                }
            }
            
            startBotButton.disabled = false;
            stopBotButton.disabled = true;
            commandInput.disabled = true;
            sendCommandButton.disabled = true;
        }
    })
    .catch(error => {
        console.error('Fehler bei der Server-Anfrage:', error);

        // Fehler beim Verbinden
        botStatusElement.textContent = 'Fehler';
        botStatusElement.className = 'status-error';

        addConsoleMessage(`System > ⚠️ Problem mit der Verbindung zum Bot-Server`, 'error');
        
        // Allgemeine Tipps bei Serverproblemen mit visueller Verbesserung
        addConsoleMessage(`System > 1️⃣ Überprüfe deine Internetverbindung:`, 'info');
        addConsoleMessage(`System >    • Stelle sicher, dass du online bist`, 'info');
        addConsoleMessage(`System >    • Versuche eine andere Webseite zu öffnen`, 'info');
        
        addConsoleMessage(`System > 2️⃣ Serverstatus:`, 'info');
        addConsoleMessage(`System >    • Der Herobrine AFK Bot Server könnte gerade neu starten`, 'info');
        addConsoleMessage(`System >    • Eventuell gibt es Wartungsarbeiten am Server`, 'info');
        
        addConsoleMessage(`System > 3️⃣ Lösungsvorschläge:`, 'info');
        addConsoleMessage(`System >    • Aktualisiere die Seite (F5 drücken)`, 'info');
        addConsoleMessage(`System >    • Warte kurz und versuche es dann erneut`, 'info');
        
        startBotButton.disabled = false;
        stopBotButton.disabled = true;
        commandInput.disabled = true;
        sendCommandButton.disabled = true;
    });
});

// Bot-Stop-Logik
stopBotButton.addEventListener('click', () => {
    stopBotButton.disabled = true;
    commandInput.disabled = true;
    sendCommandButton.disabled = true;

    addConsoleMessage(`System > Bot wird gestoppt...`, 'warning');

    // Authentifizierungstoken abrufen
    const token = localStorage.getItem('auth_token');
    
    // Echten Bot über Server-API stoppen
    fetch('/api/minecraft/stop-bot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            username: localStorage.getItem('username'),
            userId: localStorage.getItem('user_id'),
            serverIp: serverIpInput.value
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Erfolgreich getrennt
            botStatusElement.textContent = 'Offline';
            botStatusElement.className = 'status-offline';

            // Status-Attribute zurücksetzen
            botStatusElement.removeAttribute('data-reconnected');
            consoleOutput.removeAttribute('data-log-count');

            addConsoleMessage(`System > Bot wurde erfolgreich gestoppt`, 'success');
            startBotButton.disabled = false;

            // Bot-Simulation stoppen
            stopBotSimulation();
            
            // Status-Polling stoppen
            onBotDisconnected();
        } else {
            // Fehler beim Trennen
            botStatusElement.textContent = 'Fehler';
            botStatusElement.className = 'status-error';

            addConsoleMessage(`System > Fehler beim Stoppen des Bots: ${data.error}`, 'error');
            stopBotButton.disabled = false;
        }
    })
    .catch(error => {
        console.error('Fehler bei der Server-Anfrage:', error);

        // Fehler beim Trennen, trotzdem Interface zurücksetzen
        botStatusElement.textContent = 'Offline';
        botStatusElement.className = 'status-offline';

        // Status-Attribute zurücksetzen
        botStatusElement.removeAttribute('data-reconnected');
        consoleOutput.removeAttribute('data-log-count');

        addConsoleMessage(`System > Fehler bei der Server-Anfrage: ${error.message}`, 'error');
        addConsoleMessage(`System > Bot wurde lokal gestoppt`, 'warning');
        startBotButton.disabled = false;

        // Bot-Simulation stoppen
        stopBotSimulation();
        
        // Status-Polling stoppen
        onBotDisconnected();
    });
});

// Befehl senden Logik
sendCommandButton.addEventListener('click', sendCommand);
commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendCommand();
    }
});

function sendCommand() {
    const command = commandInput.value.trim();

    if (!command) return;

    addConsoleMessage(`> ${command}`);

    // Befehlsverarbeitung simulieren
    processCommand(command);

    // Authentifizierungstoken abrufen
    const token = localStorage.getItem('auth_token');
    
    // Sende den Befehl an den Server, der ihn an den Bot weiterleitet
    fetch('/api/minecraft/send-command', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            command: command,
            username: localStorage.getItem('username'),
            userId: localStorage.getItem('user_id'),
            serverIp: serverIpInput.value
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.error('Fehler beim Senden des Befehls:', data.error);
            addConsoleMessage('System > Fehler beim Senden des Befehls: ' + data.error, 'error');
        }
    })
    .catch(error => {
        console.error('Fehler bei der Server-Anfrage:', error);
        addConsoleMessage('System > Fehler bei der Server-Anfrage: ' + error.message, 'error');
    });

    // Eingabefeld leeren
    commandInput.value = '';
}

// Befehlsverarbeitung (Simulation)
function processCommand(command) {
    const lowerCommand = command.toLowerCase();

    // Simulierte Befehlsantworten
    if (lowerCommand === 'help') {
        addConsoleMessage(`Bot > Verfügbare Befehle:`);
        addConsoleMessage(`Bot > help - Zeigt diese Hilfe`);
        addConsoleMessage(`Bot > status - Zeigt den Bot-Status`);
        addConsoleMessage(`Bot > jump - Lässt den Bot springen`);
        addConsoleMessage(`Bot > say <nachricht> - Sendet eine Nachricht im Chat`);
    } else if (lowerCommand === 'status') {
        addConsoleMessage(`Bot > Status: Online`);
        addConsoleMessage(`Bot > Position: ${positionElement.textContent}`);
        addConsoleMessage(`Bot > Gesundheit: ${healthValue.textContent}`);
        addConsoleMessage(`Bot > Nahrung: ${foodValue.textContent}`);
    } else if (lowerCommand === 'jump') {
        addConsoleMessage(`Bot > Springe...`, 'info');
        setTimeout(() => {
            addConsoleMessage(`Bot > Sprung ausgeführt`);
        }, 500);
    } else if (lowerCommand.startsWith('say ')) {
        const message = command.substring(4);
        addConsoleMessage(`Bot > Sende: "${message}"`);
        setTimeout(() => {
            addConsoleMessage(`Chat > ${botNameInput.value}: ${message}`);
        }, 300);
    } else {
        addConsoleMessage(`Bot > Unbekannter Befehl: ${command}`, 'error');
        addConsoleMessage(`Bot > Gib 'help' ein für eine Liste der verfügbaren Befehle`);
    }
}

// Bot-Simulation
let botInterval;
let startTime;
let onlineTimeInterval;

function startBotSimulation() {
    startTime = new Date();

    // Online-Zeit-Aktualisierung
    onlineTimeInterval = setInterval(updateOnlineTime, 1000);

    // Bot-Status-Aktualisierung
    botInterval = setInterval(() => {
        // Zufällige Position
        const x = Math.max(-30000000, Math.min(30000000, Math.floor(Math.random() * 200 - 100)));
        const y = Math.max(0, Math.min(256, Math.floor(Math.random() * 20 + 60)));
        const z = Math.max(-30000000, Math.min(30000000, Math.floor(Math.random() * 200 - 100)));
        positionElement.textContent = `X: ${x} Y: ${y} Z: ${z}`;

        // Zufällige Gesundheit (zwischen 10 und 20)
        const health = Math.floor(Math.random() * 11 + 10);
        const healthPercent = (health / 20) * 100;
        healthFill.style.width = `${healthPercent}%`;
        healthValue.textContent = `${health}/20`;

        // Zufällige Nahrung (zwischen 10 und 20)
        const food = Math.floor(Math.random() * 11 + 10);
        const foodPercent = (food / 20) * 100;
        foodFill.style.width = `${foodPercent}%`;
        foodValue.textContent = `${food}/20`;

        // Zufällige Konsolen-Nachrichten
        if (Math.random() < 0.3) {
            const messages = [
                "Bot > Bewege mich...",
                "Server > Die Sonne geht auf",
                "Bot > Kein Spieler in der Nähe",
                "Bot > Warte auf Events...",
                "Chat > Spieler1: Hallo zusammen!",
                "Chat > Spieler2: Hat jemand Diamanten?",
                "Server > Ein Zombie nähert sich",
                "Bot > Springe über ein Hindernis"
            ];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            addConsoleMessage(randomMessage);
        }
    }, 3000);
}

function stopBotSimulation() {
    clearInterval(botInterval);
    clearInterval(onlineTimeInterval);

    // Reset der Statistiken
    positionElement.textContent = "X: 0 Y: 0 Z: 0";
    healthFill.style.width = "100%";
    healthValue.textContent = "20/20";
    foodFill.style.width = "100%";
    foodValue.textContent = "20/20";
    onlineTimeElement.textContent = "00:00:00";
}

function updateOnlineTime() {
    if (!startTime) return;

    const now = new Date();
    const diff = now - startTime;

    // Millisekunden in Stunden, Minuten, Sekunden umrechnen
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Formatierung mit führenden Nullen
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');

    onlineTimeElement.textContent = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

// Automatischer Status-Abruf vom Server alle 10 Sekunden
let statusInterval;

function startStatusPolling() {
    // Sofort einmal ausführen
    fetchBotStatus();
    
    // Dann jede Sekunde wiederholen für Echtzeit-Updates
    statusInterval = setInterval(fetchBotStatus, 1000);
}

function stopStatusPolling() {
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }
}

// Status-Abruf vom Server
function fetchBotStatus() {
    // Auch prüfen, wenn der Bot nicht als Online angezeigt wird, da er möglicherweise
    // automatisch neu verbunden wurde
    const token = localStorage.getItem('auth_token');
    const username = localStorage.getItem('username');
    
    fetch(`/api/minecraft/bot-status?username=${encodeURIComponent(username)}&userId=${encodeURIComponent(localStorage.getItem('user_id'))}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.active) {
                    // Bot ist online - Buttons aktualisieren, falls nötig
                    startBotButton.disabled = true;
                    stopBotButton.disabled = false;
                    commandInput.disabled = false;
                    sendCommandButton.disabled = false;
                    
                    // Status auf Online setzen, falls er es noch nicht ist
                    if (botStatusElement.textContent !== 'Online') {
                        botStatusElement.textContent = 'Online';
                        botStatusElement.className = 'status-online';
                    }
                    
                    // Wiederverbindungsversuche anzeigen, wenn vorhanden
                    if (data.reconnectAttempts && data.reconnectAttempts > 0) {
                        const currentAttempts = parseInt(botStatusElement.getAttribute('data-reconnect-attempts') || '0');
                        if (data.reconnectAttempts > currentAttempts) {
                            // Nur bei neuen Wiederverbindungsversuchen eine Meldung anzeigen
                            addConsoleMessage(`System > Wiederverbindungsversuch ${data.reconnectAttempts}/10`, 'warning');
                            botStatusElement.setAttribute('data-reconnect-attempts', data.reconnectAttempts.toString());
                        }
                    }
                    
                    // Bot ist online, Status aktualisieren
                    healthFill.style.width = `${(data.health / 20) * 100}%`;
                    healthValue.textContent = `${data.health}/20`;
                    
                    foodFill.style.width = `${(data.food / 20) * 100}%`;
                    foodValue.textContent = `${data.food}/20`;
                    
                    positionElement.textContent = `X: ${data.position.x} Y: ${data.position.y} Z: ${data.position.z}`;
                } else {
                    // Bot ist nicht mehr aktiv
                    if (botStatusElement.textContent === 'Online') {
                        botStatusElement.textContent = 'Offline';
                        botStatusElement.className = 'status-offline';
                        
                        addConsoleMessage('System > Bot ist nicht mehr verbunden', 'warning');
                        
                        // Buttons aktualisieren
                        startBotButton.disabled = false;
                        stopBotButton.disabled = true;
                        commandInput.disabled = true;
                        sendCommandButton.disabled = true;
                        
                        // Status-Polling stoppen
                        onBotDisconnected();
                    }
                }
                
                // Wenn wir zusätzliche Informationen haben
                if (data.playerCount !== undefined) {
                    const playerCountElement = document.getElementById('player-count');
                    if (playerCountElement) {
                        playerCountElement.textContent = data.playerCount;
                    }
                }
                
                if (data.dimension) {
                    const dimensionElement = document.getElementById('dimension');
                    if (dimensionElement) {
                        dimensionElement.textContent = data.dimension;
                    }
                }
                
                if (data.serverName) {
                    const serverTypeElement = document.getElementById('server-type');
                    if (serverTypeElement) {
                        serverTypeElement.textContent = data.serverName;
                    }
                }
                
                // Überprüfe, ob eine Wiederverbindung stattgefunden hat
                if (data.reconnected && !botStatusElement.hasAttribute('data-reconnected')) {
                    addConsoleMessage(`System > Bot wurde automatisch neu verbunden!`, 'success');
                    botStatusElement.setAttribute('data-reconnected', 'true');
                }
                
                // Wenn wir Bot-Logs vom Server haben, diese zur Konsole hinzufügen
                if (data.logs && Array.isArray(data.logs)) {
                    // Speichere die aktuelle Anzahl von Logs
                    const currentLogCount = parseInt(consoleOutput.getAttribute('data-log-count') || '0');
                    // Wenn wir neue Logs haben
                    if (data.logs.length > currentLogCount) {
                        // Füge nur die neuen Logs hinzu
                        for (let i = currentLogCount; i < data.logs.length; i++) {
                            const log = data.logs[i];
                            // Konvertiere den Typ vom Log in einen passenden Konsolen-Typ
                            let consoleType = 'info'; // Standard
                            
                            if (log.type === 'error') consoleType = 'error';
                            else if (log.type === 'warning') consoleType = 'warning';
                            else if (log.type === 'success') consoleType = 'success';
                            else if (log.type === 'chat') consoleType = 'chat';
                            
                            // Zeige den Log-Eintrag in der Konsole an
                            addConsoleMessage(`${log.message}`, consoleType);
                        }
                        // Aktualisiere die Anzahl der Logs, die wir bereits angezeigt haben
                        consoleOutput.setAttribute('data-log-count', data.logs.length.toString());
                    }
                }
            } else {
                // Bot ist offline oder nicht verbunden
                if (botStatusElement.textContent === 'Online') {
                    botStatusElement.textContent = 'Verbindung trennen...';
                    botStatusElement.className = 'status-warning';
                    
                    addConsoleMessage(`System > Verbindung zum Bot verloren: ${data.error}`, 'warning');
                    addConsoleMessage(`System > Versuche automatisch neu zu verbinden...`, 'info');
                    
                    // Nicht sofort die Steuerelemente zurücksetzen, da wir automatische Wiederverbindung versuchen
                    // Wir warten stattdessen bis zu 30 Sekunden
                    setTimeout(() => {
                        // Erneut den Status abrufen, um zu sehen, ob die Wiederverbindung erfolgreich war
                        const token = localStorage.getItem('auth_token');
                        fetch(`/api/minecraft/bot-status?username=${encodeURIComponent(localStorage.getItem('username'))}&userId=${encodeURIComponent(localStorage.getItem('user_id'))}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        })
                            .then(response => response.json())
                            .then(reconnectData => {
                                if (reconnectData.success) {
                                    // Wiederverbindung erfolgreich
                                    botStatusElement.textContent = 'Online';
                                    botStatusElement.className = 'status-online';
                                    botStatusElement.setAttribute('data-reconnected', 'true');
                                    addConsoleMessage(`System > Bot wurde automatisch neu verbunden!`, 'success');
                                } else {
                                    // Wiederverbindung fehlgeschlagen
                                    botStatusElement.textContent = 'Offline';
                                    botStatusElement.className = 'status-offline';
                                    
                                    addConsoleMessage(`System > Automatische Wiederverbindung fehlgeschlagen`, 'error');
                                    
                                    // Steuerelemente zurücksetzen
                                    startBotButton.disabled = false;
                                    stopBotButton.disabled = true;
                                    commandInput.disabled = true;
                                    sendCommandButton.disabled = true;
                                    
                                    // Status-Attribute zurücksetzen
                                    botStatusElement.removeAttribute('data-reconnected');
                                    consoleOutput.removeAttribute('data-log-count');
                                    
                                    // Intervall löschen
                                    stopStatusPolling();
                                }
                            })
                            .catch(error => {
                                console.error('Fehler beim Abrufen des Bot-Status nach Wiederverbindungsversuch:', error);
                                
                                // Steuerelemente zurücksetzen
                                botStatusElement.textContent = 'Offline';
                                botStatusElement.className = 'status-offline';
                                startBotButton.disabled = false;
                                stopBotButton.disabled = true;
                                commandInput.disabled = true;
                                sendCommandButton.disabled = true;
                                
                                // Status-Attribute zurücksetzen
                                botStatusElement.removeAttribute('data-reconnected');
                                consoleOutput.removeAttribute('data-log-count');
                                
                                // Intervall löschen
                                stopStatusPolling();
                            });
                    }, 25000); // 25 Sekunden warten auf die automatische Wiederverbindung
                }
            }
        })
        .catch(error => {
            console.error('Fehler beim Abrufen des Bot-Status:', error);
        });
}

// Wenn Bot erfolgreich verbunden wird, Status-Polling starten
function onBotConnected() {
    startStatusPolling();
}

// Wenn Bot gestoppt wird, Status-Polling stoppen
function onBotDisconnected() {
    stopStatusPolling();
}

// Admin-Funktionen
function loadAdminPanel() {
    if (!isAdmin) return;
    
    const token = localStorage.getItem('auth_token');
    
    // Benutzerliste abrufen
    fetch('/api/admin/users', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Benutzerliste anzeigen
            renderUserList(data.users);
        } else {
            userListContainer.innerHTML = `<p class="console-error">Fehler beim Laden der Benutzerliste: ${data.error}</p>`;
        }
    })
    .catch(error => {
        console.error('Fehler beim Abrufen der Benutzerliste:', error);
        userListContainer.innerHTML = `<p class="console-error">Fehler bei der Server-Anfrage: ${error.message}</p>`;
    });
}

// Benutzerliste anzeigen
function renderUserList(users) {
    if (!users || users.length === 0) {
        userListContainer.innerHTML = '<p>Keine Benutzer gefunden.</p>';
        return;
    }
    
    const userList = document.createElement('ul');
    userList.className = 'user-list';
    
    users.forEach(user => {
        const userItem = document.createElement('li');
        userItem.className = 'user-item';
        if (user.banned) {
            userItem.classList.add('banned');
        }
        
        // Benutzer-Infos anzeigen
        userItem.innerHTML = `
            <div class="user-info-item">
                <span class="user-info-label">Benutzername:</span>
                <span>${user.username}</span>
            </div>
            <div class="user-info-item">
                <span class="user-info-label">E-Mail:</span>
                <span>${user.email}</span>
            </div>
            <div class="user-info-item">
                <span class="user-info-label">Status:</span>
                <span>
                    ${user.role === 'admin' ? '<span class="admin-badge badge-admin">Admin</span>' : ''}
                    ${user.banned ? '<span class="admin-badge badge-banned">Gesperrt</span>' : 'Aktiv'}
                    ${!user.verified ? '<span class="admin-badge">Unbestätigt</span>' : ''}
                    ${user.warnings > 0 ? `<span class="admin-badge badge-warning">${user.warnings} Verwarnungen</span>` : ''}
                </span>
            </div>
            <div class="user-actions">
                ${!user.banned ? 
                `<button class="user-action-btn btn-warn" data-email="${user.email}">Verwarnen</button>
                <button class="user-action-btn btn-ban" data-email="${user.email}">Sperren</button>` : 
                `<button class="user-action-btn btn-unban" data-email="${user.email}">Entsperren</button>`}
            </div>
        `;
        
        userList.appendChild(userItem);
    });
    
    userListContainer.innerHTML = '';
    userListContainer.appendChild(userList);
    
    // Event-Listener für Buttons hinzufügen
    document.querySelectorAll('.btn-warn').forEach(button => {
        button.addEventListener('click', () => {
            warnEmailInput.value = button.getAttribute('data-email');
        });
    });
    
    document.querySelectorAll('.btn-ban').forEach(button => {
        button.addEventListener('click', () => {
            banEmailInput.value = button.getAttribute('data-email');
        });
    });
    
    document.querySelectorAll('.btn-unban').forEach(button => {
        button.addEventListener('click', () => {
            const email = button.getAttribute('data-email');
            if (confirm(`Möchtest du den Benutzer ${email} wirklich entsperren?`)) {
                unbanUser(email);
            }
        });
    });
}

// Benutzer sperren
function banUser(email, reason) {
    if (!email || !reason) {
        alert('E-Mail und Grund sind erforderlich');
        return;
    }
    
    const token = localStorage.getItem('auth_token');
    
    fetch('/api/admin/user/ban', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, reason })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`Benutzer ${email} wurde gesperrt.`);
            // Admin-Panel neu laden
            loadAdminPanel();
            // Eingabefelder leeren
            banEmailInput.value = '';
            banReasonInput.value = '';
        } else {
            alert(`Fehler beim Sperren des Benutzers: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Fehler bei der Server-Anfrage:', error);
        alert(`Fehler bei der Server-Anfrage: ${error.message}`);
    });
}

// Benutzer entsperren
function unbanUser(email) {
    if (!email) return;
    
    const token = localStorage.getItem('auth_token');
    
    fetch('/api/admin/user/unban', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`Benutzer ${email} wurde entsperrt.`);
            // Admin-Panel neu laden
            loadAdminPanel();
        } else {
            alert(`Fehler beim Entsperren des Benutzers: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Fehler bei der Server-Anfrage:', error);
        alert(`Fehler bei der Server-Anfrage: ${error.message}`);
    });
}

// Benutzer verwarnen
function warnUser(email, reason) {
    if (!email || !reason) {
        alert('E-Mail und Grund sind erforderlich');
        return;
    }
    
    const token = localStorage.getItem('auth_token');
    
    fetch('/api/admin/user/warn', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, reason })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (data.auto_banned) {
                alert(`Benutzer ${email} wurde verwarnt und automatisch gesperrt (5 Verwarnungen).`);
            } else {
                alert(`Benutzer ${email} wurde verwarnt.`);
            }
            // Admin-Panel neu laden
            loadAdminPanel();
            // Eingabefelder leeren
            warnEmailInput.value = '';
            warnReasonInput.value = '';
        } else {
            alert(`Fehler beim Verwarnen des Benutzers: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Fehler bei der Server-Anfrage:', error);
        alert(`Fehler bei der Server-Anfrage: ${error.message}`);
    });
}

// Event-Listener für Admin-Funktionen
// Admin-Modus-Button
if (adminModeButton) {
    adminModeButton.addEventListener('click', () => {
        if (!adminPanel) return;
        
        adminMode = !adminMode;
        if (adminMode) {
            adminPanel.classList.add('active');
            adminOverlay.classList.add('active');
            adminModeButton.classList.add('admin-mode-active');
            adminModeButton.textContent = 'Admin-Modus beenden';
            loadAdminPanel();
        } else {
            adminPanel.classList.remove('active');
            adminOverlay.classList.remove('active');
            adminModeButton.classList.remove('admin-mode-active');
            adminModeButton.textContent = 'Admin-Modus';
        }
    });
}

// Admin-Panel schließen
if (closeAdminButton) {
    closeAdminButton.addEventListener('click', () => {
        adminPanel.classList.remove('active');
        adminOverlay.classList.remove('active');
        adminModeButton.classList.remove('admin-mode-active');
        adminModeButton.textContent = 'Admin-Modus';
        adminMode = false;
    });
}

// Admin-Overlay schließen
if (adminOverlay) {
    adminOverlay.addEventListener('click', () => {
        adminPanel.classList.remove('active');
        adminOverlay.classList.remove('active');
        adminModeButton.classList.remove('admin-mode-active');
        adminModeButton.textContent = 'Admin-Modus';
        adminMode = false;
    });
}

// Verwarnung absenden
if (submitWarningButton) {
    submitWarningButton.addEventListener('click', () => {
        const email = warnEmailInput.value.trim();
        const reason = warnReasonInput.value.trim();
        
        if (!email || !reason) {
            alert('Bitte gib eine E-Mail-Adresse und einen Grund ein.');
            return;
        }
        
        warnUser(email, reason);
    });
}

// Sperrung absenden
if (submitBanButton) {
    submitBanButton.addEventListener('click', () => {
        const email = banEmailInput.value.trim();
        const reason = banReasonInput.value.trim();
        
        if (!email || !reason) {
            alert('Bitte gib eine E-Mail-Adresse und einen Grund ein.');
            return;
        }
        
        banUser(email, reason);
    });
}

// Initialisierung
window.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    addConsoleMessage("System > Dashboard wurde geladen");
    addConsoleMessage("System > Bitte gib eine Minecraft Server IP ein und drücke 'Bot starten'");
});
