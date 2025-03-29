const mineflayer = require('mineflayer');

// Aktive Bots speichern
let activeBots = {};

// Logs für jeden Bot speichern
let botLogs = {};

// Zähler für Wiederverbindungsversuche speichern
let reconnectAttempts = {};

// Bot mit Minecraft-Server verbinden
function startBot(config) {
    return new Promise((resolve) => {
        const { username, serverIp, mcVersion, botName } = config;
        
        // Wiederverbindungsversuche zurücksetzen
        reconnectAttempts[username] = 0;
        
        // Log für den Benutzer hinzufügen über die zurückgesetzten Verbindungsversuche
        addBotLog(username, 'Verbindungsversuche zurückgesetzt', 'info');
        
        // Überprüfe, ob bereits ein Bot für diesen Benutzer existiert
        if (activeBots[username]) {
            return resolve({
                success: false,
                error: 'Du hast bereits einen aktiven Bot. Bitte stoppe zuerst den bestehenden Bot.'
            });
        }
        
        try {
            // Domain und Port aus der Server-IP extrahieren
            let host = serverIp;
            let port = '25565'; // Standard-Minecraft-Port
            
            // Falls IP im Format hostname:port ist, trennen wir diese
            if (serverIp.includes(':')) {
                const parts = serverIp.split(':');
                host = parts[0];
                port = parts[1];
            }
            
            console.log(`Verbinden mit Server: ${host} auf Port ${port}...`);

            // Verwende den benutzerdefinierten Bot-Namen oder den Standard
            const customBotName = botName || `${username}_Bot`;

            console.log(`Starte Bot für ${username} - Verbindung zu ${host}:${port} mit Version ${mcVersion || '1.21.4'}`);
            
            // Log eintragen für diesen Benutzer
            addBotLog(username, `Starte Bot für ${username} - Verbindung zu ${host}:${port} mit Version ${mcVersion || '1.21.4'}`, 'info');
            
            // Immer die neueste stabile Version verwenden, es sei denn, es wird eine andere angegeben
            const botVersion = mcVersion || '1.21.4';
            
            // Versuche, IP und Port zu extrahieren (falls Hostname im Format hostname:port)
            let actualHost = host;
            let actualPort = parseInt(port);
            
            if (host.includes(':') && !port) {
                const parts = host.split(':');
                actualHost = parts[0];
                actualPort = parseInt(parts[1]);
                console.log(`Host-Format mit Port erkannt: ${actualHost}:${actualPort}`);
            }
            
            console.log(`Verwende Verbindungsdaten: Host=${actualHost}, Port=${actualPort}, Botname=${customBotName}, Version=${botVersion}`);
            
            // Mineflayer-Bot erstellen mit verbesserten Verbindungsoptionen
            const bot = mineflayer.createBot({
                host: actualHost,
                port: actualPort,
                username: customBotName,
                version: botVersion,
                auth: 'offline', // Offline-Modus für Nicht-Premium-Accounts
                connectTimeout: 20000,  // 20 Sekunden Verbindungs-Timeout
                keepAlive: true,  // Keep-Alive-Pakete senden
                chatLengthLimit: 100  // Chat-Nachrichten auf 100 Zeichen begrenzen
            });

            // Verbindungs-Timeout
            let connectionTimeout = setTimeout(() => {
                console.log(`Verbindungs-Timeout für Bot ${username}_Bot`);
                if (!activeBots[username]) { // Nur auflösen, wenn nicht schon verbunden
                    resolve({
                        success: false,
                        error: 'Verbindungs-Timeout - Der Server antwortet nicht'
                    });
                    try {
                        bot.end();
                    } catch (e) { 
                        console.log('Fehler beim Beenden nach Timeout:', e.message);
                    }
                }
            }, 20000);

            // Event-Listener für Bot-Status
            bot.once('spawn', () => {
                clearTimeout(connectionTimeout); // Timeout löschen
                console.log(`Bot ${username}_Bot erfolgreich mit Server verbunden`);
                
                // Sicherheitsmechanismen einrichten
                setupBotSafety(bot);
                
                // Event-Listener für Logs hinzufügen
                setupBotEventLogging(bot, username);
                
                // Bot im aktiven Bot-Pool speichern
                activeBots[username] = bot;
                
                // Erfolg melden
                resolve({
                    success: true,
                    message: 'Bot erfolgreich verbunden',
                    botName: bot.username || `${username}_Bot`
                });
            });

            // Verbesserte Fehlerbehandlung
            bot.on('error', (err) => {
                clearTimeout(connectionTimeout); // Timeout löschen
                console.error(`Bot-Fehler für ${username}: ${err.message}`);
                
                // Verbindungsfehler-Nachricht benutzerfreundlich gestalten
                let errorMessage = `Bot-Fehler: ${err.message}`;
                
                // Bekannte Fehler mit einfachen Erklärungen
                if (err.code === 'ECONNRESET') {
                    errorMessage = 'Die Verbindung zum Minecraft-Server wurde zurückgesetzt. Das passiert oft, wenn der Server überlastet ist oder deine Verbindung unterbrochen wurde.';
                } else if (err.code === 'ETIMEDOUT') {
                    errorMessage = 'Zeitüberschreitung bei der Verbindung. Der Minecraft-Server antwortet nicht rechtzeitig.';
                } else if (err.code === 'ECONNREFUSED') {
                    errorMessage = 'Der Minecraft-Server hat die Verbindung abgelehnt. Bitte prüfe, ob die IP-Adresse und der Port korrekt sind.';
                } else if (err.message.includes('getaddrinfo')) {
                    errorMessage = 'Die angegebene Server-Adresse wurde nicht gefunden. Bitte prüfe die Schreibweise der Server-IP.';
                } else if (err.message.includes('authenticate')) {
                    errorMessage = 'Fehler bei der Authentifizierung. Der Server erlaubt möglicherweise keine Nicht-Premium-Accounts.';
                }
                
                // Füge den Fehler zum Log hinzu
                addBotLog(username, `Fehler: ${err.message}`, 'error');
                
                // Automatische Versionserkennung bei Versionsproblemen
                if (err.message && err.message.includes('version') && err.message.includes('specify the correct version')) {
                    console.log("Version-Mismatch erkannt, versuche automatisch die richtige Version zu finden");
                    try {
                        // Versuche, die korrekte Version aus der Fehlermeldung zu extrahieren
                        const versionMatch = err.message.match(/server is version (\d+\.\d+\.\d+)/);
                        if (versionMatch && versionMatch[1]) {
                            const correctVersion = versionMatch[1];
                            console.log(`Korrekte Version erkannt: ${correctVersion}, versuche erneut zu verbinden`);
                            
                            // Versuche mit der korrekten Version
                            const newBot = mineflayer.createBot({
                                host: host,
                                port: parseInt(port),
                                username: customBotName,
                                version: correctVersion,
                                auth: 'offline',
                                connectTimeout: 20000
                            });
                            
                            // Neue Event-Listener für den neuen Bot
                            newBot.once('spawn', () => {
                                console.log(`Bot ${username}_Bot mit korrekter Version ${correctVersion} verbunden!`);
                                clearTimeout(connectionTimeout); // Timeout löschen
                                
                                // Bot-Sicherheitsfunktionen einrichten
                                setupBotSafety(newBot);
                                
                                // Bot in aktive Liste speichern
                                activeBots[username] = newBot;
                                
                                // Erfolg melden
                                resolve({
                                    success: true,
                                    message: `Bot erfolgreich verbunden (Version: ${correctVersion})`,
                                    botName: newBot.username || customBotName
                                });
                            });
                            
                            newBot.on('error', (newErr) => {
                                console.error(`Fehler bei Verbindung mit korrekter Version: ${newErr.message}`);
                                if (!activeBots[username]) {
                                    resolve({
                                        success: false,
                                        error: `Fehler auch mit korrekter Version: ${newErr.message}`
                                    });
                                }
                            });
                            
                            return; // Früh zurückkehren, um den Rest zu überspringen
                        }
                    } catch (versionError) {
                        console.error("Fehler bei automatischer Versionserkennung:", versionError);
                    }
                }
                
                // Nur auflösen, wenn nicht schon aufgelöst
                if (!activeBots[username]) {
                    resolve({
                        success: false,
                        error: errorMessage
                    });
                }
            });

            bot.on('kicked', (reason) => {
                clearTimeout(connectionTimeout); // Timeout löschen
                let kickReason = 'Unbekannter Grund';
                
                try {
                    // Versuchen, den Grund als JSON zu parsen (Minecraft Format)
                    const parsedReason = JSON.parse(reason);
                    kickReason = parsedReason.text || parsedReason.translate || reason;
                } catch {
                    // Wenn kein gültiges JSON, dann den Originaltext verwenden
                    kickReason = reason;
                }
                
                // Benutzerfreundliche Kick-Meldung
                let userFriendlyKickReason = kickReason;
                
                // Bekannte Kick-Gründe übersetzen und erklären
                if (kickReason.includes('banned') || kickReason.includes('Banned')) {
                    userFriendlyKickReason = 'Du wurdest vom Server gebannt. Bitte kontaktiere den Server-Administrator.';
                } else if (kickReason.includes('whitelist') || kickReason.includes('Whitelist')) {
                    userFriendlyKickReason = 'Der Server hat eine Whitelist aktiviert. Dein Bot-Account ist nicht auf der Liste der erlaubten Spieler.';
                } else if (kickReason.includes('full') || kickReason.includes('voll')) {
                    userFriendlyKickReason = 'Der Server ist voll. Versuche es später noch einmal.';
                } else if (kickReason.includes('timeout') || kickReason.includes('Timeout')) {
                    userFriendlyKickReason = 'Zeitüberschreitung bei der Verbindung. Deine Internetverbindung ist möglicherweise instabil.';
                } else if (kickReason.includes('version') || kickReason.includes('Version')) {
                    userFriendlyKickReason = 'Falsche Minecraft-Version. Bitte wähle die richtige Version für diesen Server.';
                } else if (kickReason.toLowerCase().includes('already logged in')) {
                    userFriendlyKickReason = 'Ein Spieler mit diesem Namen ist bereits auf dem Server. Bitte wähle einen anderen Bot-Namen.';
                }
                
                console.log(`Bot ${username}_Bot wurde vom Server gekickt: ${userFriendlyKickReason}`);
                addBotLog(username, `Vom Server gekickt: ${userFriendlyKickReason}`, 'error');
                
                // Bot aus der aktiven Liste entfernen
                delete activeBots[username];
                
                // Automatische Wiederverbindung starten, wenn bestimmte Bedingungen erfüllt sind
                // Nicht automatisch neu verbinden bei:
                const shouldNotReconnect = 
                    kickReason.includes('banned') || 
                    kickReason.includes('Banned') || 
                    kickReason.includes('whitelist') ||
                    kickReason.includes('Whitelist') ||
                    kickReason.toLowerCase().includes('already logged in');
                
                if (!shouldNotReconnect) {
                    // Zählen, wie oft wir versucht haben, den Bot zu verbinden
                    reconnectAttempts[username] = (reconnectAttempts[username] || 0) + 1;
                    
                    if (reconnectAttempts[username] <= 5) {
                        console.log(`Versuche, Bot ${username}_Bot automatisch neu zu verbinden... (Versuch ${reconnectAttempts[username]}/5)`);
                        addBotLog(username, `Wiederverbindungsversuch ${reconnectAttempts[username]}/5`, 'warning');
                        
                        // Zeitverzögerung vor dem Wiederverbinden (10 Sekunden)
                        setTimeout(() => {
                            // Stelle sicher, dass der Bot noch nicht aktiv ist
                            if (!activeBots[username]) {
                                console.log(`Starte Wiederverbindung für ${username}_Bot...`);
                                
                                // Server-Adresse und Port speichern, bevor Bot beendet wird
                                const serverHost = bot.server ? bot.server.host : (bot._client ? bot._client.socket.remoteAddress : undefined);
                                const serverPort = bot.server ? bot.server.port : (bot._client ? bot._client.socket.remotePort : 25565);
                                const botVersion = bot.version || config.mcVersion || '1.21.4';
                                const botName = bot.username || username + '_Bot';
                                
                                // Log der gespeicherten Verbindungsinformationen
                                console.log(`Gespeicherte Verbindungsinformationen für Wiederverbindung nach Kick:`, {
                                    host: serverHost,
                                    port: serverPort,
                                    version: botVersion,
                                    botName: botName
                                });
                                
                                // Starte den Bot mit denselben Konfigurationen neu
                                try {
                                    // Nur verbinden, wenn wir gültige Verbindungsdaten haben
                                    if (!serverHost) {
                                        throw new Error('Keine gültigen Verbindungsdaten vorhanden');
                                    }
                                    
                                    // Für Versionsprobleme
                                    let useVersion = botVersion;
                                    if (reason && reason.includes('Outdated client')) {
                                        // Versuche, die erforderliche Version aus der Kicknachricht zu extrahieren
                                        const versionMatch = reason.match(/Please use (\d+\.\d+\.\d+)/);
                                        if (versionMatch && versionMatch[1]) {
                                            useVersion = versionMatch[1];
                                            console.log(`Version aus Kick-Nachricht erkannt: ${useVersion}`);
                                        } else {
                                            // Fallback auf neueste Version
                                            useVersion = '1.21.4';
                                            console.log(`Keine spezifische Version gefunden, verwende Standard: ${useVersion}`);
                                        }
                                    }
                                    
                                    const newBot = mineflayer.createBot({
                                        host: serverHost,
                                        port: serverPort || 25565,
                                        username: botName,
                                        version: useVersion,
                                        auth: 'offline',
                                        hideErrors: true,
                                        // Höheres Timeout für mehr Geduld beim Wiederverbinden
                                        connectTimeout: 30000
                                    });
                                    
                                    newBot.once('spawn', () => {
                                        console.log(`Bot ${username}_Bot wurde erfolgreich neu verbunden!`);
                                        // Bot zur aktiven Liste hinzufügen
                                        activeBots[username] = newBot;
                                        
                                        // Reconnect-Flag setzen
                                        activeBots[username].reconnected = true;
                                        // Bot-Sicherheitsfunktionen neu einrichten
                                        setupBotSafety(newBot);
                                    });
                                    
                                    // Fehlerbehandlung für den neuen Bot
                                    newBot.on('error', (err) => {
                                        console.error(`Fehler bei Wiederverbindung für ${username}_Bot: ${err.message}`);
                                    });
                                } catch (error) {
                                    console.error(`Konnte ${username}_Bot nicht neu verbinden nach Kick: ${error.message}`);
                                }
                            }
                        }, 10000); // 10 Sekunden warten vor dem Wiederverbinden
                    } else {
                        console.log(`Maximale Anzahl an Wiederverbindungsversuchen (5) erreicht für ${username}_Bot`);
                        addBotLog(username, `Maximale Anzahl an Wiederverbindungsversuchen (5) erreicht. Der Bot bleibt offline.`, 'error');
                    }
                }
            });

            bot.on('end', () => {
                clearTimeout(connectionTimeout); // Timeout löschen
                console.log(`Bot ${username}_Bot Verbindung beendet`);
                delete activeBots[username];
                
                // Automatische Wiederverbindung nach normalem Verbindungsabbruch
                // Nur wenn maximale Wiederbverbindungsversuche nicht überschritten wurden
                reconnectAttempts[username] = (reconnectAttempts[username] || 0) + 1;
                
                if (reconnectAttempts[username] <= 5) {
                    console.log(`Versuche, Bot ${username}_Bot nach Verbindungsabbruch automatisch neu zu verbinden... (Versuch ${reconnectAttempts[username]}/5)`);
                    addBotLog(username, `Wiederverbindungsversuch nach Verbindungsabbruch ${reconnectAttempts[username]}/5`, 'warning');
                    
                    // Server-Adresse und Port speichern, bevor Bot beendet wird
                    const serverHost = bot.server ? bot.server.host : (bot._client ? bot._client.socket.remoteAddress : undefined);
                    const serverPort = bot.server ? bot.server.port : (bot._client ? bot._client.socket.remotePort : 25565);
                    const botVersion = bot.version || config.mcVersion || '1.21.4';
                    const botName = bot.username || username + '_Bot';
                    
                    // Log der gespeicherten Verbindungsinformationen
                    console.log(`Gespeicherte Verbindungsinformationen für Wiederverbindung:`, {
                        host: serverHost,
                        port: serverPort,
                        version: botVersion,
                        botName: botName
                    });
                    
                    // Warte etwas länger bei normalem Verbindungsabbruch (15 Sekunden)
                    setTimeout(() => {
                        // Stelle sicher, dass der Bot noch nicht aktiv ist
                        if (!activeBots[username]) {
                            console.log(`Starte Wiederverbindung für ${username}_Bot nach Verbindungsabbruch...`);
                            
                            // Versuche, den Bot mit denselben Konfigurationen neu zu starten
                            try {
                                // Nur verbinden, wenn wir gültige Verbindungsdaten haben
                                if (!serverHost) {
                                    throw new Error('Keine gültigen Verbindungsdaten vorhanden');
                                }
                                
                                const newBot = mineflayer.createBot({
                                    host: serverHost,
                                    port: serverPort || 25565,
                                    username: botName,
                                    version: botVersion,
                                    auth: 'offline',
                                    hideErrors: true,
                                    // Höheres Timeout für mehr Geduld beim Wiederverbinden
                                    connectTimeout: 30000
                                });
                                
                                newBot.once('spawn', () => {
                                    console.log(`Bot ${username}_Bot wurde nach Verbindungsabbruch erfolgreich neu verbunden!`);
                                    // Bot zur aktiven Liste hinzufügen
                                    activeBots[username] = newBot;
                                    
                                    // Reconnect-Flag setzen, damit die UI darüber informiert werden kann
                                    activeBots[username].reconnected = true;
                                    
                                    // Bot-Sicherheitsfunktionen neu einrichten
                                    setupBotSafety(newBot);
                                });
                                
                                // Fehlerbehandlung für den neuen Bot
                                newBot.on('error', (err) => {
                                    console.error(`Fehler bei Wiederverbindung für ${username}_Bot: ${err.message}`);
                                });
                            } catch (error) {
                                console.error(`Konnte ${username}_Bot nicht neu verbinden: ${error.message}`);
                            }
                        }
                    }, 15000); // 15 Sekunden warten vor dem Wiederverbinden
                } else {
                    console.log(`Maximale Anzahl an Wiederverbindungsversuchen (5) erreicht für ${username}_Bot nach Verbindungsabbruch`);
                    addBotLog(username, `Maximale Anzahl an Wiederverbindungsversuchen (5) erreicht. Der Bot bleibt offline.`, 'error');
                }
            });

        } catch (error) {
            console.error(`Fehler beim Starten des Bots für ${username}: ${error.message}`);
            resolve({
                success: false,
                error: `Verbindungsfehler: ${error.message}`
            });
        }
    });
}

