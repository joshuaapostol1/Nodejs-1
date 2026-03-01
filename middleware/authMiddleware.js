const jwt = require('jsonwebtoken');
const { findUserById, updateUserPremiumStatus } = require('../db');

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 401, error: 'No token provided.' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT, { ignoreExpiration: true });
        
        if (!decoded.userId) {
            console.error('Token missing userId:', decoded);
            return res.status(401).json({ status: 401, error: 'Invalid token format.' });
        }
        
        let user = await findUserById(decoded.userId);
        if (!user) {
            return res.status(401).json({ status: 401, error: 'User not found.' });
        }
        
        if (user.status === 'suspended') {
            return res.status(403).json({ status: 403, error: 'Account suspended.' });
        }

        let effectivePremium = !!user.isPremium;
        if (effectivePremium && user.premiumExpiration) {
            const expirationDate = new Date(user.premiumExpiration);
            if (expirationDate < new Date()) {
                effectivePremium = false;
                try {
                    await updateUserPremiumStatus(user.userId, false, null);
                } catch (dbErr) {
                    console.error("DB Error revert premium:", dbErr);
                }
                user.isPremium = 0;
                user.premiumExpiration = null;
            }
        }

        req.user = {
            userId: user.userId,
            username: user.username,
            fullname: user.fullname,
            email: user.email,
            pfp_url: user.pfp_url,
            isPremium: effectivePremium,
            premiumExpiration: user.premiumExpiration,
            status: user.status
        };
        
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ status: 401, error: 'Invalid token.', shouldLogout: true });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ status: 401, error: 'Token expired.', shouldLogout: true });
        }
        console.error("Auth Middleware Error:", error);
        return res.status(500).json({ status: 500, error: 'Authentication error.', shouldLogout: false });
    }
};

module.exports = authMiddleware;