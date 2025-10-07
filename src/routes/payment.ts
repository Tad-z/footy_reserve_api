import express from 'express';
import { initiatePayment, handleStripeWebhook, setupTeamPayoutAccount, adminPayout } from '../controller/payment';
import auth from '../authorization/auth';
 

const router = express.Router();

// Payment routes
router.post('/initiate', auth, initiatePayment);
router.post('/webhook', handleStripeWebhook);
// router.get('/:paymentId/status', authenticateUser, getPaymentStatus);
// router.get('/history', authenticateUser, getPaymentHistory);

// // Admin routes
// router.get('/admin/matches/:matchId/finances', authenticateAdmin, getMatchFinances);
// router.post('/admin/payments/:paymentId/refund', authenticateAdmin, manualRefund);
router.post('/:matchId/payout', auth, adminPayout);

// // Team setup routes
router.post('/setup-payout-account', auth, setupTeamPayoutAccount);

export default router;

