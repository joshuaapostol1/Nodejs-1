require('dotenv').config();
process.removeAllListeners('warning');
process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
        return;
    }
    console.warn(warning.name, warning.message);
});

const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const archiver = require("archiver");
const facebookRoutes = require('./routes/facebook');
const jwt = require('jsonwebtoken');
const requestIp = require('request-ip');
const {
    URL
} = require('url');
const fs = require('fs');
const multer = require('multer');
const {
    v4: uuidv4
} = require('uuid');
const {
    createUser,
    findUserByUsername,
    findUserByEmail,
    findUserById,
    getAllUsers,
    updateUserPremiumStatus,
    comparePassword,
    getIpUsage,
    incrementIpUsage,
    getAllIpUsage,
    resetIpUsage,
    deleteIpRecord,
    deleteIpRegistrations,
    checkIpForTrial,
    recordIpTrial,
    countRegistrationsByIp,
    getAllRegistrationIps,
    recordRegistrationIp,
    updateUserAccountStatus,
    addPremiumRequest,
    getPendingPremiumRequests,
    updatePremiumRequestStatus,
    deleteUserById,
    updateUserProfile,
    updateUserPassword,
    createAnnouncement,
    getAllAnnouncements,
    deleteAnnouncement,
    storeOTP,
    verifyOTP,
    deleteOTP,
    canResendOTP,
    storePendingUser,
    getPendingUser,
    deletePendingUser,
    generateApiKey,
    getUserApiKey,
    revokeApiKey,
    saveCookie,
    getCookie,
    deleteCookie
} = require('./db');
const authMiddleware = require('./middleware/authMiddleware');
const adminAuthMiddleware = require('./middleware/adminAuthMiddleware');
const apiKeyMiddleware = require('./middleware/apiKeyMiddleware');
const chatRoutes = require('./global/chat');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

if (!process.env.JWT) {
    console.error("FATAL ERROR: JWT environment variable is not set.");
    process.exit(1);
}

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

const activeShareTasks = new Map();
const activeConnections = new Map();

const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') :
    [
        'http://localhost:5000',
        'https://localhost:5000',
        replitDomain ? `https://${replitDomain}` : null,
        replitDomain ? `http://${replitDomain}` : null
    ].filter(Boolean);

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(requestIp.mw());
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
const sessionSecret = process.env.SESSION_SECRET || 'wala';
if (!process.env.SESSION_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('SESSION_SECRET environment variable is required in production');
    }
    console.warn('WARNING: Using default session secret. Set SESSION_SECRET environment variable for production.');
}

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        status: 429,
        error: 'Too many login attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: false
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/facebook', facebookRoutes);



app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/guard/fb', (req, res) => {
    res.sendFile(path.join(__dirname, 'guard/fb.html'));
});
app.get('/apikey', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'apikey.html'));
});
app.get('/sms', (req, res) => res.sendFile(path.join(__dirname, 'public', 'sms.html')));
app.use('/api/global/chat', chatRoutes);
app.get('/global/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'global', 'chat.html'));
});

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'https://api-rho-seven-96.vercel.app';

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/api/apikey/generate', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const newApiKey = await generateApiKey(userId);

        res.status(200).json({
            status: 200,
            message: 'New API key generated successfully. Previous key has been revoked.',
            apiKey: newApiKey
        });
    } catch (error) {
        console.error('Generate API Key Error:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to generate API key.'
        });
    }
});

app.get('/api/apikey/current', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const keyData = await getUserApiKey(userId);

        if (!keyData) {
            return res.status(404).json({
                status: 404,
                message: 'No active API key found.'
            });
        }

        res.status(200).json({
            status: 200,
            apiKey: keyData.api_key,
            createdAt: keyData.created_at
        });
    } catch (error) {
        console.error('Get API Key Error:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to retrieve API key.'
        });
    }
});

app.delete('/api/apikey/revoke', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        await revokeApiKey(userId);

        res.status(200).json({
            status: 200,
            message: 'API key revoked successfully.'
        });
    } catch (error) {
        console.error('Revoke API Key Error:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to revoke API key.'
        });
    }
});

app.post('/api/cookies/save', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { cookie } = req.body;

        if (!cookie || typeof cookie !== 'string' || !cookie.trim()) {
            return res.status(400).json({
                status: 400,
                error: 'Valid cookie data is required.'
            });
        }

        await saveCookie(userId, cookie.trim());

        res.status(200).json({
            status: 200,
            message: 'Cookie saved successfully.'
        });
    } catch (error) {
        console.error('Save Cookie Error:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to save cookie.'
        });
    }
});

app.get('/api/cookies/get', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const cookieData = await getCookie(userId);

        if (!cookieData) {
            return res.status(404).json({
                status: 404,
                message: 'No saved cookie found.'
            });
        }

        res.status(200).json({
            status: 200,
            cookie: cookieData.cookie_data,
            updatedAt: cookieData.updated_at
        });
    } catch (error) {
        console.error('Get Cookie Error:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to retrieve cookie.'
        });
    }
});

app.delete('/api/cookies/delete', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        await deleteCookie(userId);

        res.status(200).json({
            status: 200,
            message: 'Cookie deleted successfully.'
        });
    } catch (error) {
        console.error('Delete Cookie Error:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to delete cookie.'
        });
    }
});

app.post('/api/v1/share', apiKeyMiddleware, async (req, res) => {
    const user = req.user;
    
    if (!user || !user.userId) {
        return res.status(401).json({
            status: 401,
            error: 'Invalid API key or user data.'
        });
    }
    
    const {
        cookie,
        url,
        amount,
        interval
    } = req.body;

    if (!cookie || !url || !amount || !interval) {
        return res.status(400).json({
            status: 400,
            error: 'Missing required fields (cookie, url, amount, interval).'
        });
    }

    const parsedAmount = parseInt(amount);
    const parsedInterval = parseInt(interval);

    if (isNaN(parsedAmount) || parsedAmount <= 0 || isNaN(parsedInterval) || parsedInterval <= 0) {
        return res.status(400).json({
            status: 400,
            error: 'Amount and interval must be positive numbers.'
        });
    }

    try {
        const FREE_AMOUNT_LIMIT = 500;

        if (user.isPremium && user.premiumExpiration) {
            const now = new Date();
            const expiry = new Date(user.premiumExpiration);
            const timeLeft = expiry.getTime() - now.getTime();
            const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));

            let shareLimit = null;

            if (timeLeft > 0) {
                if (daysLeft <= 7) {
                    shareLimit = 1000;
                } else if (daysLeft <= 14) {
                    shareLimit = 2000;
                } else if (daysLeft <= 365) {
                    shareLimit = 4000;
                }
            }

            if (shareLimit && parsedAmount > shareLimit) {
                return res.status(400).json({
                    status: 400,
                    error: `Your premium plan allows maximum ${shareLimit} shares per session.`
                });
            }
        } else if (!user.isPremium) {
            if (parsedAmount > FREE_AMOUNT_LIMIT) {
                return res.status(400).json({
                    status: 400,
                    error: `Free share limit per submission is ${FREE_AMOUNT_LIMIT}. Upgrade for unlimited shares.`
                });
            }
        }

        const cookiesString = await convertCookie(cookie);

        const existingTask = activeShareTasks.get(user.userId);
        if (existingTask && existingTask.status === 'running') {
            clearInterval(existingTask.intervalId);
            existingTask.status = 'stopped_by_new';
        }
        activeShareTasks.delete(user.userId);

        startShareSession(user, cookiesString, url, parsedAmount, parsedInterval);

        res.status(200).json({
            status: 200,
            message: 'Share session initiated successfully via API.',
            sessionId: user.userId,
            shareLimit: user.isPremium ? 'Premium limits apply' : FREE_AMOUNT_LIMIT
        });

    } catch (err) {
        console.error("API Submit Error:", err);
        res.status(err.status || 500).json({
            status: err.status || 500,
            error: err.message || 'Internal server error during submission.'
        });
    }
});

