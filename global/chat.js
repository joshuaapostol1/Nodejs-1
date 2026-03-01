const express = require('express');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const fs = require('fs');
const {
    v4: uuidv4
} = require('uuid');
const {
    pool
} = require('../db');

const router = express.Router();

const chatStorage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed for chat!'), false);
    }
};

const chatUpload = multer({
    storage: chatStorage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

router.get('/messages', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const after = req.query.after || 0;

        const messagesResult = await client.query(`
            SELECT m.id, m.user_id, m.username, m.message, m.image_url, m.timestamp, 
                   m.is_unsent, m.reply_to_message_id
            FROM messages m
            WHERE m.id > $2
            ORDER BY m.id DESC
            LIMIT $1
        `, [limit, after]);

        const messages = messagesResult.rows;

        if (messages.length === 0) {
            return res.status(200).json([]);
        }

        const messageIds = messages.map(msg => msg.id);

        let reactionsMap = new Map();
        if (messageIds.length > 0 && messageIds.length <= 100) {
            const reactionPlaceholders = messageIds.map((_, i) => `$${i + 1}`).join(',');
            const reactionsResult = await client.query(`
                SELECT message_id, reaction_emoji, COUNT(*) as count, 
                       STRING_AGG(username, ',') as users
                FROM message_reactions
                WHERE message_id IN (${reactionPlaceholders})
                GROUP BY message_id, reaction_emoji
                ORDER BY message_id, count DESC
                LIMIT 500
            `, messageIds);

            reactionsResult.rows.forEach(row => {
                if (!reactionsMap.has(row.message_id)) {
                    reactionsMap.set(row.message_id, []);
                }
                reactionsMap.get(row.message_id).push({
                    emoji: row.reaction_emoji,
                    count: parseInt(row.count),
                    users: row.users.split(',')
                });
            });
        }

        const replyToIds = messages
            .map(msg => msg.reply_to_message_id)
            .filter(id => id !== null && id !== undefined);

        let repliedMessagesMap = new Map();
        if (replyToIds.length > 0) {
            const uniqueReplyToIds = [...new Set(replyToIds)];
            const placeholdersReply = uniqueReplyToIds.map((_, i) => `$${i + 1}`).join(',');
            const repliedResult = await client.query(`
                SELECT id, username, message, image_url, is_unsent 
                FROM messages WHERE id IN (${placeholdersReply})
            `, uniqueReplyToIds);

            repliedResult.rows.forEach(row => {
                repliedMessagesMap.set(row.id, {
                    username: row.username,
                    message: row.is_unsent ? '[Original message unsent]' :
                        (row.message ? row.message.substring(0, 50) + (row.message.length > 50 ? '...' : '') :
                            (row.image_url ? '[Image]' : '[Original message unavailable]')),
                    is_unsent: row.is_unsent
                });
            });
        }

        const userIds = [...new Set(messages.map(msg => msg.user_id))].filter(id => id !== null);

        let userInfoMap = new Map();
        if (userIds.length > 0) {
            const placeholdersUsers = userIds.map((_, i) => `$${i + 1}`).join(',');
            const usersResult = await client.query(`
                SELECT userid, pfp_url, status FROM users WHERE userid IN (${placeholdersUsers})
            `, userIds);

            usersResult.rows.forEach(user => {
                userInfoMap.set(String(user.userid), {
                    pfp_url: user.pfp_url,
                    status: user.status
                });
            });
        }

        const processedMessages = messages.map(msg => {
            const userInfo = userInfoMap.get(String(msg.user_id)) || {
                pfp_url: null,
                status: 'active'
            };

            const isSuspended = userInfo?.status === 'suspended';
            const repliedMessageDetails = msg.reply_to_message_id ?
                (repliedMessagesMap.get(msg.reply_to_message_id) || {
                    username: '?',
                    message: '[Original message unavailable]'
                }) : null;
            const messageReactions = reactionsMap.get(msg.id) || [];

            let baseMsg = {
                ...msg,
                pfp_url: userInfo?.pfp_url || null,
                is_suspended: false,
                is_unsent: false,
                repliedMessage: null,
                reactions: []
            };

            if (msg.is_unsent === 1) {
                baseMsg.message = `${msg.username} unsent a message`;
                baseMsg.image_url = null;
                baseMsg.is_unsent = true;
                baseMsg.reactions = [];
            } else if (isSuspended) {
                baseMsg.message = "This user is not available";
                baseMsg.image_url = null;
                baseMsg.is_suspended = true;
                baseMsg.reactions = messageReactions;
            } else {
                baseMsg.repliedMessage = repliedMessageDetails;
                baseMsg.reactions = messageReactions;
            }

            return baseMsg;
        }).sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

        res.status(200).json(processedMessages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to retrieve chat messages.'
        });
    } finally {
        client.release();
    }
});

router.post('/send', authMiddleware, express.json(), async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            message,
            replyToMessageId
        } = req.body;
        const user = req.user;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                status: 400,
                error: 'Message cannot be empty.'
            });
        }
        if (message.length > 500) {
            return res.status(400).json({
                status: 400,
                error: 'Message is too long (max 500 characters).'
            });
        }

        const replyId = (replyToMessageId && !isNaN(parseInt(replyToMessageId))) ? parseInt(replyToMessageId) : null;

        const result = await client.query(
            `INSERT INTO messages (user_id, username, message, image_url, is_unsent, reply_to_message_id) 
             VALUES ($1, $2, $3, NULL, 0, $4) RETURNING id`,
            [user.userId, user.username, message.trim(), replyId]
        );

        res.status(201).json({
            status: 201,
            message: 'Message sent successfully.',
            newMessageId: result.rows[0].id
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to send message.'
        });
    } finally {
        client.release();
    }
});

