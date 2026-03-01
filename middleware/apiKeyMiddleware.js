
const { getApiKeyByKey } = require('../db');

const apiKeyMiddleware = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'] || req.query.apikey;
        
        if (!apiKey) {
            return res.status(401).json({
                status: 401,
                error: 'API key is required. Provide it in X-API-Key header or apikey query parameter.'
            });
        }

        const keyData = await getApiKeyByKey(apiKey);
        
        if (!keyData) {
            return res.status(401).json({
                status: 401,
                error: 'Invalid or inactive API key.'
            });
        }

        if (keyData.status === 'suspended') {
            return res.status(403).json({
                status: 403,
                error: 'Account suspended.'
            });
        }

        // Check premium expiration
        let effectivePremium = !!keyData.ispremium;
        let premiumExpiration = keyData.premiumexpiration;
        
        if (effectivePremium && premiumExpiration) {
            const expDate = new Date(premiumExpiration);
            if (expDate < new Date()) {
                effectivePremium = false;
                premiumExpiration = null;
            }
        }

        req.user = {
            userId: keyData.userid,
            username: keyData.username || 'API User',
            isPremium: effectivePremium,
            premiumExpiration: premiumExpiration,
            status: keyData.status || 'active'
        };

        next();
    } catch (error) {
        console.error('API Key Middleware Error:', error);
        res.status(500).json({
            status: 500,
            error: 'Internal server error during API key validation.'
        });
    }
};

module.exports = apiKeyMiddleware;