app.post('/api/auth/register', upload.single('pfp_file'), async (req, res) => {
    const {
        username,
        fullname,
        email,
        password,
        confirmPassword
    } = req.body;
    const clientIp = req.clientIp;
    const pfpFile = req.file;
    const cleanupPfp = () => {
        if (pfpFile) fs.unlink(pfpFile.path, (err) => {
            if (err) console.error("Error deleting uploaded PFP on failure:", err);
        });
    };

    if (!username || !fullname || !email || !password || !confirmPassword) {
        cleanupPfp();
        return res.status(400).json({
            status: 400,
            error: 'All fields (except PFP) are required.'
        });
    }
    if (password.length < 6) {
        cleanupPfp();
        return res.status(400).json({
            status: 400,
            error: 'Password must be at least 6 characters long.'
        });
    }
    if (password !== confirmPassword) {
        cleanupPfp();
        return res.status(400).json({
            status: 400,
            error: 'Passwords do not match.'
        });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        cleanupPfp();
        return res.status(400).json({
            status: 400,
            error: 'Invalid email format.'
        });
    }
    if (username.toLowerCase() === 'admin') {
        cleanupPfp();
        return res.status(400).json({
            status: 400,
            error: 'Username "admin" is reserved.'
        });
    }
    if (!clientIp) {
        console.warn("Could not determine client IP for registration.");
    }

    const pfpPath = pfpFile ? `/uploads/pfps/${pfpFile.filename}` : null;

    try {
        const existingUserByUsername = await findUserByUsername(username);
        if (existingUserByUsername) {
            throw new Error('Username already exists.');
        }
        const existingUserByEmail = await findUserByEmail(email);
        if (existingUserByEmail) {
            throw new Error('Email already exists.');
        }

        let shouldSuspend = false;
        let registrationCount = 0;
        if (clientIp) {
            const registrationLimit = 3;
            registrationCount = await countRegistrationsByIp(clientIp);
            shouldSuspend = registrationCount >= registrationLimit;
        }

        let pfpDataUrl = null;
        if (pfpFile) {
            try {
                const base64Image = pfpFile.buffer.toString('base64');
                const extension = path.extname(pfpFile.originalname);
                const mimeType = extension === '.png' ? 'image/png' : extension === '.gif' ? 'image/gif' : 'image/jpeg';
                pfpDataUrl = `data:${mimeType};base64,${base64Image}`;
            } catch (error) {
                console.error('Error processing pfp during registration:', error);
            }
        }
        
        await storePendingUser({
            username,
            fullname,
            email,
            password,
            pfpPath: pfpDataUrl
        });

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await storeOTP(email, otp, expiresAt);

        try {
            const emailResponse = await axios.get(`${EMAIL_SERVICE_URL}/api/send-otp`, {
                params: {
                    email: email,
                    otp: otp,
                    fullname: fullname,
                    type: 'registration'
                }
            });

            if (!emailResponse.data || !emailResponse.data.success) {
                throw new Error('Email service failed');
            }
        } catch (emailError) {
            console.error('Email service error:', emailError);
            cleanupPfp();
            await deletePendingUser(email);
            return res.status(500).json({
                status: 500,
                error: 'Failed to send verification email. Please try again.'
            });
        }


        res.status(200).json({
            status: 200,
            message: 'Registration initiated. Please check your email for the OTP verification code.',
            email: email,
            otpSent: true,
            expiresIn: 5
        });

    } catch (error) {
        cleanupPfp();
        if (error.message.includes('Username already exists')) {
            return res.status(409).json({
                status: 409,
                error: 'Username already exists.'
            });
        }
        if (error.message.includes('Email already exists')) {
            return res.status(409).json({
                status: 409,
                error: 'Email already exists.'
            });
        }
        console.error("Registration Error:", error);
        res.status(500).json({
            status: 500,
            error: 'Internal server error during registration.'
        });
    }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    const {
        email,
        otp
    } = req.body;

    if (!email || !otp) {
        return res.status(400).json({
            status: 400,
            error: 'Email and OTP are required.'
        });
    }

    try {
        const isValidOTP = await verifyOTP(email, otp);
        if (!isValidOTP) {
            return res.status(400).json({
                status: 400,
                error: 'Invalid or expired OTP. Please request a new one.'
            });
        }

        const pendingUser = await getPendingUser(email);
        if (!pendingUser) {
            return res.status(400).json({
                status: 400,
                error: 'Registration session expired. Please register again.'
            });
        }

        const clientIp = req.clientIp;

        let shouldSuspend = false;
        let registrationCount = 0;
        if (clientIp) {
            const registrationLimit = 3;
            registrationCount = await countRegistrationsByIp(clientIp);
            shouldSuspend = registrationCount >= registrationLimit;
        }

        const newUser = await createUser(pendingUser.username, pendingUser.fullname, pendingUser.email, pendingUser.password, null);

        if (pendingUser.pfp_path) {
            try {
                await updateUserProfile(newUser.userId, {
                    pfp_url: pendingUser.pfp_path
                });
            } catch (error) {
                console.error('Error handling profile picture:', error);
            }
        }

        let finalStatus = 'active';
        let responseMessage = 'Account verified and created successfully.';

        if (shouldSuspend) {
            try {
                await updateUserAccountStatus(newUser.userId, 'suspended');
                finalStatus = 'suspended';
                responseMessage = 'Account created but suspended due to IP limits.';
            } catch (error) {
                console.error('Failed to suspend user:', error);
            }
        }

        if (clientIp) {
            try {
                await recordRegistrationIp(clientIp, newUser.userId);
            } catch (error) {
                console.error('Failed to record registration IP:', error);
            }
        }

        let trialGranted = false;
        if (finalStatus === 'active' && clientIp) {
            const ipHasTrial = await checkIpForTrial(clientIp);
            if (!ipHasTrial) {
                const trialExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000);
                try {
                    await updateUserPremiumStatus(newUser.userId, true, trialExpiration);
                    await recordIpTrial(clientIp, newUser.userId);
                    trialGranted = true;
                    responseMessage += ' You received a 1-day free trial!';
                } catch (error) {
                    console.error('Error granting trial:', error);
                }
            }
        }

        const token = jwt.sign(
            {
                userId: newUser.userId.toString()
            },
            process.env.JWT,
            { expiresIn: '7d' }
        );

        await deleteOTP(email);
        await deletePendingUser(email);

        res.status(201).json({
            status: 201,
            message: responseMessage,
            token: token,
            userId: newUser.userId,
            username: newUser.username,
            trialGranted: trialGranted,
            accountStatus: finalStatus
        });

    } catch (error) {
        console.error('OTP Verification Error:', error);
        res.status(500).json({
            status: 500,
            error: 'Internal server error during verification.'
        });
    }
});