router.post('/send-image', authMiddleware, chatUpload.single('chat_image'), async (req, res) => {
    const client = await pool.connect();
    try {
        const user = req.user;
        const imageFile = req.file;

        if (!imageFile) {
            return res.status(400).json({
                status: 400,
                error: 'No image file provided.'
            });
        }

        const base64Image = imageFile.buffer.toString('base64');
        const extension = path.extname(imageFile.originalname).toLowerCase();
        const mimeType = extension === '.png' ? 'image/png' : 
                        extension === '.gif' ? 'image/gif' : 
                        extension === '.webp' ? 'image/webp' : 'image/jpeg';
        const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

        const replyToMessageId = req.body.replyToMessageId;
        const replyId = (replyToMessageId && !isNaN(parseInt(replyToMessageId))) ? parseInt(replyToMessageId) : null;

        await client.query(
            `INSERT INTO messages (user_id, username, message, image_url, is_unsent, reply_to_message_id) 
             VALUES ($1, $2, NULL, $3, 0, $4)`,
            [user.userId, user.username, imageDataUrl, replyId]
        );

        res.status(201).json({
            status: 201,
            message: 'Image sent successfully.',
            imageUrl: imageDataUrl
        });
    } catch (error) {
        console.error('Error sending image:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to send image.'
        });
    } finally {
        client.release();
    }
});

router.post('/message/:messageId/react', authMiddleware, express.json(), async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            messageId
        } = req.params;
        const {
            reaction_emoji
        } = req.body;
        const user = req.user;

        if (!messageId || isNaN(parseInt(messageId))) {
            return res.status(400).json({
                status: 400,
                error: 'Invalid message ID.'
            });
        }

        const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😠'];
        if (reaction_emoji !== null && reaction_emoji !== '' && !ALLOWED_REACTIONS.includes(reaction_emoji)) {
            return res.status(400).json({
                status: 400,
                error: 'Invalid or missing reaction emoji.'
            });
        }

        const msgId = parseInt(messageId);

        const messageExists = await client.query(
            `SELECT id FROM messages WHERE id = $1 AND is_unsent = 0`,
            [msgId]
        );

        if (messageExists.rows.length === 0) {
            return res.status(404).json({
                status: 404,
                error: 'Message not found or cannot be reacted to.'
            });
        }

        await client.query('BEGIN');

        if (reaction_emoji === null || reaction_emoji === '') {
            await client.query(
                `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2`,
                [msgId, user.userId]
            );
            await client.query('COMMIT');
            res.status(200).json({
                status: 200,
                message: 'Reaction removed.'
            });
        } else {
            await client.query(`
                INSERT INTO message_reactions (message_id, user_id, username, reaction_emoji)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (message_id, user_id) DO UPDATE SET
                    reaction_emoji = EXCLUDED.reaction_emoji,
                    timestamp = CURRENT_TIMESTAMP
            `, [msgId, user.userId, user.username, reaction_emoji]);

            await client.query('COMMIT');
            res.status(201).json({
                status: 201,
                message: 'Reaction saved.'
            });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing reaction:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to process reaction.'
        });
    } finally {
        client.release();
    }
});

router.put('/message/:messageId/unsend', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            messageId
        } = req.params;
        const user = req.user;

        if (!messageId || isNaN(parseInt(messageId))) {
            return res.status(400).json({
                status: 400,
                error: 'Invalid message ID.'
            });
        }

        await client.query('BEGIN');

        const messageResult = await client.query(
            `SELECT username FROM messages WHERE id = $1 AND user_id = $2 AND is_unsent = 0`,
            [messageId, user.userId]
        );

        if (messageResult.rows.length === 0) {
            await client.query('COMMIT');
            return res.status(404).json({
                status: 404,
                message: 'Message not found, already unsent, or permission denied.'
            });
        }

        const placeholder = `${messageResult.rows[0].username} unsent a message`;

        const updateResult = await client.query(
            `UPDATE messages SET message = $1, image_url = NULL, is_unsent = 1, reply_to_message_id = NULL 
             WHERE id = $2 AND user_id = $3 AND is_unsent = 0`,
            [placeholder, messageId, user.userId]
        );

        if (updateResult.rowCount === 0) {
            await client.query('COMMIT');
            return res.status(404).json({
                status: 404,
                message: 'Failed to update message during unsend.'
            });
        }

        await client.query('COMMIT');
        res.status(200).json({
            status: 200,
            message: 'Message unsent successfully.',
            placeholder: placeholder
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error unsending message:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to unsend message.'
        });
    } finally {
        client.release();
    }
});

router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error("Chat Multer Error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                status: 400,
                error: `Image too large. Limit is 5MB.`
            });
        }
        return res.status(400).json({
            status: 400,
            error: `Image upload error: ${err.message}`
        });
    } else if (err) {
        if (err.message === 'Only image files are allowed for chat!') {
            return res.status(400).json({
                status: 400,
                error: err.message
            });
        }
        console.error("Unhandled Chat Error:", err);
        res.status(500).json({
            status: 500,
            error: 'An internal server error occurred in chat.'
        });
    } else {
        next();
    }
});

module.exports = router;