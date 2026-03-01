const axios = require('axios');

const KNOWN_VPN_PROVIDERS = [
    'expressvpn', 'nordvpn', 'surfshark', 'cyberghost', 'protonvpn',
    'tunnelbear', 'hotspotshield', 'windscribe', 'privatevpn', 'vpnunlimited'
];

async function checkVPNWithAPI(ip) {
    try {
        const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,proxy,hosting,org`, {
            timeout: 5000
        });
        
        if (response.data.status === 'success') {
            const { proxy, hosting, org } = response.data;
            const orgLower = (org || '').toLowerCase();
            
            const isVPN = proxy || hosting || 
                         KNOWN_VPN_PROVIDERS.some(provider => orgLower.includes(provider)) ||
                         orgLower.includes('vpn') || 
                         orgLower.includes('proxy') ||
                         orgLower.includes('datacenter') ||
                         orgLower.includes('hosting');
            
            return isVPN;
        }
        return false;
    } catch (error) {
        console.error('VPN API check failed:', error.message);
        return false;
    }
}

function isPrivateIP(ip) {
    const privateRanges = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^127\./,
        /^169\.254\./,
        /^::1$/,
        /^fc00:/,
        /^fe80:/
    ];
    
    return privateRanges.some(range => range.test(ip));
}

const vpnDetectionMiddleware = async (req, res, next) => {
    const clientIp = req.clientIp || req.ip || req.connection.remoteAddress;
    
    if (isPrivateIP(clientIp)) {
        return next();
    }
    
    try {
        const isVPN = await checkVPNWithAPI(clientIp);
        
        if (isVPN) {
            console.log(`VPN/Proxy detected for IP: ${clientIp}`);
            return res.status(403).send(getBlockedHTML());
        }
        
        next();
    } catch (error) {
        console.error('VPN detection error:', error);
        next();
    }
};

function getBlockedHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Blocked</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3a8a 0%, #312e81 50%, #7c3aed 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            position: relative;
        }
        
        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="75" cy="75" r="1" fill="rgba(255,255,255,0.05)"/><circle cx="50" cy="10" r="0.5" fill="rgba(255,255,255,0.08)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            pointer-events: none;
        }
        
        .container {
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            padding: 45px 35px;
            max-width: 520px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            position: relative;
            z-index: 1;
        }
        
        .icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 20px;
            background: linear-gradient(135deg, #ff6b6b, #ffa500);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            color: white;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 15px;
            font-weight: 700;
        }
        
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        
        .warning {
            background: linear-gradient(135deg, #fef3c7, #fed7aa);
            padding: 22px;
            border-radius: 16px;
            margin-bottom: 28px;
            border-left: 4px solid #f59e0b;
            position: relative;
        }
        
        .warning::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 60px;
            height: 60px;
            background: radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, transparent 70%);
            border-radius: 50%;
        }
        
        .warning h3 {
            color: #92400e;
            font-size: 18px;
            margin-bottom: 12px;
            font-weight: 700;
        }
        
        .warning p {
            color: #451a03;
            margin: 0;
            font-size: 14px;
            font-weight: 500;
        }
        
        .steps {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 20px;
            margin-top: 20px;
            text-align: left;
        }
        
        .steps h4 {
            color: #333;
            margin-bottom: 15px;
            font-size: 16px;
            font-weight: 600;
        }
        
        .steps ol {
            padding-left: 20px;
            color: #555;
        }
        
        .steps li {
            margin-bottom: 8px;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .security-info {
            background: linear-gradient(135deg, #f8fafc, #e2e8f0);
            border-radius: 15px;
            padding: 20px;
            margin-top: 25px;
            border: 1px solid #cbd5e1;
            position: relative;
            overflow: hidden;
        }
        
        .security-info::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
        }
        
        .security-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            font-weight: 600;
            color: #1e40af;
            font-size: 14px;
        }
        
        .shield-icon {
            font-size: 16px;
        }
        
        .security-text {
            color: #475569;
            font-size: 13px;
            line-height: 1.5;
            margin: 0;
        }
        
        @media (max-width: 480px) {
            .container {
                padding: 30px 20px;
                margin: 10px;
            }
            
            h1 {
                font-size: 24px;
            }
            
            .icon {
                width: 60px;
                height: 60px;
                font-size: 30px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🚫</div>
        <h1>Access Blocked</h1>
        <p>We've detected that you're using a VPN or proxy service. For security reasons, access to this website is restricted while using these services.</p>
        
        <div class="warning">
            <h3>⚠️ VPN/Proxy Detected</h3>
            <p>Your connection appears to be routed through a VPN, proxy, or hosting service which is not allowed on this platform.</p>
        </div>
        
        <div class="steps">
            <h4>To access this website:</h4>
            <ol>
                <li>Disconnect from your VPN or proxy service</li>
                <li>Restart your browser</li>
                <li>Try accessing the website again</li>
            </ol>
        </div>
        
        <div class="security-info">
            <div class="security-badge">
                <i class="shield-icon">🛡️</i>
                <span>Security Protection Active</span>
            </div>
            <p class="security-text">This security measure helps protect against automated attacks and ensures a better experience for all users.</p>
        </div>
    </div>
</body>
</html>`;
}

module.exports = vpnDetectionMiddleware;