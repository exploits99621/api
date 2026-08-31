const express = require('express');
const { FamPayVerifier } = require('fampay-verify');

const app = express();
app.use(express.json());

// ====== CONFIG ======
const verifier = new FamPayVerifier({
    gmail: process.env.GMAIL || 'exploitshacker32@gmail.com',
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD || 'lkyi fewh erps abxk'
});

// ====== GENERATE QR ======
app.get('/api/generate-qr', async (req, res) => {
    try {
        const upiId = req.query.upiId || '9817317740@fam';
        const amount = req.query.amount || '5.00';
        const name = req.query.name || 'Satvir Singh';
        
        const qrResult = await verifier.generateQr({
            upiId: upiId,
            amount: amount,
            name: name
        });
        
        res.json({
            success: true,
            qr_image: qrResult.qr_image,
            upi_uri: qrResult.upi_uri,
            amount: amount
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ====== VERIFY PAYMENT ======
app.get('/api/verify-payment', async (req, res) => {
    try {
        const amount = req.query.amount || '25.01';
        const result = await verifier.verifyPayment({ amount: amount });
        
        if (result.verified) {
            res.json({
                success: true,
                verified: true,
                message: `✅ Received ₹${result.amount} from ${result.sender_name}`,
                amount: result.amount,
                sender_name: result.sender_name,
                utr: result.utr,
                timestamp: result.timestamp
            });
        } else {
            res.json({
                success: true,
                verified: false,
                message: `❌ No payment of ₹${amount} found`
            });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ====== VERIFY WITH SUPABASE ======
app.get('/api/verify-with-db', async (req, res) => {
    try {
        const amount = req.query.amount || '25.01';
        
        const verifierWithDB = new FamPayVerifier({
            supabaseUrl: process.env.SUPABASE_URL || 'https://your-supabase.supabase.co',
            supabaseServiceRoleKey: process.env.SUPABASE_KEY || 'your-key',
            gmail: process.env.GMAIL || 'your_email@gmail.com',
            gmailAppPassword: process.env.GMAIL_APP_PASSWORD || 'your_app_password'
        });
        
        const result = await verifierWithDB.verifyPayment({ amount: amount });
        
        res.json({
            success: true,
            verified: result.verified,
            message: result.verified ? '✅ Payment verified and logged!' : '❌ No payment found',
            amount: result.amount,
            sender_name: result.sender_name,
            utr: result.utr,
            logged: result.logged_to_db || false
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ====== SERVE FRONTEND ======
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
});

// ====== VERCEL EXPORT ======
module.exports = app;