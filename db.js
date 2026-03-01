const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const SALT_ROUNDS = 10;
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'josh';
const DEFAULT_PFP_URL = null;

const pool = new Pool({
    connectionString:  'postgresql://neondb_owner:npg_VzvlcPuiLI48@ep-raspy-mouse-afw8pycm-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: {
        rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
    console.log('Connected to PostgreSQL (Neon)');
});

pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
});

async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                userId TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                fullname TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                pfp_url TEXT DEFAULT NULL,
                isPremium BOOLEAN DEFAULT false,
                premiumExpiration TIMESTAMP DEFAULT NULL,
                createdAt TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '8 hours'),
                status TEXT DEFAULT 'active'
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                message TEXT,
                image_url TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_unsent INTEGER DEFAULT 0,
                reply_to_message_id INTEGER NULL,
                FOREIGN KEY (user_id) REFERENCES users(userId) ON DELETE CASCADE,
                FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS message_reactions (
                id SERIAL PRIMARY KEY,
                message_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                reaction_emoji TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(userId) ON DELETE CASCADE,
                UNIQUE(message_id, user_id)
            )
        `);
        
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id)`);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS ip_usage (
                ip_address TEXT PRIMARY KEY,
                usage_count INTEGER DEFAULT 0,
                last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS premium_requests (
                requestId TEXT PRIMARY KEY,
                userId TEXT NOT NULL,
                username TEXT NOT NULL,
                planRequested TEXT NOT NULL,
                requestTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'pending',
                FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS free_trial_ips (
                ip_address TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(userId) ON DELETE CASCADE
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS ip_registrations (
                id SERIAL PRIMARY KEY,
                ip_address TEXT NOT NULL,
                user_id TEXT NOT NULL UNIQUE,
                registration_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(userId) ON DELETE CASCADE
            )
        `);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_ip_reg_address ON ip_registrations (ip_address)`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                type TEXT DEFAULT 'info',
                created_by TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(userId) ON DELETE CASCADE
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS otps (
                email TEXT PRIMARY KEY,
                otp TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resend_count INTEGER DEFAULT 0
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS pending_users (
                email TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                fullname TEXT NOT NULL,
                password TEXT NOT NULL,
                pfp_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                api_key TEXT UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(userId) ON DELETE CASCADE
            )
        `);

        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'api_keys_id_seq'
                ) THEN
                    CREATE SEQUENCE api_keys_id_seq;
                    ALTER TABLE api_keys ALTER COLUMN id SET DEFAULT nextval('api_keys_id_seq');
                    ALTER SEQUENCE api_keys_id_seq OWNED BY api_keys.id;
                END IF;
            END $$;
        `);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys (api_key)`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_cookies (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE REFERENCES users(userId) ON DELETE CASCADE,
                cookie_data TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await createAdminUserIfNotExists();
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
    } finally {
        client.release();
    }
}

async function createAdminUserIfNotExists() {
    try {
        const adminExists = await findUserByUsername(ADMIN_USERNAME);
        if (!adminExists) {
            if (!ADMIN_PASSWORD) {
                console.error("FATAL: ADMIN_PASSWORD is not set. Cannot create admin.");
                return;
            }
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
            const adminUserId = String(Date.now() + Math.floor(Math.random() * 100000));

            const client = await pool.connect();
            try {
                await client.query(`
                    INSERT INTO users (userId, username, fullname, email, password, pfp_url, isPremium, premiumExpiration, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, 'active')
                    ON CONFLICT (username) DO UPDATE SET
                        isPremium = EXCLUDED.isPremium,
                        status = EXCLUDED.status
                `, [adminUserId, ADMIN_USERNAME, 'Admin User', 'admin@localhost', hashedPassword, DEFAULT_PFP_URL, true]);
                console.log("Admin user created/verified.");
            } finally {
                client.release();
            }
        } else {
            if (!adminExists.ispremium || adminExists.status !== 'active') {
                const client = await pool.connect();
                try {
                    await client.query(`
                        UPDATE users SET isPremium = true, premiumExpiration = NULL, status = 'active'
                        WHERE username = $1
                    `, [ADMIN_USERNAME]);
                    console.log("Admin user status updated to active/premium.");
                } finally {
                    client.release();
                }
            }
        }
    } catch (error) {
        console.error("Error checking/creating admin user:", error);
    }
}

const createUser = (username, fullname, email, password, pfp_url = DEFAULT_PFP_URL) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            const userId = String(Date.now() + Math.floor(Math.random() * 100000));
            const finalPfpUrl = pfp_url && pfp_url.trim() !== '' ? pfp_url : DEFAULT_PFP_URL;

            await client.query(`
                INSERT INTO users (userId, username, fullname, email, password, pfp_url, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'active')
            `, [userId, username.toLowerCase(), fullname, email.toLowerCase(), hashedPassword, finalPfpUrl]);

            resolve({ userId, username: username.toLowerCase() });
        } catch (err) {
            if (err.constraint === 'users_username_key') {
                reject(new Error('Username already exists.'));
            } else if (err.constraint === 'users_email_key') {
                reject(new Error('Email already exists.'));
            } else {
                reject(err);
            }
        } finally {
            client.release();
        }
    });
};

const findUserByUsername = (username) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    userId as "userId", 
                    username, 
                    fullname, 
                    email, 
                    password, 
                    pfp_url, 
                    isPremium as "isPremium", 
                    premiumExpiration as "premiumExpiration", 
                    createdAt as "createdAt", 
                    status
                FROM users WHERE username = $1
            `, [username.toLowerCase()]);
            resolve(result.rows[0] || null);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const findUserByEmail = (email) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    userId as "userId", 
                    username, 
                    fullname, 
                    email, 
                    password, 
                    pfp_url, 
                    isPremium as "isPremium", 
                    premiumExpiration as "premiumExpiration", 
                    createdAt as "createdAt", 
                    status
                FROM users WHERE email = $1
            `, [email.toLowerCase()]);
            resolve(result.rows[0] || null);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const findUserById = (userId) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    userId as "userId", 
                    username, 
                    fullname, 
                    email, 
                    password, 
                    pfp_url, 
                    isPremium as "isPremium", 
                    premiumExpiration as "premiumExpiration", 
                    createdAt as "createdAt", 
                    status
                FROM users WHERE userId = $1
            `, [userId]);
            resolve(result.rows[0] || null);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const getAllUsers = () => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    userId as "userId", 
                    username, 
                    fullname, 
                    email, 
                    pfp_url, 
                    isPremium as "isPremium", 
                    premiumExpiration as "premiumExpiration", 
                    createdAt as "createdAt", 
                    status
                FROM users ORDER BY createdAt DESC
            `);
            resolve(result.rows);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const updateUserProfile = (userId, updates) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            if (typeof updates === 'string') {
                const fullname = updates;
                const username = arguments[2];
                const email = arguments[3];
                const pfpUrl = arguments[4];

                if (!fullname || !username || !email) {
                    reject(new Error('All required fields must be provided'));
                    return;
                }

                const result = await client.query(`
                    UPDATE users SET fullname = $1, username = $2, email = $3, pfp_url = $4
                    WHERE userId = $5
                `, [fullname, username, email, pfpUrl, userId]);
                resolve({ changes: result.rowCount });
            } else {
                const updateFields = [];
                const updateValues = [];
                let paramIndex = 1;

                if (updates.fullname !== undefined) {
                    updateFields.push(`fullname = $${paramIndex++}`);
                    updateValues.push(updates.fullname);
                }
                if (updates.username !== undefined) {
                    updateFields.push(`username = $${paramIndex++}`);
                    updateValues.push(updates.username);
                }
                if (updates.email !== undefined) {
                    updateFields.push(`email = $${paramIndex++}`);
                    updateValues.push(updates.email);
                }
                if (updates.pfp_url !== undefined) {
                    updateFields.push(`pfp_url = $${paramIndex++}`);
                    updateValues.push(updates.pfp_url);
                }

                if (updateFields.length === 0) {
                    reject(new Error('No fields to update'));
                    return;
                }

                updateValues.push(userId);
                const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE userId = $${paramIndex}`;

                const result = await client.query(sql, updateValues);
                resolve({ changes: result.rowCount });
            }
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const updateUserPassword = (userId, newPassword) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
            const result = await client.query(`
                UPDATE users SET password = $1 WHERE userId = $2
            `, [hashedPassword, userId]);

            if (result.rowCount === 0) {
                reject(new Error('User not found.'));
            } else {
                resolve(true);
            }
        } catch (err) {
            reject(new Error('Error hashing new password.'));
        } finally {
            client.release();
        }
    });
};

