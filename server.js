/**
 * Einfacher Node.js-Server für das Herobrine AFK Bot System
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('url');
const querystring = require('querystring');


// MIME-Typen für verschiedene Dateitypen
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

// Webserver erstellen
const server = http.createServer((req, res) => {
    // URL parsen
    const parsedUrl = parse(req.url);
    let pathname = parsedUrl.pathname;
    
    console.log(`Anfrage: ${req.method} ${pathname}`);
    
    // API-Anfragen behandeln
    if (pathname.startsWith('/api/')) {
        handleApiRequest(req, res, pathname);
        return;
    }
    
    // Standardseite ist index.html
    if (pathname === '/') {
        pathname = '/index.html';
    }
    
    // Dateipfad erstellen
    const filePath = path.join(__dirname, pathname);
    
    // Dateierweiterung ermitteln
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    // Datei lesen und an Client senden
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // Datei nicht gefunden
                console.error(`Datei nicht gefunden: ${filePath}`);
                
                // 404-Seite senden
                fs.readFile(path.join(__dirname, '404.html'), (err, content) => {
                    if (err) {
                        // Einfache 404-Antwort senden, wenn auch die 404-Seite nicht gefunden wird
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end('<html><body><h1>404: Seite nicht gefunden</h1></body></html>', 'utf-8');
                    } else {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    }
                });
            } else {
                // Sonstiger Serverfehler
                console.error(`Serverfehler: ${error.code}`);
                res.writeHead(500);
                res.end(`Serverfehler: ${error.code}`);
            }
        } else {
            // Erfolgreiche Antwort senden
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

/**
 * Behandelt API-Anfragen
 * @param {http.IncomingMessage} req - Die HTTP-Anfrage
 * @param {http.ServerResponse} res - Die HTTP-Antwort
 * @param {string} pathname - Der Pfadname der Anfrage
 */
function handleApiRequest(req, res, pathname) {
    res.setHeader('Content-Type', 'application/json');
    
    // POST-Daten sammeln
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        let data = {};
        
        try {
            // Versuchen, den Request-Body zu parsen (falls vorhanden)
            if (body) {
                data = JSON.parse(body);
            }
            
            // API-Endpunkte
            if (pathname === '/api/users/login' && req.method === 'POST') {
                // Login-Endpunkt
                handleLogin(data, res);
            } else if (pathname === '/api/users/register' && req.method === 'POST') {
                // Registrierungs-Endpunkt
                handleRegister(data, res);
            } else if (pathname === '/api/users/reset-password' && req.method === 'POST') {
                // Passwort-Reset-Endpunkt
                handlePasswordReset(data, res);
            } else if (pathname === '/api/bots/start' && req.method === 'POST') {
                // Bot-Start-Endpunkt
                handleBotStart(data, res);
            } else if (pathname === '/api/bots/stop' && req.method === 'POST') {
                // Bot-Stop-Endpunkt
                handleBotStop(data, res);
            } else if (pathname === '/api/bots/status' && req.method === 'GET') {
                // Bot-Status-Endpunkt
                handleBotStatus(req, res);
            } else if (pathname === '/api/users/upgrade' && req.method === 'POST') {
                // Upgrade auf Premium
                handleUserUpgrade(data, res);
            } else {
                // Unbekannter Endpunkt
                res.writeHead(404);
                res.end(JSON.stringify({ success: false, error: 'API-Endpunkt nicht gefunden' }));
            }
        } catch (error) {
            // Fehler beim Verarbeiten der Anfrage
            console.error('API-Fehler:', error);
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Ungültige Anfrage' }));
        }
    });
}

/**
 * Behandelt Login-Anfragen
 * @param {Object} data - Die Anfragedaten
 * @param {http.ServerResponse} res - Die HTTP-Antwort
 */
function handleLogin(data, res) {
    console.log('Login-Anfrage:', data);
    
    // In einer echten Anwendung würde hier die Datenbank abgefragt werden
    // Hier simulieren wir eine erfolgreiche Anmeldung
    
    setTimeout(() => {
        if (data.email === 'admin@herobrine-bot.de' && data.password === 'admin123') {
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                token: 'admin_token_' + Date.now(),
                user: {
                    uid: 'admin_id',
                    username: 'Administrator',
                    email: 'admin@herobrine-bot.de',
                    role: 'admin'
                }
            }));
        } else if (data.email === 'test@example.com' && data.password === 'test123') {
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                token: 'user_token_' + Date.now(),
                user: {
                    uid: 'user_1',
                    username: 'TestUser',
                    email: 'test@example.com',
                    role: 'user'
                }
            }));
        } else {
            res.writeHead(401);
            res.end(JSON.stringify({
                success: false,
                error: 'Ungültige Anmeldedaten'
            }));
        }
    }, 500); // Verzögerung simulieren
}

/**
 * Behandelt Registrierungs-Anfragen
 * @param {Object} data - Die Anfragedaten
 * @param {http.ServerResponse} res - Die HTTP-Antwort
 */
function handleRegister(data, res) {
    console.log('Registrierungs-Anfrage:', data);
    
    // In einer echten Anwendung würde hier die Datenbank aktualisiert werden
    // Hier simulieren wir einen Erfolg oder einen Fehler (wenn die E-Mail bereits verwendet wird)
    
    setTimeout(() => {
        if (data.email === 'admin@herobrine-bot.de' || data.email === 'test@example.com') {
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                error: 'E-Mail-Adresse wird bereits verwendet'
            }));
        } else if (!data.username || !data.email || !data.password) {
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                error: 'Unvollständige Daten'
            }));
        } else {
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                message: 'Registrierung erfolgreich! Bitte überprüfe deine E-Mails zur Bestätigung deines Kontos.'
            }));
        }
    }, 500); // Verzögerung simulieren
}