app.post('/api/auth/resend-otp', async (req, res) => {
    const {
        email
    } = req.body;

    if (!email) {
        return res.status(400).json({
            status: 400,
            error: 'Email is required.'
        });
    }

    try {
        const canResend = await canResendOTP(email);
        if (!canResend) {
            return res.status(429).json({
                status: 429,
                error: 'Please wait 50 seconds before requesting a new OTP.'
            });
        }

        const pendingUser = await getPendingUser(email);
        if (!pendingUser) {
            return res.status(400).json({
                status: 400,
                error: 'No pending registration found. Please register again.'
            });
        }

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await storeOTP(email, otp, expiresAt, true);

        try {
            const emailResponse = await axios.get(`${EMAIL_SERVICE_URL}/api/send-otp`, {
                params: {
                    email: email,
                    otp: otp,
                    fullname: pendingUser.fullname,
                    type: 'registration'
                }
            });

            if (!emailResponse.data || !emailResponse.data.success) {
                throw new Error('Email service failed');
            }
        } catch (emailError) {
            console.error('Email service error:', emailError);
            return res.status(500).json({
                status: 500,
                error: 'Failed to send verification email. Please try again.'
            });
        }

        res.status(200).json({
            status: 200,
            message: 'New OTP sent successfully.',
            expiresIn: 5
        });

    } catch (error) {
        console.error('Resend OTP Error:', error);
        res.status(500).json({
            status: 500,
            error: 'Internal server error.'
        });
    }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
    let {
        username,
        password
    } = req.body;

    if (!username || !password) return res.status(400).json({
        status: 400,
        error: 'Email/Username and password are required.'
    });

    try {
        username = username.trim();

        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);

        if (isEmail) {
            username = username.toLowerCase();
        }

        const user = isEmail ? await findUserByEmail(username) : await findUserByUsername(username);
        if (!user) return res.status(401).json({
            status: 401,
            error: 'Invalid credentials.'
        });

        if (user.status === 'suspended') {
            console.log(`Login attempt on suspended account: ${username}`);
            return res.status(401).json({
                status: 401,
                error: 'Invalid credentials.'
            });
        }

        if (!user.password) {
            console.error(`User ${username} (ID: ${user.userId}) has no password hash!`);
            return res.status(401).json({
                status: 401,
                error: 'Invalid credentials.'
            });
        }

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) return res.status(401).json({
            status: 401,
            error: 'Invalid credentials.'
        });

        let effectivePremium = !!user.isPremium;
        let premiumExpiration = user.premiumExpiration;
        if (effectivePremium && user.premiumExpiration) {
            const expDate = new Date(user.premiumExpiration);
            if (expDate < new Date()) {
                effectivePremium = false;
                premiumExpiration = null;
                try {
                    await updateUserPremiumStatus(user.userId, false, null);
                } catch (dbErr) {
                    console.error(`DB Error reverting expired premium for user ${user.userId}:`, dbErr);
                }
            }
        }

        const token = jwt.sign(
            {
                userId: user.userId.toString()
            },
            process.env.JWT,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            status: 200,
            message: 'Login successful',
            token: token,
            user: {
                userId: user.userId,
                username: user.username,
                fullname: user.fullname,
                email: user.email,
                pfp_url: user.pfp_url,
                isPremium: effectivePremium,
                premiumExpiration: premiumExpiration,
                isAdmin: user.username === 'admin',
                status: user.status || 'active'
            }
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({
            status: 500,
            error: 'Internal server error during login.'
        });
    }
});

app.get('/api/auth/verify', authMiddleware, async (req, res) => {
    try {
        res.status(200).json({
            status: 200,
            user: req.user
        });
    } catch (error) {
        console.error("Verify Error:", error);
        res.status(500).json({
            status: 500,
            error: 'Internal server error during verification.'
        });
    }
});

