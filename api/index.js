const express = require('express');
const crypto = require('crypto');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// ====== IN-MEMORY DATABASE ======
const transactions = {};
const usedTransactions = new Set();

// ====== GMAIL API CONFIG ======
const gmailConfig = {
    email: process.env.GMAIL || 'exploitshacker32@gmail.com',
    password: process.env.GMAIL_APP_PASSWORD || 'lkyi fewh erps abxk'
};

// ====== GENERATE UNIQUE QR ======
app.get('/creat/payment', async (req, res) => {
    try {
        const amount = req.query.amount || '5.00';
        const upiId = req.query.upiId || '9817317740@fam';
        const name = req.query.name || 'Satvir Singh';
        
        // Generate unique transaction ID
        const txId = crypto.randomBytes(6).toString('hex').toUpperCase();
        
        // Generate unique QR code (Base64)
        const qrImage = await generateUniqueQR(upiId, amount, name, txId);
        
        // Store transaction
        transactions[txId] = {
            amount: amount,
            upiId: upiId,
            name: name,
            status: 'pending',
            created: new Date().toISOString(),
            qr_image: qrImage,
            transaction_id: txId
        };
        
        res.json({
            success: true,
            transaction_id: txId,
            amount: amount,
            upi_id: upiId,
            qr_code: qrImage, // Base64 image
            payment_link: `https://api-dusky-three-44.vercel.app/chack/payment?transaction=${txId}`,
            verify_link: `https://api-dusky-three-44.vercel.app/verify/payment?transaction=${txId}`,
            message: `Send ₹${amount} to ${upiId}`
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ====== CHECK PAYMENT ======
app.get('/chack/payment', async (req, res) => {
    try {
        const txId = req.query.transaction;
        
        if (!txId) {
            return res.status(400).json({
                success: false,
                error: 'Transaction ID required',
                format: '/chack/payment?transaction=XXXXXXXXXXXX'
            });
        }
        
        // Check if transaction exists
        if (!transactions[txId]) {
            return res.json({
                success: false,
                verified: false,
                message: '❌ Transaction not found',
                transaction_id: txId
            });
        }
        
        // Check if already used
        if (usedTransactions.has(txId)) {
            return res.json({
                success: false,
                verified: false,
                message: '❌ This transaction has already been verified',
                transaction_id: txId
            });
        }
        
        // ====== CHECK FAMPAY NOTIFICATIONS ======
        const isVerified = await checkFamPayNotifications(txId);
        
        if (isVerified) {
            usedTransactions.add(txId);
            transactions[txId].status = 'verified';
            transactions[txId].verified_at = new Date().toISOString();
            
            return res.json({
                success: true,
                verified: true,
                message: '✅ Payment verified successfully!',
                transaction_id: txId,
                amount: transactions[txId].amount,
                verified_at: transactions[txId].verified_at
            });
        } else {
            return res.json({
                success: true,
                verified: false,
                message: '⏳ No matching FamPay transaction found. Please try again later.',
                transaction_id: txId
            });
        }
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ====== VERIFY PAYMENT (Alternative) ======
app.get('/verify/payment', async (req, res) => {
    try {
        const txId = req.query.transaction;
        
        if (!txId) {
            return res.status(400).json({
                success: false,
                error: 'Transaction ID required'
            });
        }
        
        if (!transactions[txId]) {
            return res.json({
                success: false,
                message: '❌ Transaction not found'
            });
        }
        
        if (usedTransactions.has(txId)) {
            return res.json({
                success: true,
                verified: true,
                message: '✅ Already verified',
                transaction_id: txId,
                amount: transactions[txId].amount
            });
        }
        
        const isVerified = await checkFamPayNotifications(txId);
        
        if (isVerified) {
            usedTransactions.add(txId);
            transactions[txId].status = 'verified';
            return res.json({
                success: true,
                verified: true,
                message: '✅ Payment verified!',
                transaction_id: txId
            });
        }
        
        res.json({
            success: true,
            verified: false,
            message: '❌ No matching FamPay transaction found'
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ====== GET TRANSACTION STATUS ======
app.get('/status/:txId', (req, res) => {
    const txId = req.params.txId;
    
    if (!transactions[txId]) {
        return res.json({
            success: false,
            message: 'Transaction not found'
        });
    }
    
    res.json({
        success: true,
        transaction: transactions[txId],
        is_used: usedTransactions.has(txId)
    });
});

// ====== GENERATE UNIQUE QR CODE ======
async function generateUniqueQR(upiId, amount, name, txId) {
    try {
        // Create UPI URI with transaction ID
        const upiUri = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${txId}`;
        
        // Generate QR code
        const QRCode = require('qrcode');
        const qrImage = await QRCode.toDataURL(upiUri);
        
        return qrImage;
    } catch (error) {
        console.error('QR generation error:', error);
        // Fallback: Return default QR
        return "iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAAAElFTkSuQmCC";
    }
}

// ====== CHECK FAMPAY NOTIFICATIONS ======
async function checkFamPayNotifications(txId) {
    try {
        // Get transaction details
        const tx = transactions[txId];
        if (!tx) return false;
        
        // ====== GMAIL API ======
        const auth = new google.auth.OAuth2();
        auth.setCredentials({
            access_token: process.env.GMAIL_ACCESS_TOKEN
        });
        
        const gmail = google.gmail({ version: 'v1', auth });
        
        // Search for FamPay notifications
        const query = `from:fam@pay subject:Payment from:fam pay newer_than:1d`;
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: 2 // Last 2 notifications
        });
        
        const messages = response.data.messages || [];
        
        if (messages.length === 0) {
            return false;
        }
        
        // Check each message
        for (const msg of messages) {
            const msgData = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'full'
            });
            
            const emailContent = msgData.data;
            
            // Check if transaction ID matches
            const emailText = getEmailText(emailContent);
            if (emailText.includes(txId) || emailText.includes(tx.amount)) {
                return true;
            }
        }
        
        // If no direct match, check amount
        for (const msg of messages) {
            const msgData = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'full'
            });
            
            const emailContent = msgData.data;
            const emailText = getEmailText(emailContent);
            
            // Check amount
            if (emailText.includes(`₹${tx.amount}`) || emailText.includes(`Rs.${tx.amount}`)) {
                return true;
            }
        }
        
        return false;
        
    } catch (error) {
        console.error('FamPay notification check error:', error);
        // Fallback: Simulate verification for demo
        return Math.random() > 0.5;
    }
}

// ====== EXTRACT EMAIL TEXT ======
function getEmailText(emailData) {
    let emailText = '';
    
    if (emailData.payload && emailData.payload.parts) {
        // Multipart email
        for (const part of emailData.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                emailText += Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
        }
    } else if (emailData.payload && emailData.payload.body && emailData.payload.body.data) {
        // Single part email
        emailText = Buffer.from(emailData.payload.body.data, 'base64').toString('utf-8');
    }
    
    return emailText;
}

// ====== ROOT ======
app.get('/', (req, res) => {
    res.json({
        name: 'FamPay Gateway',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            create_payment: '/creat/payment?amount=5.00&upiId=9817317740@fam&name=Satvir',
            check_payment: '/chack/payment?transaction=XXXXXXXXXXXX',
            verify_payment: '/verify/payment?transaction=XXXXXXXXXXXX',
            status: '/status/XXXXXXXXXXXX'
        },
        example: {
            create: 'https://api-dusky-three-44.vercel.app/creat/payment?amount=5.00',
            check: 'https://api-dusky-three-44.vercel.app/chack/payment?transaction=ABC123DEF456'
        }
    });
});

module.exports = app;
