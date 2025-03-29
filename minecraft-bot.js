
const mineflayer = require('mineflayer');

let activeBots = {};

function startBot(config) {
    return new Promise((resolve) => {
        const { username, serverIp, mcVersion } = config;
        
        try {
            // Extrahiere Port aus der Server-IP falls vorhanden
            let [host, port] = serverIp.split(':');
            port = port || '25565';

            const bot = mineflayer.createBot({
                host: host,
                port: parseInt(port),
                username: `${username}_Bot`,
                version: mcVersion || '1.21.4'
            });

            bot.once('spawn', () => {
                activeBots[username] = bot;
                resolve({
                    success: true,
                    message: 'Bot erfolgreich verbunden'
                });
            });

            bot.on('error', (err) => {
                resolve({
                    success: false,
                    error: `Bot-Fehler: ${err.message}`
                });
            });

        } catch (error) {
            resolve({
                success: false,
                error: `Verbindungsfehler: ${error.message}`
            });
        }
    });
}

function stopBot(username) {
    return new Promise((resolve) => {
        if (activeBots[username]) {
            activeBots[username].end();
            delete activeBots[username];
            resolve({
                success: true,
                message: 'Bot erfolgreich getrennt'
            });
        } else {
            resolve({
                success: false,
                error: 'Bot nicht gefunden'
            });
        }
    });
}

function sendCommand(username, command) {
    return new Promise((resolve) => {
        if (activeBots[username]) {
            try {
                activeBots[username].chat(command);
                resolve({
                    success: true,
                    message: 'Befehl gesendet',
                    data: { command }
                });
            } catch (error) {
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

function getBotStatus(username) {
    return new Promise((resolve) => {
        const bot = activeBots[username];
        if (bot) {
            resolve({
                success: true,
                online: true,
                health: bot.health || 20,
                food: bot.food || 20,
                position: bot.entity ? bot.entity.position : { x: 0, y: 0, z: 0 }
            });
        } else {
            resolve({
                success: false,
                error: 'Bot nicht gefunden'
            });
        }
    });
}

module.exports = {
    startBot,
    stopBot,
    sendCommand,
    getBotStatus
};