// Bot-Sicherheitsfunktionen einrichten
function setupBotSafety(bot) {
    // Anti-AFK-Mechanismen
    let lastAction = Date.now();
    
    // Periodisch prüfen und handeln
    const safetyInterval = setInterval(() => {
        if (!bot.entity) return; // Prüfen, ob Bot noch verbunden ist
        
        // Wenn zu lange keine Aktion, etwas tun
        const currentTime = Date.now();
        if (currentTime - lastAction > 5 * 60 * 1000) { // 5 Minuten
            // Zufällige Aktion ausführen
            const actions = [
                () => bot.setControlState('jump', true),
                () => {
                    bot.setControlState('forward', true);
                    setTimeout(() => bot.setControlState('forward', false), 500);
                },
                () => bot.look(Math.random() * Math.PI * 2, 0),
                () => bot.swingArm()
            ];
            
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            randomAction();
            
            // Timer zurücksetzen
            lastAction = currentTime;
        }
        
        // Sicherstellen, dass der Bot aufhört zu springen
        if (bot.getControlState('jump')) {
            setTimeout(() => bot.setControlState('jump', false), 200);
        }
    }, 30 * 1000); // Alle 30 Sekunden prüfen
    
    // Wenn Bot endet, Interval löschen
    bot.on('end', () => {
        clearInterval(safetyInterval);
    });
    
    // Ereignisse registrieren, die als Aktivität zählen
    const activityEvents = ['chat', 'move', 'health', 'spawn', 'respawn'];
    activityEvents.forEach(event => {
        bot.on(event, () => {
            lastAction = Date.now();
        });
    });
}

