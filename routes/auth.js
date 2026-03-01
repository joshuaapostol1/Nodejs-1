const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const authMiddleware = require('../middleware/authMiddleware');
const {
    createUser,
    findUserByUsername,
    findUserByEmail,
    findUserById,
    comparePassword,
    updateUserProfile,
    updateUserPassword
} = require('../db');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const router = express.Router();

const pfpStorage = multer.memoryStorage();

const pfpUpload = multer({
    storage: pfpStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/register', pfpUpload.single('pfp_file'), async (req, res) => {
    try {
        const { fullname, username, email, password, confirmPassword, turnstileToken } = req.body;

        if (!fullname || !username || !email || !password || !confirmPassword) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(400).json({
                status: 400,
                error: 'All fields are required.'
            });
        }

        if (!turnstileToken) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(400).json({
                status: 400,
                error: 'CAPTCHA verification required.'
            });
        }

        const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || '0x4AAAAAAB5kD8Gfk2p0ZTW7zFSVF_XAUgk';
        const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                secret: turnstileSecret,
                response: turnstileToken
            })
        });

        const verifyData = await verifyResponse.json();
        if (!verifyData.success) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(400).json({
                status: 400,
                error: 'CAPTCHA verification failed. Please try again.'
            });
        }

        if (password !== confirmPassword) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(400).json({
                status: 400,
                error: 'Passwords do not match.'
            });
        }

        if (password.length < 6) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(400).json({
                status: 400,
                error: 'Password must be at least 6 characters long.'
            });
        }

        const existingUserByUsername = await findUserByUsername(username);
        if (existingUserByUsername) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(400).json({
                status: 400,
                error: 'Username already exists.'
            });
        }

        const existingUserByEmail = await findUserByEmail(email);
        if (existingUserByEmail) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(400).json({
                status: 400,
                error: 'Email already exists.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await createUser(fullname, username, email, hashedPassword, null);
        const userId = result.userId;

        let pfpUrl = null;
        if (req.file) {
            const extension = path.extname(req.file.originalname);
            const permanentFilename = `${userId}${extension}`;
            const permanentPath = path.join(PFP_DIR, permanentFilename);

            try {
                if (req.file && req.file.buffer) {
                    // Store the profile picture as base64 in the database
                    const base64Image = req.file.buffer.toString('base64');
                    const imageDataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

                    try {
                        const githubUrl = await uploadToGitHub(permanentPath, githubPath);
                        if (githubUrl) {
                            pfpUrl = githubUrl;
                            console.log(`Registration profile picture uploaded to GitHub: ${githubUrl}`);
                        } else {
                            pfpUrl = `/uploads/pfp/${permanentFilename}`;
                            console.warn('GitHub upload returned no URL, using local path for registration PFP');
                        }
                    } catch (githubError) {
                        console.error('GitHub upload failed during registration:', githubError);
                        pfpUrl = `/uploads/pfp/${permanentFilename}`;
                    }
                } else {
                    console.warn(`Temporary file not found during registration profile picture upload: ${req.file.path}`);
                }
            } catch (renameError) {
                console.error(`Error renaming profile picture during registration: ${renameError.message}`);
                try {
                    if (fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                } catch (cleanupError) {
                    console.error(`Error cleaning up temporary file: ${cleanupError.message}`);
                }
            }

            await updateUserProfile(userId, { pfp_url: pfpUrl });
        }

        const token = jwt.sign(
            {
                userId: userId.toString(),
                username: username
            },
            process.env.JWT || 'secret',
            { expiresIn: '365d' }
        );

        res.status(201).json({
            status: 201,
            message: 'User registered successfully.',
            token,
            user: {
                userId,
                username,
                fullname,
                email,
                pfp_url: pfpUrl
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        res.status(500).json({
            status: 500,
            error: 'Registration failed. Please try again.'
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password, turnstileToken } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                status: 400,
                error: 'Username and password are required.'
            });
        }

        if (!turnstileToken) {
            return res.status(400).json({
                status: 400,
                error: 'CAPTCHA verification required.'
            });
        }

        const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || '0x4AAAAAAB5kD8Gfk2p0ZTW7zFSVF_XAUgk';
        const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                secret: turnstileSecret,
                response: turnstileToken
            })
        });

        const verifyData = await verifyResponse.json();
        if (!verifyData.success) {
            return res.status(400).json({
                status: 400,
                error: 'CAPTCHA verification failed. Please try again.'
            });
        }

        const user = await findUserByUsername(username);
        if (!user) {
            return res.status(401).json({
                status: 401,
                error: 'Invalid username or password.'
            });
        }

        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                status: 401,
                error: 'Invalid username or password.'
            });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({
                status: 403,
                error: 'Account is suspended.'
            });
        }

        const token = jwt.sign(
            {
                userId: user.userId.toString(),
                username: user.username
            },
            process.env.JWT || 'secret',
            { expiresIn: '365d' }
        );

        res.json({
            status: 200,
            message: 'Login successful.',
            token,
            user: {
                userId: user.userId,
                username: user.username,
                fullname: user.fullname,
                email: user.email,
                pfp_url: user.pfp_url,
                isPremium: !!user.isPremium,
                premiumExpiration: user.premiumExpiration,
                status: user.status
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 500,
            error: 'Login failed. Please try again.'
        });
    }
});

