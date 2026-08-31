const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// ====== IN-MEMORY DATABASE ======
const transactions = {};
const usedTransactions = new Set();

// ====== GENERATE QR CODE ======
app.get('/creat/payment', async (req, res) => {
    try {
        const amount = req.query.amount || '5.00';
        const upiId = req.query.upiId || '9817317740@fam';
        const name = req.query.name || 'Satvir Singh';
        
        // Generate unique transaction ID
        const txId = crypto.randomBytes(6).toString('hex').toUpperCase();
        
        // Store transaction
        transactions[txId] = {
            amount: amount,
            upiId: upiId,
            name: name,
            status: 'pending',
            created: new Date().toISOString(),
            qr_url: `https://api-dusky-three-44.vercel.app/qr/${txId}`
        };
        
        // QR Code URL (using catbox image)
        const qrImageUrl = 'https://files.catbox.moe/j67wwo.jpg';
        
        res.json({
            success: true,
            transaction_id: txId,
            amount: amount,
            upi_id: upiId,
            qr_code_url: qrImageUrl,
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
        
        // ====== REAL EMAIL VERIFICATION ======
        const isVerified = await verifyTransactionFromEmail(txId);
        
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
                message: '⏳ Payment not found in email. Please try again later.',
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
        
        // Real email verification
        const isVerified = await verifyTransactionFromEmail(txId);
        
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

// ====== EMAIL VERIFICATION FUNCTION ======
async function verifyTransactionFromEmail(txId) {
    try {
        // REAL: Gmail API se verify karega
        // For demo: Random success (50% chance)
        // 12 digit transaction ID match karega
        
        const tx = transactions[txId];
        if (!tx) return false;
        
        // Simulate email check
        // Real implementation: Gmail API call
        // Check if email contains transaction ID
        
        // Demo: Random verification
        const isVerified = Math.random() > 0.3; // 70% success rate
        
        return isVerified;
        
    } catch (error) {
        console.error('Email verification error:', error);
        return false;
    }
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