// Bot beenden
function stopBot(username) {
    return new Promise((resolve) => {
        if (activeBots[username]) {
            try {
                console.log(`Stoppe Bot für ${username}`);
                activeBots[username].end();
                delete activeBots[username];
                // Zurücksetzen der Wiederverbindungsversuche
                reconnectAttempts[username] = 0;
                resolve({
                    success: true,
                    message: 'Bot erfolgreich getrennt'
                });
            } catch (error) {
                console.error(`Fehler beim Beenden des Bots für ${username}: ${error.message}`);
                resolve({
                    success: false,
                    error: `Fehler beim Beenden: ${error.message}`
                });
            }
        } else {
            resolve({
                success: false,
                error: 'Bot nicht gefunden'
            });
        }
    });
}

// Befehl an Bot senden
function sendCommand(username, command) {
    return new Promise((resolve) => {
        if (activeBots[username]) {
            try {
                console.log(`Sende Befehl '${command}' für Bot ${username}`);
                activeBots[username].chat(command);
                resolve({
                    success: true,
                    message: 'Befehl gesendet',
                    data: { command }
                });
            } catch (error) {
                console.error(`Fehler beim Senden des Befehls für ${username}: ${error.message}`);
                resolve({
                    success: false,
                    error: `Fehler beim Senden des Befehls: ${error.message}`
                });
            }
        } else {
            resolve({
                success: false,
                error: 'Bot nicht gefunden'
            });
        }
    });
}