app.put('/api/profile/update', authMiddleware, upload.single('pfp_file'), async (req, res) => {
    const userId = req.user.userId;
    const currentUser = req.user;
    const {
        fullname,
        username,
        email
    } = req.body;
    const newPfpFile = req.file;

    const updates = {};
    let pfpUpdated = false;
    const cleanupNewPfp = () => {
        if (newPfpFile) fs.unlink(newPfpFile.path, (err) => {});
    };

    if (fullname !== undefined && fullname !== currentUser.fullname) {
        if (typeof fullname !== 'string' || fullname.trim().length === 0) {
            cleanupNewPfp();
            return res.status(400).json({
                status: 400,
                error: 'Full name cannot be empty.'
            });
        }
        updates.fullname = fullname.trim();
    }

    if (username !== undefined && username.toLowerCase() !== currentUser.username) {
        if (typeof username !== 'string' || username.trim().length < 3) {
            cleanupNewPfp();
            return res.status(400).json({
                status: 400,
                error: 'Username must be at least 3 characters.'
            });
        }
        if (username.toLowerCase() === 'admin') {
            cleanupNewPfp();
            return res.status(400).json({
                status: 400,
                error: 'Username "admin" is reserved.'
            });
        }
        const existingUser = await findUserByUsername(username);
        if (existingUser && existingUser.userId !== userId) {
            cleanupNewPfp();
            return res.status(409).json({
                status: 409,
                error: 'Username already taken.'
            });
        }
        updates.username = username.trim();
    }

    if (email !== undefined && email.toLowerCase() !== currentUser.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            cleanupPfp();
            return res.status(400).json({
                status: 400,
                error: 'Invalid email format.'
            });
        }
        const existingUser = await findUserByEmail(email);
        if (existingUser && existingUser.userId !== userId) {
            cleanupPfp();
            return res.status(409).json({
                status: 409,
                error: 'Email already registered.'
            });
        }
        updates.email = email.trim();
    }

    if (newPfpFile) {
        try {
            const base64Image = newPfpFile.buffer.toString('base64');
            const extension = path.extname(newPfpFile.originalname);
            const mimeType = extension === '.png' ? 'image/png' : extension === '.gif' ? 'image/gif' : 'image/jpeg';
            const dataUrl = `data:${mimeType};base64,${base64Image}`;

            updates.pfp_url = dataUrl;
            pfpUpdated = true;
            console.log(`Profile picture updated for user ${userId}`);
        } catch (error) {
            console.error(`Error handling profile picture: ${error.message}`);
            cleanupNewPfp();
            return res.status(500).json({
                status: 500,
                error: 'Failed to save profile picture.'
            });
        }
    } else if (req.body.remove_pfp === 'true' && currentUser.pfp_url) {
        updates.pfp_url = null;
        pfpUpdated = true;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({
            status: 400,
            error: 'No changes provided.'
        });
    }

    try {
        await updateUserProfile(userId, updates);

        const updatedUser = await findUserById(userId);

        res.status(200).json({
            status: 200,
            message: 'Profile updated successfully.',
            user: {
                userId: updatedUser.userId,
                username: updatedUser.username,
                fullname: updatedUser.fullname,
                email: updatedUser.email,
                pfp_url: updatedUser.pfp_url,
                isPremium: currentUser.isPremium,
                premiumExpiration: currentUser.premiumExpiration,
                isAdmin: updatedUser.username === 'admin',
                status: updatedUser.status
            }
        });
    } catch (error) {
        cleanupNewPfp();
        console.error("Profile Update Error:", error);
        if (error.message.includes('UNIQUE constraint failed: users.username')) {
            return res.status(409).json({
                status: 409,
                error: 'Username already exists.'
            });
        }
        if (error.message.includes('UNIQUE constraint failed: users.email')) {
            return res.status(409).json({
                status: 409,
                error: 'Email already exists.'
            });
        }
        res.status(500).json({
            status: 500,
            error: 'Failed to update profile.'
        });
    }
});

app.post('/api/profile/change-password', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const {
        currentPassword,
        newPassword,
        confirmNewPassword
    } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({
            status: 400,
            error: 'All password fields are required.'
        });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({
            status: 400,
            error: 'New password must be at least 6 characters long.'
        });
    }
    if (newPassword !== confirmNewPassword) {
        return res.status(400).json({
            status: 400,
            error: 'New passwords do not match.'
        });
    }

    try {
        const user = await findUserByUsername(req.user.username);
        if (!user || !user.password) {
            return res.status(404).json({
                status: 404,
                error: 'User not found or password data missing.'
            });
        }

        const isMatch = await comparePassword(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                status: 401,
                error: 'Incorrect current password.'
            });
        }

        await updateUserPassword(userId, newPassword);

        res.status(200).json({
            status: 200,
            message: 'Password updated successfully.'
        });

    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({
            status: 500,
            error: 'Failed to change password.'
        });
    }
});

app.post('/api/submit', authMiddleware, async (req, res) => {
    const user = req.user;
    const clientIp = req.clientIp;
    const {
        cookie,
        url,
        amount,
        interval
    } = req.body;

    if (!cookie || !url || !amount || !interval) return res.status(400).json({
        status: 400,
        error: 'Missing required fields (cookie, url, amount, interval).'
    });

    const parsedAmount = parseInt(amount);
    const parsedInterval = parseInt(interval);

    if (isNaN(parsedAmount) || parsedAmount <= 0 || isNaN(parsedInterval) || parsedInterval <= 0) {
        return res.status(400).json({
            status: 400,
            error: 'Amount and interval must be positive numbers.'
        });
    }

    try {
        const FREE_IP_LIMIT = 5;
        const FREE_AMOUNT_LIMIT = 500;

        if (user.isPremium && user.premiumExpiration) {
            const now = new Date();
            const expiry = new Date(user.premiumExpiration);
            const timeLeft = expiry.getTime() - now.getTime();
            const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));

            let shareLimit = null;

            if (timeLeft > 0) {
                if (daysLeft <= 7) {
                    shareLimit = 1000;
                } else if (daysLeft <= 14) {
                    shareLimit = 2000;
                } else if (daysLeft <= 365) {
                    shareLimit = 4000;
                }
            }

            if (shareLimit && parsedAmount > shareLimit) {
                return res.status(400).json({
                    status: 400,
                    error: `Your premium plan allows maximum ${shareLimit} shares per session.`
                });
            }
        } else if (!user.isPremium) {
            if (parsedAmount > FREE_AMOUNT_LIMIT) {
                return res.status(400).json({
                    status: 400,
                    error: `Free share limit per submission is ${FREE_AMOUNT_LIMIT}. Upgrade for unlimited shares.`
                });
            }
        }

        const cookiesString = await convertCookie(cookie);

        const existingTask = activeShareTasks.get(user.userId);
        if (existingTask && existingTask.status === 'running') {
            console.log(`User ${user.userId} submitted new task while old one running. Stopping old task first.`);
            clearInterval(existingTask.intervalId);
            existingTask.status = 'stopped_by_new';
            const userSocket = activeConnections.get(user.userId);
            if (userSocket && userSocket.readyState === WebSocket.OPEN) {
                userSocket.send(JSON.stringify({
                    type: 'info',
                    message: 'Previous session stopped due to new submission.'
                }));
            }
        }
        activeShareTasks.delete(user.userId);

        startShareSession(user, cookiesString, url, parsedAmount, parsedInterval);

        res.status(200).json({
            status: 200,
            message: 'Share session initiated. Check the terminal for live updates.'
        });

    } catch (err) {
        console.error("Submit Error:", err);
        const userSocket = activeConnections.get(user.userId);
        if (userSocket && userSocket.readyState === WebSocket.OPEN) {
            userSocket.send(JSON.stringify({
                type: 'error',
                message: `Submit failed: ${err.message || 'Internal server error.'}`
            }));
        }
        res.status(err.status || 500).json({
            status: err.status || 500,
            error: err.message || 'Internal server error during submission.'
        });
    }
});

