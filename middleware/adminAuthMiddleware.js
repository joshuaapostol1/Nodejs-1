const jwt = require('jsonwebtoken');
const {
    findUserById
} = require('../db');
const ADMIN_USERNAME_CHECK = 'admin';

const adminAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({
        status: 401,
        error: 'No admin token'
    });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT);
        const user = await findUserById(decoded.userId);
        if (!user) return res.status(401).json({
            status: 401,
            error: 'Admin user not found'
        });
        if (user.username !== ADMIN_USERNAME_CHECK) return res.status(403).json({
            status: 403,
            error: 'Forbidden: Not admin'
        });
        if (user.status === 'suspended') return res.status(403).json({
            status: 403,
            error: 'Admin account suspended'
        });

        req.user = {
            userId: user.userId,
            username: user.username,
            isPremium: !!user.isPremium,
            status: user.status
        };
        req.isAdmin = true;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({
            status: 401,
            error: 'Invalid/expired token'
        });
        console.error("Admin Auth Middleware Error:", error);
        return res.status(500).json({
            status: 500,
            error: 'Server Error during admin auth'
        });
    }
};

module.exports = adminAuthMiddleware;