// Status des Bots abfragen
function getBotStatus(username) {
    if (!activeBots[username]) {
        return {
            success: false,
            active: false,
            error: 'Bot nicht gefunden oder nicht verbunden'
        };
    }
    
    const bot = activeBots[username];
    if (!bot.entity) {
        return {
            success: true,
            active: false,
            message: 'Bot ist verbunden, aber noch nicht vollständig geladen'
        };
    }
    
    try {
        return {
            success: true,
            active: true,
            health: bot.health || 20,
            food: bot.food || 20,
            position: {
                x: Math.floor(bot.entity.position.x),
                y: Math.floor(bot.entity.position.y),
                z: Math.floor(bot.entity.position.z)
            },
            dimension: bot.game.dimension || 'overworld',
            playerCount: Object.keys(bot.players || {}).length - 1, // -1 für den Bot selbst
            serverName: bot.game.serverBrand || 'Minecraft',
            server: bot.server ? bot.server.host : (bot._client ? bot._client.socket.remoteAddress : 'unknown'),
            version: bot.version || 'unknown',
            botName: bot.username || 'unknown',
            reconnected: bot.reconnected === true,
            reconnectAttempts: reconnectAttempts[username] || 0
        };
    } catch (error) {
        console.error(`Fehler beim Abrufen des Status für ${username}: ${error.message}`);
        return {
            success: false,
            active: false,
            error: `Fehler beim Abrufen des Status: ${error.message}`
        };
    }
}