app.post('/api/auth/login-gmail', async (req, res) => {
    const {
        email
    } = req.body;

    if (!email) {
        return res.status(400).json({
            status: 400,
            error: 'Email is required.'
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            status: 400,
            error: 'Invalid email format.'
        });
    }

    try {
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({
                status: 404,
                error: 'No account found with this email. Please use Google Sign-In to register first.'
            });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({
                status: 403,
                error: 'Account suspended. Please contact support.'
            });
        }

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await storeOTP(email, otp, expiresAt);

        try {
            const emailResponse = await axios.get(`${EMAIL_SERVICE_URL}/api/send-otp`, {
                params: {
                    email: email,
                    otp: otp,
                    fullname: user.fullname,
                    type: 'password-reset'
                }
            });

            if (!emailResponse.data || !emailResponse.data.success) {
                throw new Error('Email service failed');
            }
        } catch (emailError) {
            console.error('Email service error:', emailError);
            return res.status(500).json({
                status: 500,
                error: 'Failed to send login verification email.'
            });
        }

        res.status(200).json({
            status: 200,
            message: 'Login OTP sent to your email.',
            email: email,
            otpSent: true,
            expiresIn: 5
        });

    } catch (error) {
        console.error('Gmail Login Error:', error);
        res.status(500).json({
            status: 500,
            error: 'Internal server error during Gmail login.'
        });
    }
});

app.post('/api/auth/verify-login-otp', async (req, res) => {
    const {
        email,
        otp
    } = req.body;

    if (!email || !otp) {
        return res.status(400).json({
            status: 400,
            error: 'Email and OTP are required.'
        });
    }

    try {
        const isValidOTP = await verifyOTP(email, otp);
        if (!isValidOTP) {
            return res.status(400).json({
                status: 400,
                error: 'Invalid or expired OTP.'
            });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({
                status: 404,
                error: 'User not found.'
            });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({
                status: 403,
                error: 'Account suspended.'
            });
        }

        let effectivePremium = !!user.isPremium;
        let premiumExpiration = user.premiumExpiration;
        if (effectivePremium && user.premiumExpiration) {
            const expDate = new Date(user.premiumExpiration);
            if (expDate < new Date()) {
                effectivePremium = false;
                premiumExpiration = null;
                try {
                    await updateUserPremiumStatus(user.userId, false, null);
                } catch (dbErr) {
                    console.error('DB Error reverting expired premium:', dbErr);
                }
            }
        }

        const token = jwt.sign(
            {
                userId: user.userId.toString()
            },
            process.env.JWT,
            { expiresIn: '7d' }
        );

        await deleteOTP(email);

        res.status(200).json({
            status: 200,
            message: 'Login successful via Gmail',
            token: token,
            user: {
                userId: user.userId,
                username: user.username,
                fullname: user.fullname,
                email: user.email,
                pfp_url: user.pfp_url,
                isPremium: effectivePremium,
                premiumExpiration: premiumExpiration,
                isAdmin: user.username === 'admin',
                status: user.status || 'active'
            }
        });

    } catch (error) {
        console.error('Login OTP Verification Error:', error);
        res.status(500).json({
            status: 500,
            error: 'Internal server error during login verification.'
        });
    }
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
    const user = req.user;
    const task = activeShareTasks.get(user.userId);
    if (task && task.status === 'running') {
        clearInterval(task.intervalId);
        task.status = 'stopped_on_logout';
        console.log(`Share task for user ${user.userId} stopped due to logout.`);
    }
    activeShareTasks.delete(user.userId);

    res.status(200).json({
        status: 200,
        message: 'Logout successful.'
    });
});

app.post('/api/premium/request', authMiddleware, async (req, res) => {
    const user = req.user;
    const {
        plan
    } = req.body;
    const validPlans = ['1 Week', '2 Weeks', '1 Year', 'Permanent'];

    if (!plan || !validPlans.includes(plan)) {
        return res.status(400).json({
            status: 400,
            error: 'Invalid or missing plan selected.'
        });
    }

    try {
        const requestId = await addPremiumRequest(user.userId, user.username, plan);
        res.status(201).json({
            status: 201,
            requestId: requestId,
            message: `Request for ${plan} plan submitted successfully. Please wait for admin approval and contact the developer for payment/activation.`
        });
    } catch (error) {
        console.error("Premium Request Error:", error);
        res.status(500).json({
            status: 500,
            error: 'Failed to submit premium request. Please try again later.'
        });
    }
});

app.use('/api/admin', adminAuthMiddleware);

app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await getAllUsers();
        res.status(200).json(users);
    } catch (e) {
        console.error("Admin Get Users Error:", e);
        res.status(500).json({
            status: 500,
            error: "Failed to fetch users."
        });
    }
});

app.put('/api/admin/users/:userId/premium', async (req, res) => {
    const {
        userId
    } = req.params;
    const {
        isPremium,
        expirationDate
    } = req.body;

    if (typeof isPremium !== 'boolean') {
        return res.status(400).json({
            status: 400,
            error: "Invalid value for 'isPremium'. Must be true or false."
        });
    }

    let finalExpirationDate = null;
    if (isPremium) {
        if (expirationDate) {
            const parsedDate = new Date(expirationDate);
            if (isNaN(parsedDate.getTime())) {
                return res.status(400).json({
                    status: 400,
                    error: "Invalid format for 'expirationDate'. Use ISO format (YYYY-MM-DDTHH:mm:ss.sssZ) or null."
                });
            }
            finalExpirationDate = parsedDate;
        } else {
            finalExpirationDate = null;
        }
    } else {
        finalExpirationDate = null;
    }

    try {
        await updateUserPremiumStatus(userId, isPremium, finalExpirationDate);
        const updatedUser = await findUserById(userId);
        res.status(200).json({
            status: 200,
            message: "User premium status updated successfully.",
            user: updatedUser
        });
    } catch (e) {
        console.error("Admin Update Premium Error:", e);
        if (e.message.includes('User not found')) {
            return res.status(404).json({
                status: 404,
                error: "User not found."
            });
        }
        res.status(500).json({
            status: 500,
            error: "Failed to update user premium status."
        });
    }
});

app.put('/api/admin/users/:userId/status', async (req, res) => {
    const {
        userId
    } = req.params;
    const {
        status
    } = req.body;

    if (!status || (status !== 'active' && status !== 'suspended')) {
        return res.status(400).json({
            status: 400,
            error: "Invalid status provided. Must be 'active' or 'suspended'."
        });
    }

    try {
        await updateUserAccountStatus(userId, status);
        const updatedUser = await findUserById(userId);
        res.status(200).json({
            status: 200,
            message: `User account status successfully updated to ${status}.`,
            user: updatedUser
        });
    } catch (e) {
        console.error("Admin Update Status Error:", e);
        if (e.message.includes('User not found')) {
            return res.status(404).json({
                status: 404,
                error: "User not found."
            });
        }
        if (e.message.includes('admin account')) {
            return res.status(403).json({
                status: 403,
                error: e.message
            });
        }
        res.status(500).json({
            status: 500,
            error: "Failed to update user account status."
        });
    }
});

