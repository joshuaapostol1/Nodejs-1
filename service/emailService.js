
require('dotenv').config();

process.removeAllListeners('warning');
process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
        return;
    }
    console.warn(warning.name, warning.message);
});

const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

app.get('/api/send-otp', async (req, res) => {
    try {
        const { email, otp, fullname, type } = req.query;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                error: 'Email and OTP are required'
            });
        }

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('Email credentials not configured');
            return res.status(500).json({
                success: false,
                error: 'Email service not configured'
            });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        let htmlContent, subject, textContent;

        if (type === 'password-reset') {
            subject = `Password Reset Code - ${otp}`;
            htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - Share Boost</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <tr>
                        <td style="background-color: #dc2626; padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Password Reset Request</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hello ${fullname || 'User'},</p>
                            <p style="margin: 0 0 30px 0; font-size: 14px; color: #666666; line-height: 1.6;">
                                We received a request to reset your Share Boost account password. Use the verification code below to proceed with your password reset:
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center" style="background-color: #f8f8f8; border: 2px solid #dc2626; border-radius: 6px; padding: 25px;">
                                        <p style="margin: 0 0 10px 0; font-size: 12px; color: #666666; text-transform: uppercase; letter-spacing: 1px;">Verification Code</p>
                                        <p style="margin: 0; font-size: 36px; font-weight: bold; color: #dc2626; letter-spacing: 8px; font-family: monospace;">${otp}</p>
                                        <p style="margin: 10px 0 0 0; font-size: 12px; color: #666666;">Valid for 5 minutes</p>
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 4px;">
                                        <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #856404;">SECURITY WARNING</p>
                                        <p style="margin: 0; font-size: 13px; color: #856404; line-height: 1.6;">
                                            Never share this code with anyone. Share Boost staff will never ask for your verification code. 
                                            If you did not request this password reset, please ignore this email and ensure your account is secure.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 20px; border-radius: 4px;">
                                        <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #721c24;">IMPORTANT</p>
                                        <p style="margin: 0; font-size: 13px; color: #721c24; line-height: 1.6;">
                                            This code is confidential and for your use only. Do not forward this email or share the code with anyone, including Share Boost support team members.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8f8f8; padding: 25px 30px; border-top: 1px solid #e0e0e0; text-align: center;">
                            <p style="margin: 0 0 10px 0; font-size: 12px; color: #999999;">
                                This email was sent to ${email}
                            </p>
                            <p style="margin: 0 0 15px 0; font-size: 12px; color: #999999;">
                                If you didn't request this, please secure your account immediately.
                            </p>
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #333333;">Share Boost</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
            textContent = `Hello ${fullname || 'User'},\n\nYour password reset code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nSECURITY WARNING: Never share this code with anyone! Share Boost will never ask for your verification code.\n\nIMPORTANT: This code is confidential and for your use only. Do not forward this email or share the code with anyone.\n\nIf you didn't request this password reset, please ignore this email and secure your account immediately.`;
        } else {
            subject = `Email Verification Code - ${otp}`;
            htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification - Share Boost</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <tr>
                        <td style="background-color: #7C3AED; padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Welcome to Share Boost</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hello ${fullname || 'User'},</p>
                            <p style="margin: 0 0 20px 0; font-size: 14px; color: #666666; line-height: 1.6;">
                                Thank you for joining Share Boost. To complete your registration and verify your email address, please use the verification code below:
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center" style="background-color: #f8f8f8; border: 2px solid #7C3AED; border-radius: 6px; padding: 25px;">
                                        <p style="margin: 0 0 10px 0; font-size: 12px; color: #666666; text-transform: uppercase; letter-spacing: 1px;">Verification Code</p>
                                        <p style="margin: 0; font-size: 36px; font-weight: bold; color: #7C3AED; letter-spacing: 8px; font-family: monospace;">${otp}</p>
                                        <p style="margin: 10px 0 0 0; font-size: 12px; color: #666666;">Valid for 5 minutes</p>
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 4px;">
                                        <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #856404;">SECURITY WARNING</p>
                                        <p style="margin: 0; font-size: 13px; color: #856404; line-height: 1.6;">
                                            Never share this code with anyone. Share Boost staff will never ask for your verification code. 
                                            This code is confidential and should only be entered on the Share Boost verification page.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td style="background-color: #d1ecf1; border-left: 4px solid #17a2b8; padding: 20px; border-radius: 4px;">
                                        <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #0c5460;">PROTECT YOUR ACCOUNT</p>
                                        <p style="margin: 0; font-size: 13px; color: #0c5460; line-height: 1.6;">
                                            Keep this code private. Do not forward this email or share the code with anyone. If you receive requests for this code, report them immediately.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8f8f8; padding: 25px 30px; border-top: 1px solid #e0e0e0; text-align: center;">
                            <p style="margin: 0 0 10px 0; font-size: 12px; color: #999999;">
                                This email was sent to ${email}
                            </p>
                            <p style="margin: 0 0 15px 0; font-size: 12px; color: #999999;">
                                If you didn't create this account, please ignore this email.
                            </p>
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #333333;">Share Boost</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
            textContent = `Hello ${fullname || 'User'},\n\nWelcome to Share Boost!\n\nYour verification code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nSECURITY WARNING: Never share this code with anyone! Share Boost will never ask for your verification code. This code is confidential and should only be entered on the Share Boost verification page.\n\nPROTECT YOUR ACCOUNT: Keep this code private. Do not forward this email or share the code with anyone.\n\nIf you didn't create this account, please ignore this email.`;
        }

        const mailOptions = {
            from: {
                name: 'Share Boost',
                address: process.env.EMAIL_USER
            },
            to: email,
            subject: subject,
            html: htmlContent,
            text: textContent
        };

        await transporter.sendMail(mailOptions);
        console.log(`OTP email sent successfully to ${email}`);

        res.json({
            success: true,
            message: 'Email sent successfully'
        });

    } catch (error) {
        console.error('Error sending OTP email:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send email'
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'email' });
});

app.listen(PORT, () => {
    console.log(`Email service running on port ${PORT}`);
});
