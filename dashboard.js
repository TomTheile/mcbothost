// Dashboard Funktionalität

// DOM-Elemente
const usernameElement = document.getElementById('username');
const botStatusElement = document.getElementById('bot-status');
const serverIpInput = document.getElementById('server-ip');
const serverPortInput = document.getElementById('server-port');
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

// Benutzername aus localStorage oder SessionStorage abrufen
const loadUserData = () => {
    const username = localStorage.getItem('username') || sessionStorage.getItem('username') || 'Benutzer';
    usernameElement.textContent = username;
    
    // Vorausfüllen des Bot-Namens mit dem Benutzernamen + "_Bot"
    botNameInput.value = `${username}_Bot`;
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
    const serverPort = serverPortInput.value.trim() || '25565';
    const botName = botNameInput.value.trim();
    const mcVersion = mcVersionSelect.value;
    
    // Validierung
    if (!serverIp) {
        addConsoleMessage('System > Bitte gib eine Server-IP ein!', 'error');
        return;
    }
    
    if (!botName) {
        addConsoleMessage('System > Bitte gib einen Bot-Namen ein!', 'error');
        return;
    }
    
    // Buttons und Elemente aktualisieren
    startBotButton.disabled = true;
    stopBotButton.disabled = false;
    commandInput.disabled = false;
    sendCommandButton.disabled = false;
    
    botStatusElement.textContent = 'Verbinden...';
    
    // Anfrage an den Server senden, um den echten Minecraft-Bot zu starten
    fetch('/api/minecraft/start-bot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: localStorage.getItem('username'),
            serverIp: serverIp,
            serverPort: serverPort,
            botName: botName,
            mcVersion: mcVersion
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Erfolgreich verbunden
            botStatusElement.textContent = 'Online';
            botStatusElement.className = 'status-online';
            
            addConsoleMessage(`System > Verbindung zum Bot hergestellt`, 'success');
            addConsoleMessage(`Bot > Verbinde mit ${serverIp}:${serverPort} (Minecraft ${mcVersion})...`);
            
            // Nach einer kurzen Verzögerung wird die Verbindung zum Server simuliert
            setTimeout(() => {
                addConsoleMessage(`Bot > Erfolgreich mit dem Server verbunden!`, 'success');
                addConsoleMessage(`Bot > Spielername: ${botName}`);
                addConsoleMessage(`Server > Willkommen auf dem Server, ${botName}!`);
                
                // Starte Timer und Bot-Simulation
                startBotSimulation();
            }, 1500);
        } else {
            // Fehler beim Verbinden
            botStatusElement.textContent = 'Fehler';
            botStatusElement.className = 'status-error';
            
            addConsoleMessage(`System > Fehler beim Verbinden: ${data.error}`, 'error');
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
        
        addConsoleMessage(`System > Fehler bei der Server-Anfrage: ${error.message}`, 'error');
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
    
    // Echten Bot über Server-API stoppen
    fetch('/api/minecraft/stop-bot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: localStorage.getItem('username'),
            serverIp: serverIpInput.value,
            serverPort: serverPortInput.value || '25565'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Erfolgreich getrennt
            botStatusElement.textContent = 'Offline';
            botStatusElement.className = 'status-offline';
            
            addConsoleMessage(`System > Bot wurde erfolgreich gestoppt`, 'success');
            startBotButton.disabled = false;
            
            // Bot-Simulation stoppen
            stopBotSimulation();
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
        
        addConsoleMessage(`System > Fehler bei der Server-Anfrage: ${error.message}`, 'error');
        addConsoleMessage(`System > Bot wurde lokal gestoppt`, 'warning');
        startBotButton.disabled = false;
        
        // Bot-Simulation stoppen
        stopBotSimulation();
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
    
    // Sende den Befehl an den Server, der ihn an den Bot weiterleitet
    fetch('/api/minecraft/send-command', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            command: command,
            username: localStorage.getItem('username'),
            serverIp: serverIpInput.value,
            serverPort: serverPortInput.value || '25565'
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
        const x = Math.floor(Math.random() * 200 - 100);
        const y = Math.floor(Math.random() * 20 + 60);
        const z = Math.floor(Math.random() * 200 - 100);
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

// Initialisierung
window.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    addConsoleMessage("System > Dashboard wurde geladen");
    addConsoleMessage("System > Bitte gib eine Minecraft Server IP ein und drücke 'Bot starten'");
});