app.delete('/api/admin/users/:userId', async (req, res) => {
    const {
        userId
    } = req.params;
    const adminUsername = req.user.username;

    if (!userId) {
        return res.status(400).json({
            status: 400,
            error: "User ID parameter is required."
        });
    }

    try {
        await deleteUserById(userId);
        const task = activeShareTasks.get(userId);
        if (task && task.status === 'running') {
            clearInterval(task.intervalId);
        }
        activeShareTasks.delete(userId);
        activeConnections.delete(userId);

        res.status(200).json({
            status: 200,
            message: `User account (ID: ${userId}) deleted successfully by admin '${adminUsername}'.`
        });
    } catch (e) {
        console.error("Admin Delete User Error:", e);
        if (e.message.includes('User not found')) {
            return res.status(404).json({
                status: 404,
                error: "User not found."
            });
        }
        if (e.message.includes('admin account is not allowed')) {
            return res.status(403).json({
                status: 403,
                error: e.message
            });
        }
        res.status(500).json({
            status: 500,
            error: "Failed to delete user account."
        });
    }
});

app.get('/api/admin/ips', async (req, res) => {
    try {
        const ipUsageData = await getAllIpUsage();
        const ipRegistrationData = await getAllRegistrationIps();

        const combinedDataMap = new Map();

        ipUsageData.forEach(usage => {
            combinedDataMap.set(usage.ip_address, {
                ip_address: usage.ip_address,
                usage_count: usage.usage_count,
                last_used: usage.last_used,
                registration_count: ipRegistrationData[usage.ip_address] || 0
            });
        });

        for (const ip in ipRegistrationData) {
            if (!combinedDataMap.has(ip)) {
                combinedDataMap.set(ip, {
                    ip_address: ip,
                    usage_count: 0,
                    last_used: null,
                    registration_count: ipRegistrationData[ip]
                });
            }
        }

        const combinedDataArray = Array.from(combinedDataMap.values());

        res.status(200).json(combinedDataArray);
    } catch (e) {
        console.error("Admin Get IPs Error:", e);
        res.status(500).json({
            status: 500,
            error: "Failed to fetch IP usage and registration data."
        });
    }
});

app.put('/api/admin/ips/:ip/reset', async (req, res) => {
    const {
        ip
    } = req.params;
    if (!ip || ip.length < 7) {
        return res.status(400).json({
            status: 400,
            error: "Invalid IP address format."
        });
    }

    try {
        await resetIpUsage(ip);
        await deleteIpRegistrations(ip);

        res.status(200).json({
            status: 200,
            message: `Usage count reset and registration records deletion processed successfully for IP ${ip}.`
        });
    } catch (e) {
        console.error(`Error processing reset/delete-regs for IP ${ip}:`, e);
        res.status(500).json({
            status: 500,
            error: "Failed to process IP usage reset and registration deletion."
        });
    }
});

app.delete('/api/admin/ips/:ip', async (req, res) => {
    const {
        ip
    } = req.params;
    if (!ip || ip.length < 7) {
        return res.status(400).json({
            status: 400,
            error: "Invalid IP address format."
        });
    }

    try {
        await deleteIpRecord(ip);
        await deleteIpRegistrations(ip);

        res.status(200).json({
            status: 200,
            message: `Usage and registration record deletion processed successfully for IP ${ip}.`
        });
    } catch (e) {
        console.error(`Error processing deletion for IP ${ip}:`, e);
        res.status(500).json({
            status: 500,
            error: "Failed to process IP usage and registration deletion."
        });
    }
});

app.get('/api/admin/requests', async (req, res) => {
    try {
        const requests = await getPendingPremiumRequests();
        res.status(200).json(requests);
    } catch (error) {
        console.error("Admin Get Requests Error:", error);
        res.status(500).json({
            status: 500,
            error: "Failed to fetch pending premium requests."
        });
    }
});

app.put('/api/admin/requests/:requestId/approve', async (req, res) => {
    const {
        requestId
    } = req.params;

    try {
        const requests = await getPendingPremiumRequests();
        const request = requests.find(r => r.requestId === requestId || String(r.requestId) === String(requestId));

        if (!request) {
            console.error(`Request not found. Looking for ID: ${requestId}, Available IDs:`, requests.map(r => r.requestId));
            return res.status(404).json({
                status: 404,
                error: 'Premium request not found or already handled.'
            });
        }

        let expirationDate = null;
        const now = Date.now();
        switch (request.planRequested) {
            case '1 Week':
                expirationDate = new Date(now + 7 * 24 * 60 * 60 * 1000);
                break;
            case '2 Weeks':
                expirationDate = new Date(now + 14 * 24 * 60 * 60 * 1000);
                break;
            case '1 Year':
                expirationDate = new Date(now + 365 * 24 * 60 * 60 * 1000);
                break;
            case 'Permanent':
                expirationDate = null;
                break;
            default:
                return res.status(400).json({
                    status: 400,
                    error: 'Invalid plan found in the request details.'
                });
        }

        await updateUserPremiumStatus(request.userId, true, expirationDate);
        await updatePremiumRequestStatus(request.requestId, 'approved');

        res.status(200).json({
            status: 200,
            message: `Premium request approved for user ${request.username} (${request.planRequested}).`
        });

    } catch (error) {
        console.error("Admin Approve Request Error:", error);
        if (error.message.includes('User not found')) {
            return res.status(404).json({
                status: 404,
                error: "User associated with the request not found. Cannot grant premium."
            });
        }
        res.status(500).json({
            status: 500,
            error: 'Failed to approve premium request.'
        });
    }


});

app.put('/api/admin/requests/:requestId/reject', async (req, res) => {
    const {
        requestId
    } = req.params;

    try {
        await updatePremiumRequestStatus(requestId, 'rejected');
        res.status(200).json({
            status: 200,
            message: 'Premium request rejected successfully.'
        });
    } catch (error) {
        console.error("Admin Reject Request Error:", error);
        if (error.message.includes('Request not found')) {
            return res.status(404).json({
                status: 404,
                error: 'Premium request not found or already handled.'
            });
        }
        res.status(500).json({
            status: 500,
            error: 'Failed to reject premium request.'
        });
    }
});

app.get('/api/announcements', async (req, res) => {
    try {
        const announcements = await getAllAnnouncements();
        res.status(200).json(announcements);
    } catch (error) {
        console.error("Get Announcements Error:", error);
        res.status(500).json({
            status: 500,
            error: 'Failed to fetch announcements.'
        });
    }
});

app.post('/api/admin/announcements', async (req, res) => {
    const {
        title,
        content,
        type
    } = req.body;
    const adminUserId = req.user.userId;

    if (!title || !content) {
        return res.status(400).json({
            status: 400,
            error: 'Title and content are required.'
        });
    }

    const validTypes = ['info', 'warning', 'success', 'error'];
    const announcementType = validTypes.includes(type) ? type : 'info';

    try {
        const announcementId = await createAnnouncement(title, content, announcementType, adminUserId);
        res.status(201).json({
            status: 201,
            message: 'Announcement created successfully.',
            announcementId
        });
    } catch (error) {
        console.error("Create Announcement Error:", error);
        res.status(500).json({
            status: 500,
            error: 'Failed to create announcement.'
        });
    }
});

