const crypto = require('crypto');
const config = require('../config/app');

/**
 * Verify JWT token from Laravel
 */
function verifyToken(token) {
    try {
        if (!token) {
            return null;
        }

        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }

        const [header, payload, signature] = parts;
        
        // Verify signature
        const expectedSignature = crypto
            .createHmac('sha256', config.appKey)
            .update(`${header}.${payload}`)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.log('Invalid token signature');
            return null;
        }

        // Decode payload
        const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());

        // Check expiration
        if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
            console.log('Token expired');
            return null;
        }

        return decodedPayload;
    } catch (error) {
        console.error('Token verification error:', error);
        return null;
    }
}

/**
 * Socket.IO authentication middleware
 */
function socketAuth(socket, next) {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    const user = verifyToken(token);
    
    if (!user) {
        return next(new Error('Authentication failed'));
    }

    socket.user = user;
    next();
}

module.exports = {
    verifyToken,
    socketAuth
};



















