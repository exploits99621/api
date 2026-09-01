const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// ====== IN-MEMORY DATABASE ======
const transactions = {};
const usedTransactions = new Set();

// ====== GENERATE UNIQUE QR (Without QRCode Package) ======
function generateFakeQR(upiId, amount, name, txId) {
    // Create UPI URI
    const upiUri = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${txId}`;
    
    // Fake QR code (Base64 image)
    // Real QR generate karne ke liye 'qrcode' package install karo
    const fakeQR = "iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAAAElFTkSuQmCC";
    
    return {
        qr_image: fakeQR,
        upi_uri: upiUri
    };
}

// ====== GENERATE QR CODE ======
app.get('/creat/payment', async (req, res) => {
    try {
        const amount = req.query.amount || '5.00';
        const upiId = req.query.upiId || '9817317740@fam';
        const name = req.query.name || 'Satvir Singh';
        
        // Generate unique transaction ID
        const txId = crypto.randomBytes(6).toString('hex').toUpperCase();
        
        // Generate QR
        const qr = generateFakeQR(upiId, amount, name, txId);
        
        // Store transaction
        transactions[txId] = {
            amount: amount,
            upiId: upiId,
            name: name,
            status: 'pending',
            created: new Date().toISOString(),
            qr_image: qr.qr_image,
            upi_uri: qr.upi_uri
        };
        
        res.json({
            success: true,
            transaction_id: txId,
            amount: amount,
            upi_id: upiId,
            qr_code: qr.qr_image,
            upi_uri: qr.upi_uri,
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
        
        // ====== FAKE EMAIL VERIFICATION ======
        // For demo: 70% success rate
        const isVerified = Math.random() > 0.3;
        
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
                message: '⏳ Payment not found. Please try again later.',
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
        
        // ====== FAKE EMAIL VERIFICATION ======
        const isVerified = Math.random() > 0.3;
        
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
            message: '❌ Payment not found'
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

// ====== TEST ROUTE ======
app.get('/api/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Server is running!',
        timestamp: new Date().toISOString(),
        transactions: Object.keys(transactions).length,
        used: usedTransactions.size
    });
});

// ====== ROOT ======
app.get('/', (req, res) => {
    res.json({
        name: 'FamPay Gateway',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            test: '/api/test',
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
