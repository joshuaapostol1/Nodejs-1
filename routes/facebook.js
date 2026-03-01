const express = require("express");
const login = require("ws3-fca");

const router = express.Router();

function ensureSessionAndAppState(req, res, next) {
    if (!req.session || !req.session.loggedIn || !req.session.appState) {
        if (req.session) {
            req.session.destroy(err => {
                if (err) console.error("Error destroying session in ensureSession:", err);
            });
            res.clearCookie('connect.sid');
        }
        return res.status(401).json({
            status: 401,
            loggedIn: false,
            error: "Hindi ka pa naka-login or expired na session mo."
        });
    }
    next();
}

function getApiFromSession(req, callback) {
    if (!req.session || !req.session.appState) {
        return callback(new Error("No appState found in session. Cannot initialize API."), null);
    }
    login({ appState: req.session.appState }, (err, api) => {
        if (err) {
            console.error("Re-login using session appState failed:", err.message || err);
            return callback(err, null);
        }
        callback(null, api);
    });
}

router.post("/login", (req, res) => {
    const { appState } = req.body;

    if (req.session && req.session.loggedIn && req.session.userId) {
         return res.status(200).json({
            status: 200,
            message: "May active session ka na.",
            loggedIn: true,
            userId: req.session.userId,
            profileGuard: req.session.isProfileGuardActive,
            pfpUrl: req.session.pfpUrl
        });
    }

    if (!appState || !Array.isArray(appState) || appState.length === 0) {
        return res.status(400).json({ status: 400, error: "Kailangan ng valid na appState (Array)." });
    }

    login({ appState }, (err, apiInstance) => {
        if (err) {
            console.error("Facebook Login Error:", err.message || err);
            let errorMessage = "Login failed. Check appState or network.";
             if (err.error === 'submit[Continue]' || err.message?.includes('checkpoint')) {
                errorMessage = "May lumabas na Checkpoint. Ayusin mo muna sa Facebook bago mag-login ulit.";
            } else if (err.error === 'Not logged in.' || err.message?.includes('Invalid appstate')) {
                errorMessage = "Invalid appState or expired na yung session. Subukan ulit.";
            }
            return res.status(401).json({ status: 401, loggedIn: false, error: errorMessage });
        }

        const currentUserId = apiInstance.getCurrentUserID();
        let currentUserPfp = null;
        let initialGuardState = false;

        console.log(`Login successful! User ID: ${currentUserId}`);

        apiInstance.getUserInfo(currentUserId, (userInfoErr, userInfoData) => {
            if (userInfoErr) {
                console.error(`Error getting user info for ${currentUserId}:`, userInfoErr.message || userInfoErr);
            } else if (userInfoData && userInfoData[currentUserId]) {
                const userData = userInfoData[currentUserId];
                currentUserPfp = userData.profileUrl || userData.thumbSrc || null;
                console.log(`PFP URL obtained for ${currentUserId}`);
            }

            req.session.regenerate(regenErr => {
                 if (regenErr) {
                    console.error("Error regenerating session:", regenErr);
                    return res.status(500).json({ status: 500, error: "Failed to initialize session." });
                 }

                req.session.loggedIn = true;
                req.session.userId = currentUserId;
                req.session.appState = appState;
                req.session.isProfileGuardActive = initialGuardState;
                req.session.pfpUrl = currentUserPfp;
                req.session.loginTimestamp = Date.now();

                req.session.save(saveErr => {
                    if(saveErr) {
                        console.error("Error saving session:", saveErr);
                        return res.status(500).json({ status: 500, error: "Failed to save session after login." });
                    }
                    res.status(200).json({
                        status: 200,
                        message: "Login successful.",
                        loggedIn: true,
                        userId: currentUserId,
                        profileGuard: initialGuardState,
                        pfpUrl: currentUserPfp
                    });
                });
            });
        });
    });
});

router.get("/status", (req, res) => {
    if (req.session && req.session.loggedIn && req.session.userId) {
        res.status(200).json({
            status: 200,
            loggedIn: true,
            userId: req.session.userId,
            profileGuard: req.session.isProfileGuardActive,
            pfpUrl: req.session.pfpUrl
        });
    } else {
        res.status(401).json({
            status: 401,
            loggedIn: false,
            error: "Hindi naka-login or expired na session mo."
        });
    }
});