router.get('/profile', authMiddleware, async (req, res) => {
    try {
        res.json({
            status: 200,
            user: req.user
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to fetch profile.'
        });
    }
});

router.put('/profile/update', authMiddleware, pfpUpload.single('pfp_file'), async (req, res) => {
    try {
        const { fullname, username, email, remove_pfp } = req.body;
        const userId = req.user.userId;

        if (!fullname || !username || !email) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(400).json({
                status: 400,
                error: 'All fields are required.'
            });
        }

        if (username !== req.user.username) {
            const existingUser = await findUserByUsername(username);
            if (existingUser && existingUser.userId !== userId) {
                if (req.file) {
                    fs.unlink(req.file.path, () => {});
                }
                return res.status(400).json({
                    status: 400,
                    error: 'Username already exists.'
                });
            }
        }

        if (email !== req.user.email) {
            const existingUser = await findUserByEmail(email);
            if (existingUser && existingUser.userId !== userId) {
                if (req.file) {
                    fs.unlink(req.file.path, () => {});
                }
                return res.status(400).json({
                    status: 400,
                    error: 'Email already exists.'
                });
            }
        }

        let pfpUrl = req.user.pfp_url;

        if (remove_pfp === 'true') {
            pfpUrl = null;
        }

        if (req.file) {
            const extension = path.extname(req.file.originalname);
            const permanentFilename = `${userId}${extension}`;
            const permanentPath = path.join(PFP_DIR, permanentFilename);

            try {
                const files = fs.readdirSync(PFP_DIR);
                files.forEach(file => {
                    if (file.startsWith(`${userId}.`) && file !== permanentFilename) {
                        const oldFilePath = path.join(PFP_DIR, file);
                        fs.unlink(oldFilePath, (err) => {
                            if (!err) console.log(`Deleted old PFP: ${oldFilePath}`);
                        });


router.post('/google-login', async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                status: 400,
                error: 'Google credential is required.'
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const googleId = payload['sub'];
        const email = payload['email'];
        const name = payload['name'];
        const picture = payload['picture'];

        let user = await findUserByEmail(email);
        let isNewUser = false;
        let trialGranted = false;

        if (!user) {
            isNewUser = true;
            const username = email.split('@')[0] + '_' + uuidv4().substring(0, 6);
            const randomPassword = uuidv4();
            const hashedPassword = await bcrypt.hash(randomPassword, 10);
            
            const result = await createUser(name, username, email, hashedPassword, null);
            const userId = result.userId;

            if (picture) {
                await updateUserProfile(userId, { pfp_url: picture });
            }

            const clientIp = req.clientIp;
            if (clientIp) {
                const { checkIpForTrial, recordIpTrial, updateUserPremiumStatus } = require('../db');
                const ipHasTrial = await checkIpForTrial(clientIp);
                if (!ipHasTrial) {
                    const trialExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000);
                    try {
                        await updateUserPremiumStatus(userId, true, trialExpiration);
                        await recordIpTrial(clientIp, userId);
                        trialGranted = true;
                    } catch (error) {
                        console.error('Error granting trial:', error);
                    }
                }
            }
            
            user = await findUserById(userId);
        }

        if (user.status === 'suspended') {
            return res.status(403).json({
                status: 403,
                error: 'Account is suspended.'
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
                    const { updateUserPremiumStatus } = require('../db');
                    await updateUserPremiumStatus(user.userId, false, null);
                } catch (dbErr) {
                    console.error(`DB Error reverting expired premium for user ${user.userId}:`, dbErr);
                }
            }
        }

        const token = jwt.sign(
            {
                userId: user.userId.toString(),
                username: user.username
            },
            process.env.JWT || 'secret',
            { expiresIn: '365d' }
        );

        let responseMessage = isNewUser 
            ? (trialGranted ? 'Account created successfully! You received a 1-day free trial!' : 'Account created successfully.')
            : 'Google login successful.';

        res.json({
            status: 200,
            message: responseMessage,
            token,
            user: {
                userId: user.userId,
                username: user.username,
                fullname: user.fullname,
                email: user.email,
                pfp_url: user.pfp_url,
                isPremium: effectivePremium,
                premiumExpiration: premiumExpiration,
                status: user.status
            },
            trialGranted: trialGranted,
            isNewUser: isNewUser
        });

    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({
            status: 500,
            error: 'Google login failed. Please try again.'
        });
    }
});

                    }
                });
            } catch (cleanupError) {
                console.error('Error cleaning up old profile pictures:', cleanupError);
            }

            try {
                if (fs.existsSync(req.file.path)) {
                    fs.renameSync(req.file.path, permanentPath);

                    const { uploadToGitHub } = require('../utils/githubUploader');
                    const githubPath = `public/uploads/pfp/${permanentFilename}`;

                    try {
                        const githubUrl = await uploadToGitHub(permanentPath, githubPath);
                        if (githubUrl) {
                            pfpUrl = githubUrl;
                            console.log(`Profile picture uploaded to GitHub: ${githubUrl}`);
                        } else {
                            pfpUrl = `/uploads/pfp/${permanentFilename}`;
                            console.warn('GitHub upload returned no URL, using local path');
                        }
                    } catch (githubError) {
                        console.error('GitHub upload failed:', githubError);
                        pfpUrl = `/uploads/pfp/${permanentFilename}`;
                    }
                } else {
                    console.warn(`Temporary file not found during profile update: ${req.file.path}`);
                }
            } catch (renameError) {
                console.error(`Error renaming profile picture during update: ${renameError.message}`);
                try {
                    if (fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                } catch (cleanupError) {
                    console.error(`Error cleaning up temporary file: ${cleanupError.message}`);
                }
            }
        }

        await updateUserProfile(userId, {
            fullname,
            username,
            email,
            pfp_url: pfpUrl
        });

        const updatedUser = await findUserById(userId);

        let finalPfpUrl = updatedUser.pfp_url;
        if (finalPfpUrl && req.file) {
            finalPfpUrl = `${updatedUser.pfp_url}?t=${Date.now()}`;
        }

        res.json({
            status: 200,
            message: 'Profile updated successfully.',
            user: {
                userId: updatedUser.userId,
                username: updatedUser.username,
                fullname: updatedUser.fullname,
                email: updatedUser.email,
                pfp_url: finalPfpUrl,
                isPremium: updatedUser.isPremium,
                premiumExpiration: updatedUser.premiumExpiration
            }
        });

    } catch (error) {
        console.error('Profile update error:', error);
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        res.status(500).json({
            status: 500,
            error: 'Failed to update profile.'
        });
    }
});

