const chatService = require('../services/chatService');

// Store connected users: { oduserId: socketId }
const connectedUsers = new Map();

function handleChatEvents(io, socket) {
    const userId = socket.user.user_id;
    
    // Store user connection
    connectedUsers.set(userId, socket.id);
    console.log(`User ${userId} connected. Total users: ${connectedUsers.size}`);

    // Broadcast user online status
    socket.broadcast.emit('user_online', { userId });

    /**
     * Handle sending a message
     */
    socket.on('send_message', async (data) => {
        try {
            const { receiverId, message, messageType = 'text' } = data;

            if (!receiverId || !message) {
                socket.emit('error', { message: 'Invalid message data' });
                return;
            }

            // Check if users can chat
            const canChat = await chatService.canChat(userId, receiverId);
            if (!canChat) {
                socket.emit('error', { 
                    message: 'You can only chat with users who have accepted your interest.' 
                });
                return;
            }

            // Save message
            const savedMessage = await chatService.saveMessage(
                userId, 
                receiverId, 
                message, 
                messageType
            );

            // Send to sender
            socket.emit('message_sent', {
                success: true,
                message: savedMessage
            });

            // Send to receiver if online
            const receiverSocketId = connectedUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('new_message', {
                    message: savedMessage
                });
            }

        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    /**
     * Handle typing indicator
     */
    socket.on('typing', (data) => {
        const { receiverId, isTyping } = data;
        const receiverSocketId = connectedUsers.get(receiverId);
        
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('user_typing', {
                userId,
                isTyping
            });
        }
    });

    /**
     * Handle mark as read
     */
    socket.on('mark_read', async (data) => {
        try {
            const { senderId } = data;
            await chatService.markAsRead(senderId, userId);
            
            // Notify sender that messages were read
            const senderSocketId = connectedUsers.get(senderId);
            if (senderSocketId) {
                io.to(senderSocketId).emit('messages_read', {
                    readBy: userId
                });
            }

            socket.emit('read_success', { senderId });
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    });

    /**
     * Handle get conversation
     */
    socket.on('get_conversation', async (data) => {
        try {
            const { otherUserId, limit = 50, offset = 0 } = data;
            
            const messages = await chatService.getConversation(
                userId, 
                otherUserId, 
                limit, 
                offset
            );

            socket.emit('conversation_loaded', {
                otherUserId,
                messages
            });
        } catch (error) {
            console.error('Error getting conversation:', error);
            socket.emit('error', { message: 'Failed to load conversation' });
        }
    });

    /**
     * Handle get unread count
     */
    socket.on('get_unread_count', async () => {
        try {
            const count = await chatService.getUnreadCount(userId);
            socket.emit('unread_count', { count });
        } catch (error) {
            console.error('Error getting unread count:', error);
        }
    });

    /**
     * Handle check online status
     */
    socket.on('check_online', (data) => {
        const { userIds } = data;
        const onlineStatus = {};
        
        userIds.forEach(id => {
            onlineStatus[id] = connectedUsers.has(id);
        });

        socket.emit('online_status', onlineStatus);
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
        connectedUsers.delete(userId);
        console.log(`User ${userId} disconnected. Total users: ${connectedUsers.size}`);
        
        // Broadcast user offline status
        socket.broadcast.emit('user_offline', { userId });
    });
}

module.exports = {
    handleChatEvents,
    connectedUsers
};



