router.post("/set-guard", ensureSessionAndAppState, (req, res) => {
    const { enable } = req.body;
    const userId = req.session.userId;

    if (typeof enable !== 'boolean') {
        return res.status(400).json({ status: 400, error: "Invalid request. Kailangan ng { 'enable': true } or { 'enable': false } sa body." });
    }

    getApiFromSession(req, (apiErr, api) => {
        if (apiErr || !api) {
             if (req.session) {
                req.session.destroy(destroyErr => {
                    if(destroyErr) console.error(`Error destroying session for ${userId} after getApi fail:`, destroyErr);
                });
                res.clearCookie('connect.sid');
             }
            return res.status(401).json({ status: 401, loggedIn: false, error: `Session invalid or re-login failed (${apiErr?.message || 'Unknown API init error'}). Please login again.` });
        }

        api.setProfileGuard(enable, (guardErr) => {
            if (guardErr) {
                console.error(`Error setting profile guard for ${userId}:`, guardErr.message || guardErr);
                 if (guardErr.error === 'Not logged in.' || guardErr.message?.includes('Invalid appstate') || guardErr.message?.includes('checkpoint')) {
                    if (req.session) {
                        req.session.destroy(destroyErr => {
                            if(destroyErr) console.error(`Error destroying session for ${userId} after guard auth fail:`, destroyErr);
                        });
                        res.clearCookie('connect.sid');
                    }
                    return res.status(401).json({ status: 401, loggedIn: false, error: "Session expired or encountered an issue. Please log in again." });
                }
                return res.status(500).json({ status: 500, error: "Nagka-error sa pag-update ng profile guard." });
            }

            if (req.session) {
                req.session.isProfileGuardActive = enable;
                req.session.save(saveErr => {
                    if(saveErr){
                        console.error(`Error saving session for ${userId} after setting guard:`, saveErr);
                         return res.status(500).json({ status: 500, error: "Guard updated on Facebook, but failed to save session state." });
                    }
                    console.log(`Profile guard successfully set to: ${enable} for user ${userId}`);
                    res.status(200).json({
                        status: 200,
                        message: `Profile guard successfully ${enable ? 'enabled' : 'disabled'}.`,
                        profileGuard: enable
                    });
                });
            } else {
                 console.error(`Session lost unexpectedly for ${userId} after successful guard set.`);
                 res.status(500).json({ status: 500, error: "Guard updated, but session state lost." });
            }
        });
    });
});

router.post("/logout", (req, res) => {
    const userId = req.session?.userId || 'UNKNOWN_USER';
    const appStateAvailable = !!req.session?.appState;

    if (!req.session) {
        return res.status(200).json({ status: 200, message: "Already logged out.", loggedIn: false });
    }

    const destroySessionAndRespond = (message = "Logged out successfully.") => {
        if (req.session) {
            req.session.destroy(err => {
                if (err) {
                    console.error(`Error destroying session for ${userId}:`, err);
                    res.clearCookie('connect.sid');
                    return res.status(500).json({ status: 500, error: "Error logging out.", loggedIn: false });
                }
                res.clearCookie('connect.sid');
                console.log(`Session destroyed successfully for ${userId}.`);
                return res.status(200).json({ status: 200, message: message, loggedIn: false });
            });
        } else {
             res.clearCookie('connect.sid');
             return res.status(200).json({ status: 200, message: "Logout processed (session was already inactive).", loggedIn: false });
        }
    };

    if (appStateAvailable) {
        getApiFromSession(req, (apiErr, api) => {
            if (!apiErr && api) {
                api.logout((logoutErr) => {
                    if (logoutErr) {
                        console.warn(`API logout call failed for ${userId} (ignoring error):`, logoutErr.message || logoutErr);
                    } else {
                        console.log(`API logout successful for user ${userId}.`);
                    }
                    destroySessionAndRespond();
                });
            } else {
                console.warn(`Could not init API for logout for ${userId} (error: ${apiErr?.message}). Destroying session anyway.`);
                destroySessionAndRespond("Logged out (API init failed).");
            }
        });
    } else {
        console.log(`No appState found for ${userId}, destroying session directly.`);
        destroySessionAndRespond();
    }
});

module.exports = router;