router.put('/profile', authMiddleware, pfpUpload.single('pfp_file'), async (req, res) => {
    try {
        const { fullname, username, email, remove_pfp } = req.body;
        const userId = req.user.userId;

        if (!fullname || !username || !email) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(400).json({
                status: 400,
                error: 'All fields are required.'
            });
        }

        if (username !== req.user.username) {
            const existingUser = await findUserByUsername(username);
            if (existingUser && existingUser.userId !== userId) {
                if (req.file) {
                    fs.unlink(req.file.path, () => {});
                }
                return res.status(400).json({
                    status: 400,
                    error: 'Username already exists.'
                });
            }
        }

        if (email !== req.user.email) {
            const existingUser = await findUserByEmail(email);
            if (existingUser && existingUser.userId !== userId) {
                if (req.file) {
                    fs.unlink(req.file.path, () => {});
                }
                return res.status(400).json({
                    status: 400,
                    error: 'Email already exists.'
                });
            }
        }

        let pfpUrl = req.user.pfp_url;

        if (remove_pfp === 'true') {
            pfpUrl = null;
        }

        if (req.file) {
            const extension = path.extname(req.file.originalname);
            const permanentFilename = `${userId}${extension}`;
            const permanentPath = path.join(PFP_DIR, permanentFilename);

            try {
                if (req.file && req.file.buffer) {
                    // Store the profile picture as base64 in the database
                    const base64Image = req.file.buffer.toString('base64');
                    const imageDataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

                    try {
                        const githubUrl = await uploadToGitHub(permanentPath, githubPath);
                        if (githubUrl) {
                            pfpUrl = githubUrl;
                            console.log(`Profile picture uploaded to GitHub: ${githubUrl}`);
                        } else {
                            pfpUrl = `/uploads/pfp/${permanentFilename}`;
                            console.warn('GitHub upload returned no URL, using local path');
                        }
                    } catch (githubError) {
                        console.error('GitHub upload failed:', githubError);
                        pfpUrl = `/uploads/pfp/${permanentFilename}`;
                    }
                } else {
                    console.warn(`Temporary file not found during profile update: ${req.file.path}`);
                }
            } catch (renameError) {
                console.error(`Error renaming profile picture during update: ${renameError.message}`);
                try {
                    if (fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                } catch (cleanupError) {
                    console.error(`Error cleaning up temporary file: ${cleanupError.message}`);
                }
            }
        }

        await updateUserProfile(userId, {
            fullname,
            username,
            email,
            pfp_url: pfpUrl
        });

        const updatedUser = await findUserById(userId);

        let finalPfpUrl = updatedUser.pfp_url;
        if (finalPfpUrl && req.file) {
            finalPfpUrl = `${updatedUser.pfp_url}?t=${Date.now()}`;
        }

        res.json({
            status: 200,
            message: 'Profile updated successfully.',
            user: {
                userId: updatedUser.userId,
                username: updatedUser.username,
                fullname: updatedUser.fullname,
                email: updatedUser.email,
                pfp_url: finalPfpUrl,
                isPremium: updatedUser.isPremium,
                premiumExpiration: updatedUser.premiumExpiration
            }
        });

    } catch (error) {
        console.error('Profile update error:', error);
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        res.status(500).json({
            status: 500,
            error: 'Failed to update profile.'
        });
    }
});

