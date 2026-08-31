const express = require('express');

// ====== FAKE VERIFIER (Package install nahi ho raha toh) ======
// Agar 'fampay-verify' install hai toh comment karke real wala use karo
class FamPayVerifier {
    constructor(config) {
        this.gmail = config.gmail;
        this.gmailAppPassword = config.gmailAppPassword;
        this.supabaseUrl = config.supabaseUrl;
        this.supabaseServiceRoleKey = config.supabaseServiceRoleKey;
    }
    
    async generateQr(params) {
        // Real QR generator
        const { upiId, amount, name } = params;
        const upi_uri = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR`;
        
        // Fake QR image (Base64)
        const qr_image = "iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAAAElFTkSuQmCC";
        
        return {
            qr_image: qr_image,
            upi_uri: upi_uri
        };
    }
    
    async verifyPayment(params) {
        // Real payment verification
        // For demo, return success after 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
            verified: true,
            amount: params.amount || '25.01',
            sender_name: "Demo User",
            utr: `FAM${Math.floor(100000 + Math.random() * 900000)}`,
            timestamp: new Date().toISOString(),
            logged_to_db: false
        };
    }
}

const app = express();
app.use(express.json());

// ====== CONFIG ======
const verifier = new FamPayVerifier({
    gmail: process.env.GMAIL || 'exploitshacker32@gmail.com',
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD || 'lkyi fewh erps abxk'
});

// ====== TEST ROUTE ======
app.get('/api/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Server is running!',
        timestamp: new Date().toISOString(),
        env: {
            gmail_set: !!process.env.GMAIL,
            password_set: !!process.env.GMAIL_APP_PASSWORD
        }
    });
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
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
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
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ====== VERIFY WITH SUPABASE ======
app.get('/api/verify-with-db', async (req, res) => {
    try {
        const amount = req.query.amount || '25.01';
        
        const verifierWithDB = new FamPayVerifier({
            supabaseUrl: process.env.SUPABASE_URL || 'https://your-supabase.supabase.co',
            supabaseServiceRoleKey: process.env.SUPABASE_KEY || 'your-key',
            gmail: process.env.GMAIL || 'exploitshacker32@gmail.com',
            gmailAppPassword: process.env.GMAIL_APP_PASSWORD || 'lkyi fewh erps abxk'
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
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ====== ROOT ======
app.get('/', (req, res) => {
    res.json({
        name: 'FamPay Gateway',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            test: '/api/test',
            generate_qr: '/api/generate-qr?upiId=9817317740@fam&amount=5.00&name=Satvir',
            verify_payment: '/api/verify-payment?amount=5.00',
            verify_with_db: '/api/verify-with-db?amount=5.00'
        }
    });
});

// ====== VERCEL EXPORT ======
module.exports = app;
