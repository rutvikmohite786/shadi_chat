const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const config = require('./config/app');
const { setupSocketEvents } = require('./events');

// Initialize Express
const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Initialize Socket.IO
const io = new Server(server, {
    cors: corsOptions,
    pingTimeout: 60000,
    pingInterval: 25000
});

// Setup socket events
setupSocketEvents(io);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        connections: io.engine.clientsCount
    });
});

// API endpoint to get connected users count
app.get('/stats', (req, res) => {
    res.json({
        connectedUsers: io.engine.clientsCount,
        timestamp: new Date().toISOString()
    });
});

// Start server
server.listen(config.port, () => {
    console.log(`
╔════════════════════════════════════════════╗
║  Matrimony Chat Server Started             ║
╠════════════════════════════════════════════╣
║  Port: ${config.port}                              ║
║  CORS: ${config.corsOrigins.substring(0, 30)}...       ║
║  Time: ${new Date().toLocaleTimeString()}                        ║
╚════════════════════════════════════════════╝
    `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});

module.exports = { app, io };