app.delete('/api/admin/announcements/:id', async (req, res) => {
    const {
        id
    } = req.params;

    try {
        await deleteAnnouncement(id);
        res.status(200).json({
            status: 200,
            message: 'Announcement deleted successfully.'
        });
    } catch (error) {
        console.error("Delete Announcement Error:", error);
        if (error.message.includes('not found')) {
            return res.status(404).json({
                status: 404,
                error: 'Announcement not found.'
            });
        }
        res.status(500).json({
            status: 500,
            error: 'Failed to delete announcement.'
        });
    }
});

async function convertCookie(cookie) {
    try {
        let parsedCookie;
        const trimmedCookie = cookie.trim();

        if (trimmedCookie.startsWith('[') && trimmedCookie.endsWith(']')) {
            parsedCookie = JSON.parse(trimmedCookie);
            if (!Array.isArray(parsedCookie)) {
                throw new Error('Invalid JSON format: Expected an array of cookie objects.');
            }
            if (!parsedCookie.every(c => typeof c === 'object' && c !== null && 'key' in c && 'value' in c)) {
                throw new Error('Invalid JSON structure: Each object must have "key" and "value" properties.');
            }
            if (!parsedCookie.some(c => c.key === 'c_user') || !parsedCookie.some(c => c.key === 'xs')) {
                console.warn("Potential Issue: Essential cookies 'c_user' or 'xs' might be missing in JSON input.");
            }
            return parsedCookie.map(c => `${c.key}=${c.value}`).join('; ');

        } else if (trimmedCookie.includes('=')) {
            const cookies = trimmedCookie.split(';').map(p => {
                const parts = p.trim().split('=');
                return {
                    key: parts[0].trim(),
                    value: parts.slice(1).join('=').trim()
                };
            }).filter(c => c.key);

            if (cookies.length === 0) {
                throw new Error('Invalid cookie string format: No valid key=value pairs found.');
            }
            if (!cookies.some(c => c.key === 'c_user') || !cookies.some(c => c.key === 'xs')) {
                console.warn("Potential Issue: Essential cookies 'c_user' or 'xs' might be missing in string input.");
            }
            return cookies.map(c => `${c.key}=${c.value}`).join('; ');
        } else {
            throw new Error('Unrecognized cookie format. Please provide JSON array or standard cookie string.');
        }
    } catch (e) {
        console.error("Cookie parsing failed:", e.message);
        throw new Error(`Invalid cookie format: ${e.message}`);
    }
}

async function getPostID(url) {
    try {
        const response = await axios.post('https://id.traodoisub.com/api.php',
            `link=${encodeURIComponent(url)}`, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 10000
            }
        );

        if (response.data && response.data.id) {
            return response.data.id;
        } else {
            console.warn("External Post ID fetch failed or returned no ID. Trying regex fallback.");
            let match = url.match(/(?:(?:fbid=|story_fbid=)|(?:posts|videos|reel|photo\.php|permalink\.php|watch)\/|v=)(\d+)/);
            if (match && match[1]) return match[1];
            match = url.match(/\/photos\/.*\.(\d+)\//);
            if (match && match[1]) return match[1];
            const urlParts = new URL(url).pathname.split('/');
            const potentialId = urlParts.find(part => /^\d{10,}$/.test(part));
            if (potentialId) return potentialId;

            throw new Error(`Could not extract Post ID from URL: ${url}`);
        }
    } catch (error) {
        console.error("Error getting Post ID:", error.message);
        return null;
    }
}

async function getAccessToken(cookie) {
    try {
        const headers = {
            'authority': 'business.facebook.com',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'accept-language': 'en-US,en;q=0.9',
            'cache-control': 'max-age=0',
            'cookie': cookie,
            'referer': 'https://www.facebook.com/',
            'sec-ch-ua': '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
        };

        const response = await axios.get('https://business.facebook.com/content_management', {
            headers: headers,
            maxRedirects: 5,
            timeout: 15000
        });

        const tokenMatch = response.data.match(/"accessToken"\s*:\s*"([^"]+)"/);
        if (tokenMatch && tokenMatch[1]) {
            return tokenMatch[1];
        }

        const fallbackMatch = response.data.match(/EAA[a-zA-Z0-9_-]+/);
        if (fallbackMatch && fallbackMatch[0]) {
            console.warn("Using fallback regex for Access Token.");
            return fallbackMatch[0];
        }

        console.error("Access Token not found in business.facebook.com response.");
        return null;

    } catch (error) {
        console.error("Error getting Access Token:", error.message);
        if (error.response) {
            console.error("FB Response Status:", error.response.status);
        }
        return null;
    }
}

