// Mineflayer Bot-Implementierung
const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');

// Aktive Bots (nach Benutzernamen)
const activeBots = {};

// Bot-Aktionen
const botActions = {
    jump: (bot) => {
        try {
            bot.setControlState('jump', true);
            const timeout = setTimeout(() => {
                bot.setControlState('jump', false);
            }, 500);

            // Cleanup bei Fehler
            process.on('uncaughtException', () => {
                clearTimeout(timeout);
                bot.setControlState('jump', false);
            });

            return { success: true, message: "Bot hat gesprungen" };
        } catch (error) {
            return { success: false, error: "Fehler beim Springen: " + error.message };
        }
    },
    
    forward: (bot, distance = 1) => {
        const d = parseInt(distance) || 1;
        bot.setControlState('forward', true);
        setTimeout(() => {
            bot.setControlState('forward', false);

// Server-Statistiken sammeln
function collectServerStats(bot) {
    try {
        const stats = {
            timestamp: new Date().toISOString(),
            tps: bot.getTps() || 0,
            players: Object.keys(bot.players).length,
            position: bot.entity ? {
                x: Math.floor(bot.entity.position.x),
                y: Math.floor(bot.entity.position.y),
                z: Math.floor(bot.entity.position.z)
            } : null,
            health: bot.health || 0,
            memory: process.memoryUsage(),
            ping: bot.player ? bot.player.ping : 0
        };
        return stats;
    } catch (error) {
        console.error('Fehler beim Sammeln der Server-Stats:', error);
        return null;
    }
}

        }, d * 1000);
        return { success: true, message: `Bot bewegt sich ${d} Sekunden vorwärts` };
    },
    
    say: (bot, message) => {
        if (!message) return { success: false, error: "Bitte gib eine Nachricht an" };
        bot.chat(message);
        return { success: true, message: `Nachricht gesendet: ${message}` };
    },
    
    status: (bot) => {
        const health = bot.health || 0;
        const food = bot.food || 0;
        const position = bot.entity && bot.entity.position ? 
            `X: ${Math.floor(bot.entity.position.x)} Y: ${Math.floor(bot.entity.position.y)} Z: ${Math.floor(bot.entity.position.z)}` : 
            "Unbekannt";
            
        return { 
            success: true, 
            data: {
                health,
                food,
                position
            },
            message: `Status: Gesundheit=${health}/20, Hunger=${food}/20, Position=${position}`
        };
    },
    
    look: (bot, direction) => {
        if (direction === "up") {
            bot.look(0, -Math.PI/2, false);
        } else if (direction === "down") {
            bot.look(0, Math.PI/2, false);
        } else {
            // Nach Gradzahl drehen
            const degrees = parseInt(direction) || 0;
            const radians = (degrees * Math.PI) / 180;
            bot.look(radians, 0, false);
        }
        return { success: true, message: `Bot schaut nach ${direction}` };
    }
};