const updateUserPremiumStatus = (userId, isPremium, expirationDate = null) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const premiumValue = isPremium ? true : false;
            const expirationValue = isPremium && expirationDate instanceof Date && !isNaN(expirationDate) ? expirationDate.toISOString() : null;

            const result = await client.query(`
                UPDATE users SET isPremium = $1, premiumExpiration = $2 WHERE userId = $3
            `, [premiumValue, expirationValue, userId]);

            if (result.rowCount === 0) {
                reject(new Error('User not found or premium status unchanged.'));
            } else {
                resolve(true);
            }
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const comparePassword = async (plainPassword, hashedPassword) => {
    if (!plainPassword || !hashedPassword) return false;
    try {
        return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (compareError) {
        return false;
    }
};

const getIpUsage = (ip) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT usage_count FROM ip_usage WHERE ip_address = $1
            `, [ip]);
            resolve(result.rows[0] ? result.rows[0].usage_count : 0);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const incrementIpUsage = (ip) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            await client.query(`
                INSERT INTO ip_usage (ip_address, usage_count, last_used)
                VALUES ($1, 0, CURRENT_TIMESTAMP)
                ON CONFLICT (ip_address) DO NOTHING
            `, [ip]);

            await client.query(`
                UPDATE ip_usage SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
                WHERE ip_address = $1
            `, [ip]);

            const count = await getIpUsage(ip);
            resolve(count);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const getAllIpUsage = () => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT ip_address, usage_count, last_used FROM ip_usage ORDER BY last_used DESC
            `);
            resolve(result.rows);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const resetIpUsage = (ip) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                UPDATE ip_usage SET usage_count = 0 WHERE ip_address = $1
            `, [ip]);
            resolve(result.rowCount > 0);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const deleteIpRecord = (ip) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                DELETE FROM ip_usage WHERE ip_address = $1
            `, [ip]);
            resolve(result.rowCount > 0);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const deleteIpRegistrations = (ip) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                DELETE FROM ip_registrations WHERE ip_address = $1
            `, [ip]);
            console.log(`Registrations deleted for IP ${ip}: ${result.rowCount} row(s) affected.`);
            resolve(result.rowCount);
        } catch (err) {
            console.error(`DB Error deleting registrations for IP ${ip}:`, err.message);
            reject(err);
        } finally {
            client.release();
        }
    });
};

const checkIpForTrial = (ip) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT 1 FROM free_trial_ips WHERE ip_address = $1
            `, [ip]);
            resolve(result.rows.length > 0);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const recordIpTrial = (ip, userId) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            await client.query(`
                INSERT INTO free_trial_ips (ip_address, user_id) VALUES ($1, $2)
            `, [ip, userId]);
            resolve(true);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const countRegistrationsByIp = (ip) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT COUNT(DISTINCT user_id) as count FROM ip_registrations WHERE ip_address = $1
            `, [ip]);
            resolve(result.rows[0] ? parseInt(result.rows[0].count) : 0);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const getAllRegistrationIps = () => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT ip_address, COUNT(DISTINCT user_id) as count FROM ip_registrations GROUP BY ip_address
            `);
            const counts = {};
            result.rows.forEach(row => {
                counts[row.ip_address] = parseInt(row.count);
            });
            resolve(counts);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const recordRegistrationIp = (ip, userId) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            await client.query(`
                INSERT INTO ip_registrations (ip_address, user_id) VALUES ($1, $2)
            `, [ip, userId]);
            resolve(true);
        } catch (err) {
            if (err.constraint === 'ip_registrations_user_id_key') {
                resolve(true);
            } else {
                reject(err);
            }
        } finally {
            client.release();
        }
    });
};