async function startShareSession(user, cookies, url, amount, interval) {
    const userId = user.userId;

    function sendMessage(messageObj) {
        if (!shareLogs.has(userId)) {
            shareLogs.set(userId, []);
        }
        const logs = shareLogs.get(userId);
        logs.push({
            ...messageObj,
            timestamp: new Date().toISOString()
        });
        if (logs.length > 100) {
            logs.shift();
        }
        console.log(`Task ${userId}: ${messageObj.type} - ${messageObj.message || JSON.stringify(messageObj)}`);
    }

    let postId;
    try {
        postId = await getPostID(url);
        if (!postId) {
            throw new Error('Invalid URL or unable to automatically fetch Post ID. Please use a valid Facebook post URL.');
        }
    } catch (postIdError) {
        sendMessage({
            type: 'error',
            message: `Error getting Post ID: ${postIdError.message}`
        });
        sendMessage({
            type: 'session_end',
            success: false,
            reason: 'Post ID Error'
        });
        return;
    }

    let accessToken;
    try {
        accessToken = await getAccessToken(cookies);
        if (!accessToken) {
            throw new Error('Failed to retrieve Access Token. Check if your cookie/appstate is valid and working, or try generating a new one.');
        }
    } catch (tokenError) {
        sendMessage({
            type: 'error',
            message: `Error getting Access Token: ${tokenError.message}`
        });
        sendMessage({
            type: 'session_end',
            success: false,
            reason: 'Token Error'
        });
        return;
    }

    const task = {
        intervalId: null,
        status: 'running',
        count: 0,
        target: amount,
        postId: postId,
        url: url,
        lastError: null,
        startTime: Date.now()
    };
    activeShareTasks.set(userId, task);

    sendMessage({
        type: 'session_start',
        target: amount,
        url: url,
        postId: postId
    });

    const headers = {
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate',
        'connection': 'keep-alive',
        'content-type': 'application/x-www-form-urlencoded',
        'cookie': cookies,
        'host': 'graph.facebook.com',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
    };

    const sessionIntervalId = setInterval(async () => {
        const currentTask = activeShareTasks.get(userId);
        if (!currentTask || currentTask.status !== 'running' || currentTask.intervalId !== sessionIntervalId) {
            console.log(`Interval ${sessionIntervalId} for user ${userId} stopping: Task status changed or interval mismatch.`);
            clearInterval(sessionIntervalId);
            return;
        }

        if (currentTask.count >= currentTask.target) {
            console.log(`Interval ${sessionIntervalId} for user ${userId} stopping: Target reached (redundant check).`);
            currentTask.status = 'completed_target_reached';
            sendMessage({
                type: 'session_end',
                success: true,
                reason: 'Target Reached',
                count: currentTask.count,
                target: currentTask.target
            });
            clearInterval(sessionIntervalId);
            return;
        }

        try {
            const postData = `link=https://m.facebook.com/${currentTask.postId}&published=false&access_token=${accessToken}`;
            const response = await axios.post(`https://graph.facebook.com/me/feed`, postData, {
                headers: headers,
                timeout: 15000
            });

            if (response.status === 200 && response.data && response.data.id) {
                currentTask.count++;
                sendMessage({
                    type: 'share_log',
                    count: currentTask.count,
                    target: currentTask.target,
                    postId: currentTask.postId
                });

                if (currentTask.count >= currentTask.target) {
                    currentTask.status = 'completed_target_reached';
                    sendMessage({
                        type: 'session_end',
                        success: true,
                        reason: 'Target Reached',
                        count: currentTask.count,
                        target: currentTask.target
                    });
                    clearInterval(sessionIntervalId);
                }
            } else {
                const errorDetail = `Share request failed. Status: ${response.status}, Data: ${JSON.stringify(response.data || 'No data')}`;
                console.warn(`Share failed for user ${userId}: ${errorDetail}`);
                currentTask.lastError = errorDetail;
                sendMessage({
                    type: 'share_error',
                    count: currentTask.count,
                    target: currentTask.target,
                    postId: currentTask.postId,
                    message: errorDetail
                });
            }
        } catch (error) {
            let errorMsg = `Error during share attempt (${currentTask.count + 1}/${currentTask.target}): `;
            let shouldStop = false;

            if (error.response) {
                errorMsg += `Facebook API Error - Status ${error.response.status}. `;
                if (error.response.data && error.response.data.error) {
                    errorMsg += `Message: ${error.response.data.error.message || JSON.stringify(error.response.data.error)}`;
                } else {
                    errorMsg += `Response: ${JSON.stringify(error.response.data || 'No error details')}`;
                }
                if ([400, 401, 403].includes(error.response.status)) {
                    shouldStop = true;
                    errorMsg += " - Session stopping due to critical API error (check cookie/token validity or account status).";
                }
            } else if (error.request) {
                errorMsg += "Network Error - No response received from Facebook (check connection or server timeout).";
            } else {
                errorMsg += `Client-side Error - ${error.message}`;
                shouldStop = true;
            }

            console.error(`Share Error for user ${userId}: ${errorMsg}`);
            currentTask.lastError = errorMsg;
            sendMessage({
                type: 'share_error',
                count: currentTask.count,
                target: currentTask.target,
                postId: currentTask.postId,
                message: errorMsg
            });

            if (shouldStop) {
                currentTask.status = 'error_stopped';
                sendMessage({
                    type: 'session_end',
                    success: false,
                    reason: 'Critical Error',
                    message: errorMsg
                });
                clearInterval(sessionIntervalId);
            }
        }
    }, interval * 1000);

    task.intervalId = sessionIntervalId;
    console.log(`Started share session interval ${sessionIntervalId} for user ${userId}. Target: ${amount}, Post: ${postId}`);
}

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError && !req.path.startsWith('/api/global/chat')) {
        console.error("Profile Multer Error:", err);
        let message = `File upload error: ${err.message}`;
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = `File too large. Profile picture limit is 5MB.`;
        }
        return res.status(400).json({
            status: 400,
            error: message
        });
    } else if (err && err.message === 'Only image files are allowed!' && !req.path.startsWith('/api/global/chat')) {
        return res.status(400).json({
            status: 400,
            error: err.message
        });
    }
    next(err);
});

app.use((err, req, res, next) => {
    if (!(err instanceof multer.MulterError) && !(err.message?.includes('Only image files'))) {
        console.error("Unhandled Error:", err.stack || err);
    }
    if (res.headersSent) {
        return next(err);
    }
    res.status(err.status || 500).json({
        status: err.status || 500,
        error: process.env.NODE_ENV === 'production' ? 'An unexpected internal server error occurred.' : err.message
    });
});



const shareLogs = new Map();

app.get('/api/share-logs', authMiddleware, async (req, res) => {
    const user = req.user;
    const logs = shareLogs.get(user.userId) || [];
    res.status(200).json({
        status: 200,
        logs: logs,
        hasActiveTask: activeShareTasks.has(user.userId)
    });
});

app.delete('/api/share-logs', authMiddleware, async (req, res) => {
    const user = req.user;
    shareLogs.delete(user.userId);
    res.status(200).json({
        status: 200,
        message: 'Logs cleared'
    });
});

const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);

    // Create indexes for better chat performance
    try {
        const {pool} = require('./db');
        const client = await pool.connect();
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_id_timestamp ON messages(id DESC, timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
        `);
        client.release();
        console.log('Chat database indexes created successfully');
    } catch (err) {
        console.error('Error creating chat indexes:', err);
    }
});

app.post('/stop-share', authMiddleware, async (req, res) => {
    const user = req.user;
    const task = activeShareTasks.get(user.userId);

    if (!task) {
        return res.status(404).json({
            status: 404,
            hasActiveTask: false,
            message: 'No active share session found.'
        });
    }

    if (task.status !== 'running') {
        return res.status(400).json({
            status: 400,
            error: 'Share session is not running.'
        });
    }

    clearInterval(task.intervalId);
    task.status = 'stopped';
    activeShareTasks.delete(user.userId);

    res.status(200).json({
        status: 200,
        message: 'Share session stopped successfully.',
        totalShares: task.count
    });
});

app.get('/share-status', authMiddleware, async (req, res) => {
    const user = req.user;
    const task = activeShareTasks.get(user.userId);

    if (!task) {
        return res.status(404).json({
            status: 404,
            hasActiveTask: false,
            message: 'No active share session found.'
        });
    }

    res.status(200).json({
        status: 200,
        hasActiveTask: true,
        taskStatus: task.status,
        count: task.count,
        target: task.target,
        postId: task.postId,
        url: task.url,
        startTime: task.startTime,
        runtime: Date.now() - task.startTime
    });
});

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
app.use('/api/facebook', facebookRoutes);