// Funktion, um Bot zu starten
function startBot(config) {
    const { username, serverIp, serverPort, botName, mcVersion } = config;
    
    // Prüfen, ob bereits ein Bot für diesen Benutzer existiert
    if (activeBots[username]) {
        return { 
            success: false, 
            error: "Du hast bereits einen aktiven Bot. Bitte stoppe ihn zuerst." 
        };
    }
    
    try {
        // Zufälligen Botnamen generieren
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const generatedBotName = `Bot_${username}_${randomSuffix}`;

        // Bot mit Mineflayer erstellen
        const bot = mineflayer.createBot({
            host: serverIp,
            port: parseInt(serverPort) || 25565,
            username: generatedBotName,
            version: mcVersion,
            auth: 'offline',
            hideErrors: false,
            checkTimeoutInterval: 60000,
            defaultChatPatterns: true
        });

        // Event-Handler für Verbindungsfehler
        bot.on('error', (err) => {
            logMessage(`Verbindungsfehler: ${err.message}`);
            delete activeBots[username];
            return {
                success: false,
                error: `Verbindungsfehler: ${err.message}`
            };
        });

        // Event-Handler für erfolgreichen Login
        bot.once('login', () => {
            logMessage(`Bot erfolgreich eingeloggt als ${generatedBotName}`);
            bot.chat("/register 123456789 123456789"); // Automatische Registrierung
        });

        // Event-Handler für Spawn-Event
        bot.once('spawn', () => {
            logMessage(`Bot erfolgreich gespawnt auf ${serverIp}:${serverPort}`);
            // Kleine Bewegung ausführen um zu zeigen dass der Bot aktiv ist
            setTimeout(() => {
                bot.setControlState('forward', true);
                setTimeout(() => bot.setControlState('forward', false), 1000);
            }, 2000);
        });
        
        // Bot-Protokoll initialisieren
        const logPath = path.join(__dirname, 'logs');
        if (!fs.existsSync(logPath)) {
            fs.mkdirSync(logPath, { recursive: true });
        }
        
        const logFile = path.join(logPath, `${username}_${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });
        
        // Log-Funktion
        const logMessage = (message) => {
            const timestamp = new Date().toISOString();
            logStream.write(`[${timestamp}] ${message}\n`);
        };
        
        // Bot-Objekt mit zusätzlichen Eigenschaften erweitern
        const extendedBot = {
            mineflayerBot: bot,
            username,
            serverIp,
            serverPort,
            botName,
            mcVersion,
            startTime: new Date(),
            logFile,
            logMessage,
            consoleMessages: []
        };
        
        // Bot zu aktiven Bots hinzufügen
        activeBots[username] = extendedBot;
        
        // Event-Handler registrieren
        bot.on('spawn', () => {
            logMessage(`Bot hat auf dem Server gespawnt`);
            extendedBot.consoleMessages.push({
                type: 'info',
                message: `Bot hat auf dem Server gespawnt`
            });
        });
        
        bot.on('health', () => {
            logMessage(`Gesundheitsupdate: ${bot.health}/20, Hunger: ${bot.food}/20`);
        });
        
        bot.on('chat', (username, message) => {
            if (username === bot.username) return;
            logMessage(`Chat: ${username}: ${message}`);
            extendedBot.consoleMessages.push({
                type: 'chat',
                username,
                message
            });
        });
        
        bot.on('kicked', (reason) => {
            logMessage(`Bot wurde vom Server gekickt: ${reason}`);
            extendedBot.consoleMessages.push({
                type: 'error',
                message: `Bot wurde vom Server gekickt: ${reason}`
            });
            delete activeBots[username];
        });
        
        bot.on('error', (err) => {
            logMessage(`Fehler aufgetreten: ${err.message}`);
            extendedBot.consoleMessages.push({
                type: 'error',
                message: `Fehler aufgetreten: ${err.message}`
            });
        });
        
        // Erstmeldung ins Log schreiben
        logMessage(`Bot ${botName} wurde gestartet - Server: ${serverIp}:${serverPort}, Minecraft-Version: ${mcVersion}`);
        
        return {
            success: true,
            message: `Bot ${botName} wurde erfolgreich gestartet auf ${serverIp}:${serverPort}`
        };
        
    } catch (error) {
        console.error(`Fehler beim Starten des Bots:`, error);
        return {
            success: false,
            error: `Fehler beim Starten des Bots: ${error.message}`
        };
    }
}

// Funktion, um Bot zu stoppen
function stopBot(username) {
    if (!activeBots[username]) {
        return {
            success: false,
            error: "Du hast keinen aktiven Bot, der gestoppt werden könnte."
        };
    }
    
    try {
        const botInfo = activeBots[username];
        
        // Protokollieren
        botInfo.logMessage(`Bot wird gestoppt...`);
        
        // Bot-Verbindung beenden
        if (botInfo.mineflayerBot) {
            botInfo.mineflayerBot.quit();
        }
        
        // Log-Stream schließen
        botInfo.logMessage(`Bot wurde gestoppt nach ${Math.floor((new Date() - botInfo.startTime) / 1000)} Sekunden Laufzeit`);
        
        // Bot aus der Liste entfernen
        delete activeBots[username];
        
        return {
            success: true,
            message: "Bot wurde erfolgreich gestoppt"
        };
    } catch (error) {
        console.error(`Fehler beim Stoppen des Bots:`, error);
        
        // Trotz Fehler aus der Liste entfernen
        delete activeBots[username];
        
        return {
            success: false,
            error: `Fehler beim Stoppen des Bots: ${error.message}`
        };
    }
}

// Funktion, um Befehle an den Bot zu senden
function sendCommand(username, command) {
    if (!activeBots[username]) {
        return {
            success: false,
            error: "Du hast keinen aktiven Bot, an den du Befehle senden könntest."
        };
    }
    
    try {
        const botInfo = activeBots[username];
        const bot = botInfo.mineflayerBot;
        
        // Befehl protokollieren
        botInfo.logMessage(`Befehl erhalten: ${command}`);
        
        // Befehl parsen
        const parts = command.trim().split(' ');
        const action = parts[0].toLowerCase();
        const params = parts.slice(1).join(' ');
        
        // Befehl ausführen
        if (action === 'help') {
            return {
                success: true,
                message: "Verfügbare Befehle: help, jump, forward, say, status, look"
            };
        } else if (botActions[action]) {
            return botActions[action](bot, params);
        } else {
            return {
                success: false,
                error: `Unbekannter Befehl: ${action}. Gib 'help' ein für eine Liste der verfügbaren Befehle.`
            };
        }
    } catch (error) {
        console.error(`Fehler beim Ausführen des Befehls:`, error);
        return {
            success: false,
            error: `Fehler beim Ausführen des Befehls: ${error.message}`
        };
    }
}

// Funktion, um Bot-Status abzurufen
function getBotStatus(username) {
    if (!activeBots[username]) {
        return {
            success: false,
            error: "Du hast keinen aktiven Bot."
        };
    }
    
    try {
        const botInfo = activeBots[username];
        const bot = botInfo.mineflayerBot;
        
        // Basis-Informationen
        const result = {
            success: true,
            isOnline: true,
            botName: botInfo.botName,
            serverIp: botInfo.serverIp,
            serverPort: botInfo.serverPort,
            mcVersion: botInfo.mcVersion,
            startTime: botInfo.startTime,
            uptime: Math.floor((new Date() - botInfo.startTime) / 1000),
            consoleMessages: botInfo.consoleMessages.slice(-50) // Letzte 50 Nachrichten
        };
        
        // Wenn der Bot gespawnt ist, füge weitere Informationen hinzu
        if (bot.entity) {
            result.health = bot.health;
            result.food = bot.food;
            result.position = {
                x: Math.floor(bot.entity.position.x),
                y: Math.floor(bot.entity.position.y),
                z: Math.floor(bot.entity.position.z)
            };
            result.players = Object.keys(bot.players);
        }
        
        return result;
    } catch (error) {
        console.error(`Fehler beim Abrufen des Bot-Status:`, error);
        return {
            success: false,
            error: `Fehler beim Abrufen des Bot-Status: ${error.message}`
        };
    }
}

// Export aller Funktionen
module.exports = {
    startBot,
    stopBot,
    sendCommand,
    getBotStatus,
    getActiveBots: () => Object.keys(activeBots)
};