router.post('/profile/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;
        const userId = req.user.userId;

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({
                status: 400,
                error: 'All password fields are required.'
            });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({
                status: 400,
                error: 'New passwords do not match.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                status: 400,
                error: 'New password must be at least 6 characters long.'
            });
        }

        const user = await findUserById(userId);
        const isValidPassword = await comparePassword(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                status: 401,
                error: 'Current password is incorrect.'
            });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        await updateUserPassword(userId, hashedNewPassword);

        res.json({
            status: 200,
            message: 'Password updated successfully.'
        });

    } catch (error) {
        console.error('Password update error:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to update password.'
        });
    }
});

router.get('/verify', authMiddleware, async (req, res) => {
    try {
        res.json({
            status: 200,
            user: req.user
        });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to verify token.'
        });
    }
});

const axios = require('axios');
const { storeOTP, verifyOTP, deleteOTP } = require('../db');

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'https://api-rho-seven-96.vercel.app';

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: 400,
                error: 'Email is required.'
            });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({
                status: 404,
                error: 'No account found with this email address.'
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
            await deleteOTP(email);
            return res.status(500).json({
                status: 500,
                error: 'Failed to send reset email. Please try again.'
            });
        }

        res.json({
            status: 200,
            message: 'Password reset OTP sent to your email.',
            email: email,
            expiresIn: 5
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to process password reset request.'
        });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword, confirmNewPassword } = req.body;

        if (!email || !otp || !newPassword || !confirmNewPassword) {
            return res.status(400).json({
                status: 400,
                error: 'All fields are required.'
            });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({
                status: 400,
                error: 'Passwords do not match.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                status: 400,
                error: 'Password must be at least 6 characters long.'
            });
        }

        const isValidOTP = await verifyOTP(email, otp);
        if (!isValidOTP) {
            return res.status(400).json({
                status: 400,
                error: 'Invalid or expired OTP. Please request a new one.'
            });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({
                status: 404,
                error: 'User not found.'
            });
        }

        await updateUserPassword(user.userId, newPassword);
        await deleteOTP(email);

        res.json({
            status: 200,
            message: 'Password reset successfully. You can now login with your new password.'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to reset password. Please try again.'
        });
    }
});