/**
 * Behandelt Passwort-Reset-Anfragen
 * @param {Object} data - Die Anfragedaten
 * @param {http.ServerResponse} res - Die HTTP-Antwort
 */
function handlePasswordReset(data, res) {
    console.log('Passwort-Reset-Anfrage:', data);
    
    // In einer echten Anwendung würde hier eine E-Mail gesendet werden
    // Hier simulieren wir immer einen Erfolg
    
    setTimeout(() => {
        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            message: 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet.'
        }));
    }, 500); // Verzögerung simulieren
}

/**
 * Behandelt Bot-Start-Anfragen
 * @param {Object} data - Die Anfragedaten
 * @param {http.ServerResponse} res - Die HTTP-Antwort
 */
async function handleBotStart(data, res) {
    console.log('Bot-Start-Anfrage:', data);
    
    // Prüfen, ob die notwendigen Daten vorhanden sind
    if (!data.username || !data.server) {
        sendResponse(res, 400, { 
            success: false, 
            error: 'Ungültige Anfrage: Benutzername und Server sind erforderlich' 
        });
        return;
    }
    
    // In einer echten Anwendung würde hier der Benutzerstatus geprüft werden
    // Hier simulieren wir einen normalen Benutzer mit maximal 1 Bot oder einen Premium-Benutzer
    
    // Simuliere einen vorhandenen Bot für normale Benutzer
    if (data.token === 'user_token_exists') {
        sendResponse(res, 400, {
            success: false,
            error: 'Du hast das Maximum an erlaubten Bots erreicht. Upgrade auf Premium für unbegrenzte Bots.',
            canUpgrade: true
        });
        return;
    }
    
    // Simuliere Bot-Start
    // In einer echten Anwendung würde hier ein Minecraft-Bot mit mineflayer gestartet werden
    setTimeout(() => {
        // Erfolgsmeldung an Client senden
        sendResponse(res, 200, {
            success: true,
            message: 'Bot wurde erfolgreich erstellt und gestartet',
            botId: 'bot_' + Date.now(),
            bot: {
                id: 'bot_' + Date.now(),
                server: data.server,
                status: 'online',
                username: data.username || 'Bot'
            }
        });
    }, 2000); // Verzögerung simulieren
}

/**
 * Behandelt Bot-Stop-Anfragen
 * @param {Object} data - Die Anfragedaten
 * @param {http.ServerResponse} res - Die HTTP-Antwort
 */
async function handleBotStop(data, res) {
    console.log('Bot-Stop-Anfrage:', data);
    
    // Prüfen, ob die notwendigen Daten vorhanden sind
    if (!data.botId) {
        sendResponse(res, 400, { 
            success: false, 
            error: 'Ungültige Anfrage: Bot-ID ist erforderlich' 
        });
        return;
    }
    
    // In einer echten Anwendung würde hier der User-Token geprüft werden
    // und dann der entsprechende Bot gestoppt
    
    // Simuliere Bot-Stopp
    // In einer echten Anwendung würde hier ein Minecraft-Bot mit mineflayer beendet werden
    setTimeout(() => {
        // Erfolgsmeldung an Client senden
        sendResponse(res, 200, {
            success: true,
            message: 'Bot wurde erfolgreich gestoppt',
            botId: data.botId
        });
    }, 1000); // Verzögerung simulieren
}

/**
 * Behandelt Bot-Status-Anfragen
 * @param {http.IncomingMessage} req - Die HTTP-Anfrage
 * @param {http.ServerResponse} res - Die HTTP-Antwort
 */
function handleBotStatus(req, res) {
    // Query-Parameter parsen
    const parsedUrl = parse(req.url);
    const queryParams = querystring.parse(parsedUrl.query);
    
    console.log('Bot-Status-Anfrage:', queryParams);
    
    // In einer echten Anwendung würde hier der Status aus einer Datenbank abgerufen werden
    // Hier simulieren wir statische Daten
    
    setTimeout(() => {
        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            bots: [
                {
                    id: 'bot_1',
                    server: 'mc.example.com',
                    status: 'online',
                    uptime: 7200, // Sekunden
                    username: 'TestBot'
                }
            ]
        }));
    }, 300); // Verzögerung simulieren
}

/**
 * Behandelt Upgrade-Anfragen für Premium
 * @param {Object} data - Die Anfragedaten
 * @param {http.ServerResponse} res - Die HTTP-Antwort
 */
async function handleUserUpgrade(data, res) {
    console.log('Upgrade-Anfrage:', data);
    
    // Prüfen, ob die notwendigen Daten vorhanden sind
    if (!data.email) {
        sendResponse(res, 400, { 
            success: false, 
            error: 'Ungültige Anfrage: E-Mail ist erforderlich' 
        });
        return;
    }
    
    // Simuliere eine erfolgreiche Premium-Aktivierung
    // In einer echten Anwendung würde hier eine Zahlung verifiziert und der Benutzer aktualisiert werden
    setTimeout(() => {
        sendResponse(res, 200, {
            success: true,
            message: 'Dein Konto wurde erfolgreich auf Premium aktualisiert. Du kannst jetzt unbegrenzt Bots erstellen.',
            isPremium: true,
            maxBots: 999
        });
    }, 1500); // Verzögerung simulieren
}



/**
 * Sendet eine formatierte Antwort an den Client
 * @param {http.ServerResponse} res - Die HTTP-Antwort
 * @param {number} statusCode - Der HTTP-Statuscode
 * @param {Object} data - Die zu sendenden Daten
 */
function sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// Server auf Port 8080 starten
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`Öffne http://localhost:${PORT} im Browser`);
});