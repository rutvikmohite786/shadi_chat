const { handleChatEvents } = require('../handlers/chatHandler');
const { socketAuth } = require('../middleware/auth');

function setupSocketEvents(io) {
    // Apply authentication middleware
    io.use(socketAuth);

    // Handle connections
    io.on('connection', (socket) => {
        console.log(`New connection: ${socket.id}, User: ${socket.user.user_id}`);
        
        // Setup chat event handlers
        handleChatEvents(io, socket);

        // Handle general errors
        socket.on('error', (error) => {
            console.error(`Socket error for user ${socket.user.user_id}:`, error);
        });
    });
}

module.exports = { setupSocketEvents };



