router.post('/google-login', async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                status: 400,
                error: 'Google credential is required.'
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const email = payload['email'];
        const name = payload['name'];
        const picture = payload['picture'];

        let user = await findUserByEmail(email);

        if (!user) {
            const username = email.split('@')[0] + '_' + uuidv4().substring(0, 6);
            const randomPassword = uuidv4();
            const hashedPassword = await bcrypt.hash(randomPassword, 10);
            
            const result = await createUser(username, name, email, hashedPassword, null);
            const userId = result.userId;

            if (picture) {
                await updateUserProfile(userId, { pfp_url: picture });
            }
            
            user = await findUserById(userId);
        }

        if (user.status === 'suspended') {
            return res.status(403).json({
                status: 403,
                error: 'Account is suspended.'
            });
        }

        const token = jwt.sign(
            {
                userId: user.userId.toString(),
                username: user.username
            },
            process.env.JWT || 'secret',
            { expiresIn: '365d' }
        );

        res.json({
            status: 200,
            message: 'Google login successful.',
            token,
            user: {
                userId: user.userId,
                username: user.username,
                fullname: user.fullname,
                email: user.email,
                pfp_url: user.pfp_url,
                isPremium: !!user.isPremium,
                premiumExpiration: user.premiumExpiration,
                status: user.status
            }
        });

    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({
            status: 500,
            error: 'Google login failed. Please try again.'
        });
    }
});

router.post('/logout', authMiddleware, (req, res) => {
    res.json({
        status: 200,
        message: 'Logged out successfully.'
    });
});

router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                status: 400,
                error: 'File too large. Max size is 5MB.'
            });
        }
        return res.status(400).json({
            status: 400,
            error: `Upload error: ${err.message}`
        });
    } else if (err.message.includes('Only image files')) {
        return res.status(400).json({
            status: 400,
            error: err.message
        });
    }
    next(err);
});

module.exports = router;