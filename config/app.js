require('dotenv').config({ path: '../.env' });

module.exports = {
    port: process.env.SOCKET_PORT || 3001,
    appKey: process.env.APP_KEY || 'base64:tTfGKJjjMkLtNLutuuAb0ZjW367cVhqtVXcLeusJP7g=',
    corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:8000',
    jwtSecret: process.env.APP_KEY || 'your-secret-key'
};



















