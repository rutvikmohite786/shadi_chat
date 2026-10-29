const chatService = require('../services/chatService');

// Store connected users: { oduserId: socketId }
const connectedUsers = new Map();

function handleChatEvents(io, socket) {
    const userId = Number(socket.user.user_id);
    
    // Store user connection
    connectedUsers.set(userId, socket.id);
    connectedUsers.set(String(userId), socket.id);
    console.log(`User ${userId} connected. Total users: ${connectedUsers.size}`);

    // Broadcast user online status
    socket.broadcast.emit('user_online', { userId });

    /**
     * Handle sending a message
     */
    socket.on('send_message', async (data) => {
        try {
            const { receiverId, message, messageType = 'text', savedMessage } = data || {};

            if (!receiverId || (!message && !savedMessage)) {
                socket.emit('error', { message: 'Invalid message data' });
                return;
            }

            let messageToSend = savedMessage;

            // If message was already saved (e.g. by Laravel REST API), use it directly
            if (messageToSend && (messageToSend.id || messageToSend.message)) {
                messageToSend = {
                    ...messageToSend,
                    sender_id: Number(messageToSend.sender_id || userId),
                    receiver_id: Number(messageToSend.receiver_id || receiverId),
                    message: messageToSend.message || message,
                    message_type: messageToSend.message_type || messageType,
                    created_at: messageToSend.created_at || new Date().toISOString()
                };
            } else {
                // Check if message was already created in DB recently (e.g. by Laravel REST API)
                const recentMessage = await chatService.findRecentMessage(userId, receiverId, message);
                if (recentMessage) {
                    messageToSend = recentMessage;
                } else {
                    // Check if users can chat
                    const canChat = await chatService.canChat(userId, receiverId);
                    if (!canChat) {
                        socket.emit('error', { 
                            message: 'You can only chat with users who have accepted your interest.' 
                        });
                        return;
                    }

                    // Save message
                    messageToSend = await chatService.saveMessage(
                        userId, 
                        receiverId, 
                        message, 
                        messageType
                    );
                }
            }

            // Send to sender
            socket.emit('message_sent', {
                success: true,
                message: messageToSend
            });

            // Send to receiver if online
            const targetReceiverId = Number(receiverId);
            const receiverSocketId = connectedUsers.get(targetReceiverId) || connectedUsers.get(String(targetReceiverId));
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('new_message', {
                    message: messageToSend
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
        const { userIds } = data || {};
        const onlineStatus = {};
        
        if (Array.isArray(userIds)) {
            userIds.forEach(id => {
                const isOnline = connectedUsers.has(Number(id)) || connectedUsers.has(String(id));
                onlineStatus[id] = isOnline;
                onlineStatus[String(id)] = isOnline;
            });
        }

        socket.emit('online_status', onlineStatus);
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
        connectedUsers.delete(userId);
        connectedUsers.delete(String(userId));
        console.log(`User ${userId} disconnected. Total users: ${connectedUsers.size}`);
        
        // Broadcast user offline status
        socket.broadcast.emit('user_offline', { userId });
    });
}

module.exports = {
    handleChatEvents,
    connectedUsers
};



