// Funktion, um Log für einen Bot hinzuzufügen
function addBotLog(username, message, type = 'info') {
    // Stellen Sie sicher, dass botLogs initialisiert ist
    if (!botLogs[username]) {
        botLogs[username] = [];
    }
    
    // Maximale Anzahl von Logs begrenzen (letzte 50)
    if (botLogs[username].length > 50) {
        botLogs[username].shift(); // Ältesten Log entfernen
    }
    
    // Log mit Zeitstempel hinzufügen
    botLogs[username].push({
        time: new Date().toISOString(),
        message: message,
        type: type
    });
}

// Logs für einen Bot abrufen
function getBotLogs(username) {
    return botLogs[username] || [];
}

// Event-Logging für Bot einrichten
function setupBotEventLogging(bot, username) {
    // Ereignisse, die geloggt werden sollen
    const logEvents = {
        chat: (username, message, translate, jsonMsg) => {
            // Nur Chatnachrichten loggen, die sichtbar sind
            if (jsonMsg && (jsonMsg.translate === 'chat.type.text' || jsonMsg.translate === 'chat.type.announcement')) {
                const sender = jsonMsg.with && jsonMsg.with[0] && jsonMsg.with[0].text ? jsonMsg.with[0].text : 'Server';
                const msg = jsonMsg.with && jsonMsg.with[1] ? jsonMsg.with[1].text : message;
                return `Chat: ${sender}: ${msg}`;
            }
            return `Chat: ${message}`;
        },
        kicked: (reason) => {
            let kickReason = '';
            try {
                const parsed = JSON.parse(reason);
                kickReason = parsed.text || reason;
            } catch {
                kickReason = reason;
            }
            return `Vom Server gekickt: ${kickReason}`;
        },
        end: () => 'Verbindung getrennt',
        death: () => 'Bot ist gestorben',
        respawn: () => 'Bot wiederbelebt',
        error: (err) => `Fehler: ${err.message}`,
        login: () => 'Eingeloggt',
        resourcePack: (url) => `Ressourcenpaket: ${url.substring(0, 20)}...`,
        rain: () => 'Es regnet',
        playerJoined: (player) => {
            if (bot.username !== player.username) {
                return `Spieler beigetreten: ${player.username}`;
            }
            return null; // Eigener Beitritt wird nicht geloggt
        },
        playerLeft: (player) => {
            if (bot.username !== player.username) {
                return `Spieler hat verlassen: ${player.username}`;
            }
            return null; // Eigenen Ausstieg nicht loggen
        },
        message: (jsonMsg) => {
            // Versuchen, die Nachricht zu dekodieren
            try {
                let readableMessage = '';
                if (typeof jsonMsg === 'string') {
                    readableMessage = jsonMsg;
                } else if (jsonMsg.text) {
                    readableMessage = jsonMsg.text;
                } else if (jsonMsg.translate && jsonMsg.with) {
                    // Einfach die wichtigsten Daten extrahieren
                    readableMessage = `${jsonMsg.translate}: ${jsonMsg.with.map(w => w.text || w).join(', ')}`;
                } else {
                    readableMessage = JSON.stringify(jsonMsg);
                }
                return `System: ${readableMessage}`;
            } catch {
                return null; // Bei Fehlern nicht loggen
            }
        }
    };
    
    // Event-Listener für jeden Event-Typ hinzufügen
    Object.entries(logEvents).forEach(([event, formatter]) => {
        bot.on(event, (...args) => {
            try {
                const message = formatter(...args);
                if (message) {
                    // Logtyp basierend auf Event bestimmen
                    let type = 'info';
                    if (event === 'kicked' || event === 'death' || event === 'error') {
                        type = 'error';
                    } else if (event === 'playerJoined' || event === 'playerLeft') {
                        type = 'event';
                    } else if (event === 'chat') {
                        type = 'chat';
                    }
                    
                    // Log hinzufügen
                    addBotLog(username, message, type);
                }
            } catch (error) {
                console.error(`Fehler beim Loggen von ${event}:`, error);
            }
        });
    });
    
    // Spezielle Behandlung für Positionsänderungen (seltener loggen)
    let lastPositionLog = 0;
    bot.on('move', () => {
        const now = Date.now();
        if (now - lastPositionLog > 60000) { // Nur alle 60 Sekunden loggen
            lastPositionLog = now;
            if (bot.entity) {
                const pos = bot.entity.position;
                addBotLog(username, `Position: X=${Math.floor(pos.x)}, Y=${Math.floor(pos.y)}, Z=${Math.floor(pos.z)}`, 'info');
            }
        }
    });
}

module.exports = {
    startBot,
    stopBot,
    sendCommand,
    getBotStatus,
    addBotLog,
    getBotLogs
};