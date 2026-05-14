import { WebSocket, WebSocketServer } from 'ws';
import { wsArcjet } from '../arcjet.js';

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
    if (!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set());
    }

    matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
    const subscribers = matchSubscribers.get(matchId);

    if (!subscribers) return;

    subscribers.delete(socket);

    if (subscribers.size === 0) {
        matchSubscribers.delete(matchId);
    }
}

function cleanupSubscribers(socket) {
    for (const matchId of socket.subscriptions) {
        unsubscribe(matchId, socket);
    }
}

function broadcastToMatch(matchId, payload) {
    const subscribers = matchSubscribers.get(matchId);

    if (!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);

    for (const socket of subscribers) {
        if(socket.readyState === WebSocket.OPEN) {
            socket.send(message);
        }
    }
}

function sendJson(socket, payload) {
    if(socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
    for (const client of wss.clients) {
        if(client.readyState !== WebSocket.OPEN) continue;

        client.send(JSON.stringify(payload));
    }
}

function handleMessage(socket, data) {
    let message;

    try {
        message = JSON.parse(data.toString());
    } catch (e) {
        sendJson(socket, { type: 'error', error: 'Invalid JSON' });
        return;
    }

    if (message?.type === 'subscribe' && Number.isInteger(message.matchId)) {
        subscribe(message.matchId, socket);
        socket.subscriptions.add(message.matchId);
        sendJson(socket, { type: 'subscribed', matchId: message.matchId });
    }

    if (message?.type === 'unsubscribe' && Number.isInteger(message.matchId)) {
        unsubscribe(message.matchId, socket);
        socket.subscriptions.delete(message.matchId);
        sendJson(socket, { type: 'unsubscribed', matchId: message.matchId });
    }
}

function rejectUpgrade(socket, statusCode, message) {
    socket.write(
        `HTTP/1.1 ${statusCode} ${message}\r\n` +
        'Connection: close\r\n' +
        'Content-Type: text/plain\r\n' +
        `Content-Length: ${Buffer.byteLength(message)}\r\n` +
        '\r\n' +
        message
    );
    socket.destroy();
}

export function attachWebsocketServer(server) {
    const wss = new WebSocketServer({
        noServer: true,
        maxPayload: 1024 * 1024, // 1MB
    });

    server.on('upgrade', async (req, socket, head) => {
        const { pathname } = new URL(req.url, 'http://localhost');

        if (pathname !== '/ws') {
            rejectUpgrade(socket, 404, 'Not Found');
            return;
        }

        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);

                if (decision.isDenied()) {
                    const isRateLimit = decision.reason.isRateLimit();
                    rejectUpgrade(
                        socket,
                        isRateLimit ? 429 : 403,
                        isRateLimit ? 'Too Many Requests' : 'Forbidden'
                    );
                    return;
                }
            } catch (e) {
                console.error('WS connection error', e);
                socket.destroy();
                return;
            }
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    });

    wss.on('connection', (socket) => {
        socket.isAlive = true;
        socket.on('pong', () => { socket.isAlive = true; });

        socket.subscriptions = new Set();

        sendJson(socket, { type: 'welcome' });

        socket.on('message', (data) => { 
            handleMessage(socket, data); 
        });

        socket.on('error', (err) => { 
            socket.terminate(); 
        });

        socket.on('close', () => {
            cleanupSubscribers(socket);
        });

        socket.on('error', console.error);
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => clearInterval(interval));

    function broadcastMatchCreated(match) {
        broadcastToAll(wss, { type: 'match_created', data: match });
    }

    function broadcastCommentary(matchId, commentary) {
        broadcastToMatch(matchId, { type: 'commentary', data: commentary });
    }

    return { broadcastMatchCreated, broadcastCommentary };
}