const updateUserAccountStatus = (userId, status) => {
    return new Promise(async (resolve, reject) => {
        const allowedStatuses = ['active', 'suspended'];
        if (!allowedStatuses.includes(status)) return reject(new Error('Invalid status.'));

        const client = await pool.connect();
        try {
            const user = await findUserById(userId);
            if (!user) {
                return reject(new Error('User not found.'));
            }
            if (user.username === ADMIN_USERNAME && status === 'suspended') {
                return reject(new Error('Cannot suspend the admin account.'));
            }

            const result = await client.query(`
                UPDATE users SET status = $1 WHERE userId = $2
            `, [status, userId]);

            if (result.rowCount === 0) {
                reject(new Error('User not found or status unchanged.'));
            } else {
                resolve(true);
            }
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const addPremiumRequest = (userId, username, planRequested) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const requestId = uuidv4();
            await client.query(`
                INSERT INTO premium_requests (requestId, userId, username, planRequested)
                VALUES ($1, $2, $3, $4)
            `, [requestId, userId, username, planRequested]);
            resolve(requestId);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const getPendingPremiumRequests = () => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    pr.requestId::text as "requestId", 
                    pr.userId as "userId", 
                    pr.username as "username", 
                    pr.planRequested as "planRequested", 
                    pr.requestTimestamp as "requestTimestamp", 
                    pr.status as "status", 
                    u.isPremium as "currentPremiumStatus"
                FROM premium_requests pr
                JOIN users u ON pr.userId = u.userId
                WHERE pr.status = 'pending'
                ORDER BY pr.requestTimestamp ASC
            `);
            resolve(result.rows);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const updatePremiumRequestStatus = (requestId, status) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                UPDATE premium_requests SET status = $1 WHERE requestId::text = $2
            `, [status, String(requestId)]);

            if (result.rowCount === 0) {
                reject(new Error('Request not found or status unchanged.'));
            } else {
                resolve(true);
            }
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const deleteUserById = (userId) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const user = await findUserById(userId);
            if (!user) return reject(new Error('User not found.'));
            if (user.username === ADMIN_USERNAME) {
                return reject(new Error('Deleting the primary admin account is not allowed.'));
            }

            const result = await client.query(`
                DELETE FROM users WHERE userId = $1
            `, [userId]);

            if (result.rowCount === 0) {
                reject(new Error('User not found during delete or delete failed.'));
            } else {
                resolve(true);
            }
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const createAnnouncement = (title, content, type, createdBy) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                INSERT INTO announcements (title, content, type, created_by)
                VALUES ($1, $2, $3, $4) RETURNING id
            `, [title, content, type, createdBy]);
            resolve(result.rows[0].id);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const getAllAnnouncements = () => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT a.*, u.username as created_by_username
                FROM announcements a
                JOIN users u ON a.created_by = u.userId
                ORDER BY a.created_at DESC
            `);
            resolve(result.rows);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const deleteAnnouncement = (id) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                DELETE FROM announcements WHERE id = $1
            `, [id]);

            if (result.rowCount === 0) {
                reject(new Error('Announcement not found.'));
            } else {
                resolve(true);
            }
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const storePendingUser = (userData) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const { username, fullname, email, password, pfpPath } = userData;
            const result = await client.query(`
                INSERT INTO pending_users (email, username, fullname, password, pfp_url)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (email) DO UPDATE SET
                    username = EXCLUDED.username,
                    fullname = EXCLUDED.fullname,
                    password = EXCLUDED.password,
                    pfp_url = EXCLUDED.pfp_url,
                    created_at = CURRENT_TIMESTAMP
                RETURNING email
            `, [email, username, fullname, password, pfpPath]);
            resolve(result.rows[0].email);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const deletePendingUser = (email) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                DELETE FROM pending_users WHERE email = $1
            `, [email]);
            resolve(result.rowCount > 0);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const storeOTP = (email, otp, expiresAt, isResend = false) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            if (isResend) {
                await client.query(`
                    UPDATE otps SET otp = $1, expires_at = $2, created_at = $3, resend_count = COALESCE(resend_count, 0) + 1
                    WHERE email = $4
                `, [otp, expiresAt, new Date(), email]);
            } else {
                await client.query(`
                    INSERT INTO otps (email, otp, expires_at, created_at, resend_count)
                    VALUES ($1, $2, $3, $4, 0)
                    ON CONFLICT (email) DO UPDATE SET
                        otp = EXCLUDED.otp,
                        expires_at = EXCLUDED.expires_at,
                        created_at = EXCLUDED.created_at,
                        resend_count = 0
                `, [email, otp, expiresAt, new Date()]);
            }
            resolve();
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const verifyOTP = (email, otp) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT * FROM otps WHERE email = $1 AND otp = $2
            `, [email, otp]);

            if (result.rows.length === 0) {
                resolve(false);
            } else {
                const row = result.rows[0];
                const now = new Date();
                const expiresAt = new Date(row.expires_at);

                if (now > expiresAt) {
                    await client.query(`DELETE FROM otps WHERE email = $1`, [email]);
                    resolve(false);
                } else {
                    resolve(true);
                }
            }
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const deleteOTP = (email) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                DELETE FROM otps WHERE email = $1
            `, [email]);
            resolve(result.rowCount > 0);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const canResendOTP = (email) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT created_at, resend_count FROM otps WHERE email = $1
            `, [email]);

            if (result.rows.length === 0) {
                resolve(true);
            } else {
                const row = result.rows[0];
                const now = new Date();
                const createdAt = new Date(row.created_at);
                const timeDiff = now - createdAt;
                const resendCount = row.resend_count || 0;

                if (resendCount === 0) {
                    resolve(true);
                } else {
                    const canResend = timeDiff >= (50 * 1000);
                    resolve(canResend);
                }
            }
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const getPendingUser = (email) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT * FROM pending_users WHERE email = $1
            `, [email]);
            resolve(result.rows[0] || null);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const generateApiKey = (userId) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const crypto = require('crypto');
            const apiKey = 'sk_' + crypto.randomBytes(32).toString('hex');

            await client.query(`
                UPDATE api_keys SET is_active = false WHERE user_id = $1
            `, [userId]);

            const result = await client.query(`
                INSERT INTO api_keys (user_id, api_key, is_active)
                VALUES ($1, $2, true)
                RETURNING api_key
            `, [userId, apiKey]);

            resolve(result.rows[0].api_key);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const getApiKeyByKey = (apiKey) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT ak.*, u.userId, u.username, u.isPremium, u.premiumExpiration, u.status
                FROM api_keys ak
                JOIN users u ON ak.user_id = u.userId
                WHERE ak.api_key = $1 AND ak.is_active = true
            `, [apiKey]);
            resolve(result.rows[0] || null);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

const getUserApiKey = (userId) => {
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT api_key, created_at FROM api_keys 
                WHERE user_id = $1 AND is_active = true
                ORDER BY created_at DESC LIMIT 1
            `, [userId]);
            resolve(result.rows[0] || null);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }
    });
};

async function revokeApiKey(userId) {
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM api_keys WHERE user_id = $1', [userId]);
    } catch (error) {
        console.error('Error revoking API key:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function saveCookie(userId, cookieData) {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO user_cookies (user_id, cookie_data, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET cookie_data = $2, updated_at = CURRENT_TIMESTAMP
        `, [userId, cookieData]);
    } catch (error) {
        console.error('Error saving cookie:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function getCookie(userId) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT cookie_data, updated_at FROM user_cookies WHERE user_id = $1',
            [userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting cookie:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function deleteCookie(userId) {
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM user_cookies WHERE user_id = $1', [userId]);
    } catch (error) {
        console.error('Error deleting cookie:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    createUser,
    findUserByUsername,
    findUserByEmail,
    findUserById,
    getAllUsers,
    updateUserPremiumStatus,
    comparePassword,
    updateUserProfile,
    updateUserPassword,
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
    getApiKeyByKey,
    getUserApiKey,
    revokeApiKey,
    saveCookie,
    getCookie,
    deleteCookie,
    pool
};

initializeDatabase().catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});