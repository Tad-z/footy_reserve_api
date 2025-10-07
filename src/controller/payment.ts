
import { BookingStatusInt, MatchInt, MatchStatusInt, PaymentStatusInt, payoutHistoryStatusInt } from "../interface";
import Booking from "../models/booking";
import { Request, Response } from "express";
import Payment from "../models/payment";
import Match from "../models/match";
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
});
import mongoose from "mongoose";
import User from "../models/user";

// ==========================================
// 1. PAYMENT INITIATION
// ==========================================

/**
 * Initiate payment for match spots
 * POST /api/payments/initiate
 */
export async function initiatePayment(req: Request, res: Response) {
  try {
    const { matchId, spotBooked } = req.body;
    const userId = req.user.userId; 
    const numberOfSpots = spotBooked.length;

    if (!matchId || !Array.isArray(spotBooked) || spotBooked.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Booking ID and spotBooked are required'
        });
    }

     await cleanupStaleReservations(matchId);

    // Validate booking exists and belongs to user
    const booking = await Booking.findOne({
      matchId,
      userId
    }).populate<{ matchId: MatchInt }>('matchId'); 

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or already processed'
      });
    }

    const alreadyBookedSpots = booking.spotBooked || [];

    // ensure no overlap
    const hasOverlap = spotBooked.some(spot => alreadyBookedSpots.includes(spot));
    if (hasOverlap) {
      return res.status(400).json({
        success: false,
        message: "Already booked this spot"
      })
    }

    const match = booking.matchId;
    const bookingId = booking._id
    
    // Check if enough spots available
    const availableSpots = match.spots - match.spotsBooked;
    if (numberOfSpots > availableSpots) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableSpots} spots available`
      });
    }

    const updatedMatch = await Match.findOneAndUpdate(
      {
        _id: matchId,
        // Atomic check: none of the requested spots are already booked
        bookedSpots: { $nin: spotBooked }
      },
      {
        $addToSet: { bookedSpots: { $each: spotBooked } }
      },
      { new: true }
    );

    if (!updatedMatch) {
      return res.status(400).json({
        success: false,
        message: 'Spots no longer available'
      });
    }

    const amount = numberOfSpots * match.pricePerSpot;
    const amountInPence = Math.round(amount * 100); // Stripe uses pence

    // Generate unique transaction reference
    const transactionRef = `TXN_${match._id}_${userId}_${Date.now()}`;

    // Create Payment record
    const payment = new Payment({
      bookingId,
      matchId: match._id,
      userId,
      amount,
      status: 'PENDING',
      transactionRef,
      spotBooked
    });

    await payment.save();

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPence,
      currency: 'gbp',
      metadata: {
        paymentId: payment._id.toString(),
        bookingId: bookingId.toString(),
        matchId: match._id.toString(),
        userId: userId,
        numberOfSpots: numberOfSpots.toString(),
        spotBooked: spotBooked.join(','),
        teamId: match.teamId
      },
      description: `Payment for ${numberOfSpots} spots in ${match.pitchName} match`,
      // Enable automatic payment methods
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Update payment with Stripe intent ID
    payment.stripePaymentIntentId = paymentIntent.id;
    await payment.save();

    return res.status(200).json({
      success: true,
      paymentId: payment._id,
      clientSecret: paymentIntent.client_secret,
      amount: amount,
      spotBooked: spotBooked
    });

  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment'
    });
  }
}

// When a user intends to pay then abandons the payment
export async function cancelPayment(req: Request, res: Response) {
  const { paymentId } = req.body;
  
  const payment = await Payment.findById(paymentId);
  
  if (payment.status === 'PENDING') {
    // Cancel on Stripe
    await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
    
    // Release spots
    await Match.findByIdAndUpdate(
      payment.matchId,
      { $pull: { bookedSpots: { $in: payment.spotBooked } } }
    );
    
    payment.status = PaymentStatusInt.CANCELED;
    await payment.save();
  }
  
  res.json({ success: true });
}

// 🧹 Cleanup Helper Function
async function cleanupStaleReservations(matchId: string) {
  try {
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000); // 15 minutes

    // Find stale PENDING payments for this match
    const stalePayments = await Payment.find({
      matchId: matchId,
      status: 'PENDING',
      createdAt: { $lt: staleThreshold }
    });

    if (stalePayments.length === 0) {
      return; // Nothing to clean
    }

    console.log(`Found ${stalePayments.length} stale payments for match ${matchId}`);

    // Collect all spots to release
    const spotsToRelease: number[] = [];

    for (const payment of stalePayments) {
      // Optional: Check Stripe status before canceling
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          payment.stripePaymentIntentId
        );

        // Only cancel if not succeeded or processing
        if (!['succeeded', 'processing'].includes(paymentIntent.status)) {
          
          // Cancel on Stripe
          if (paymentIntent.status === 'requires_payment_method' || 
              paymentIntent.status === 'requires_confirmation') {
            await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
          }

          // Mark payment as canceled
          payment.status = PaymentStatusInt.CANCELED;
          payment.failureReason = 'Abandoned - auto-canceled after 10 minutes';
          await payment.save();

          // Collect spots
          spotsToRelease.push(...payment.spotBooked);

          console.log(`Canceled stale payment ${payment._id}`);
        }
      } catch (stripeError) {
        console.error(`Error checking Stripe for payment ${payment._id}:`, stripeError);
        // Continue with next payment
      }
    }

    // Release all spots at once
    if (spotsToRelease.length > 0) {
      await Match.findByIdAndUpdate(
        matchId,
        { $pull: { bookedSpots: { $in: spotsToRelease } } }
      );
      
      console.log(`Released spots ${spotsToRelease} from match ${matchId}`);
    }

  } catch (error) {
    console.error('Error in cleanupStaleReservations:', error);
    // Don't throw - let the booking continue even if cleanup fails
  }
}

// ==========================================
// 2. STRIPE WEBHOOK HANDLER
// ==========================================

/**
 * Handle Stripe webhooks
 * POST /api/payments/stripe-webhook
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({
      success: false,
      message: `Webhook Error: ${err.message}`
    });
  }

  // Handle the event
  let response;
  switch (event.type) {
    case 'payment_intent.succeeded':
      response = await handleSuccessfulPayment(event.data.object);
      break;
    
    case 'payment_intent.payment_failed':
      response = await handleFailedPayment(event.data.object);
      break;

    case 'payment_intent.canceled': // 👈 NEW
      response = await handleCanceledPayment(event.data.object);
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return res.json({ received: true, ...response });
}

/**
 * Process successful payment
 */
export async function handleSuccessfulPayment(paymentIntent) {
  const session = await mongoose.startSession();
  session.startTransaction();

  let matchId;

  try {
    const { paymentId, bookingId, matchId: mId, spotBooked } = paymentIntent.metadata;
    matchId = mId; // keep reference for use after commit

    // ---- 1️⃣ Fetch payment and ensure it exists ----
    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) {
      return {
        success: false,
        message: `Payment record ${paymentId} not found`
      }
    }

    // ---- 2️⃣ Idempotency: skip already processed payments ----
    if (payment.status === PaymentStatusInt.SUCCESS) {
      console.log(`Payment ${paymentId} already processed. Skipping...`);
      await session.abortTransaction();
      return {
        success: true,
        message: `Payment ${paymentId} already processed`
      }
    }

    // ---- 3️⃣ Mark payment success ----
    payment.status = PaymentStatusInt.SUCCESS;
    payment.stripeChargeId = paymentIntent.latest_charge;
    await payment.save({ session });

    // ---- 4️⃣ Fetch match ----
    const match = await Match.findById(matchId).session(session);
    if (!match) {
      return {
        success: false,
        message: `Match ${matchId} not found`
      }
    }

    const numberOfSpots = spotBooked.split(",").length;
    if (match.spotsBooked + numberOfSpots > match.spots) {
      return {
        success: false,
        message: `Not enough spots available in match ${matchId}`
      }
    }

    // ---- 5️⃣ Update booking ----
    await Booking.findByIdAndUpdate(
      bookingId,
      {
        $inc: { amountPaid: payment.amount },
        $addToSet: { spotBooked: { $each: spotBooked.split(",").map(Number) } },
        status: BookingStatusInt.CONFIRMED,
      },
      { session }
    );

    // ---- 6️⃣ Update match spots ----
    const updatedMatch = await Match.findByIdAndUpdate(
      matchId,
      { $inc: { spotsBooked: numberOfSpots } },
      { session, new: true }
    );

    // ---- 7️⃣ If match is full, mark FULLY_BOOKED ----
    if (
      updatedMatch.spotsBooked === updatedMatch.spots &&
      updatedMatch.status !== MatchStatusInt.FULLY_BOOKED
    ) {
      updatedMatch.status = MatchStatusInt.FULLY_BOOKED;
      await updatedMatch.save({ session });
    }

    // ---- 8️⃣ Calculate total successful payments ----
    const successfulPayments = await Payment.find({
      matchId,
      status: PaymentStatusInt.SUCCESS,
    }).session(session);

    const totalCollected = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
    const expectedAmount = updatedMatch.spots * updatedMatch.pricePerSpot;

    // ---- 9️⃣ If all payments complete, mark PAID_UP ----
    if (
      totalCollected >= expectedAmount &&
      ![MatchStatusInt.PAID_UP, MatchStatusInt.COMPLETED].includes(updatedMatch.status)
    ) {
      // Safe upsert-like update (prevents race conditions)
      await Match.findOneAndUpdate(
        { _id: matchId, status: { $ne: MatchStatusInt.PAID_UP } },
        { $set: { status: MatchStatusInt.PAID_UP } },
        { session }
      );
    }

    await session.commitTransaction();
    console.log("Payment processed successfully:", paymentId);

  } catch (error) {
    await session.abortTransaction();
    console.error("Error processing successful payment:", error);
    throw error;
  } finally {
    session.endSession();
  }

  // ---- 🔟 After commit: check for auto payout ----
  try {
    const match = await Match.findById(matchId);
    if (match.autoPayout && match.status === MatchStatusInt.PAID_UP && !match.payoutInitiated) {
      const payout = await initiateTeamPayout(matchId);
      if (payout.success) {
        return {
          success: true,
          message: 'Payment and auto-payout successful',
          data: payout.data
        };
      }
      else {
        return {
          success: false,
          message: `Payment succeeded but auto-payout failed: ${payout.message}`
        };
      }

    }
    return {
      success: true,
      message: 'Payment succeeded'
    };
  } catch (payoutErr) {
    console.error('Auto payout error after payment:', payoutErr);
    return {
      success: true,
      message: 'Payment succeeded but auto-payout failed, please retry later'
    };
  }
}


/**
 * Handle failed payment
 */
async function handleFailedPayment(paymentIntent) {
  try {
    const { paymentId, spotBooked, matchId } = paymentIntent.metadata;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      console.warn(`Payment record ${paymentId} not found`);
      return {
        success: false,
        message: `Payment record ${paymentId} not found`
      }
    }

    // ✅ Idempotency: if already marked SUCCESS, ignore
    if (payment.status === 'SUCCESS') {
      console.log(`Payment ${paymentId} already succeeded. Ignoring failed event.`);
      return {
        success: true,
        message: `Payment ${paymentId} already succeeded`
      }
    }

    // ✅ If already FAILED, skip re-processing
    if (payment.status === 'FAILED') {
      console.log(`Payment ${paymentId} already marked as failed. Skipping.`);
      return {
        success: false,
        message: `Payment ${paymentId} already marked as failed`
      }
    }

    // if failed remove the spotsBooked from match bookedSpots array
    const spotsArray = spotBooked.split(",").map(Number);

    await Match.findByIdAndUpdate(
      matchId,
      {
        $pull: { bookedSpots: { $in: spotsArray } }
      }
    );

    console.log(`Removed spots ${spotsArray} from match ${matchId} due to payment failure`);

    // Mark as FAILED
    payment.status = PaymentStatusInt.FAILED;
    payment.failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
    await payment.save();

    console.log('Payment failed recorded:', paymentId);


    // (Optional) trigger a notification to the user only the first time
    // await notifyUser(payment.userId, "Your payment failed, please retry...");

    return {
      success: false,
      message: paymentIntent.last_payment_error?.message || 'Payment failed',
    };

  } catch (error) {
    console.error('Error handling failed payment:', error);
  }
}

async function handleCanceledPayment(paymentIntent) {
  try {
    const { paymentId, spotBooked, matchId } = paymentIntent.metadata;

    const payment = await Payment.findById(paymentId);
    
    if (!payment || payment.status === 'SUCCESS') {
      return { success: true, message: 'Already processed' };
    }

    // Release the reserved spots
    const spotsArray = spotBooked.split(",").map(Number);
    
    await Match.findByIdAndUpdate(
      matchId,
      { $pull: { bookedSpots: { $in: spotsArray } } }
    );

    payment.status = PaymentStatusInt.CANCELED;
    await payment.save();

    console.log(`Payment ${paymentId} canceled, spots ${spotsArray} released`);

    return {
      success: true,
      message: 'Payment canceled and spots released'
    };

  } catch (error) {
    console.error('Error handling canceled payment:', error);
    throw error;
  }
}


// ==========================================
// 3. TEAM PAYOUT SYSTEM
// ==========================================

export async function adminPayout(req: Request, res: Response) {
  const matchId = req.params.matchId;
  // make sure it is an admin
  const adminId = req.user.userId;
  const match = await Match.findOne({ _id: matchId, adminId: adminId });
  if (!match) {
    return res.status(404).json({
      success: false,
      message: 'Match not found or unauthorized'
    });
  }
  try{
    const payout = await initiateTeamPayout(matchId);
    if (payout.success) {
      return res.status(200).json(payout);
    }
    else {
      return res.status(400).json(payout);
    }
  } catch (error) {
    console.error('Admin payout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate payout'
    });
  }
}

/**
 * Transfer funds to team account when match is full
 */
export async function initiateTeamPayout(matchId: string) {
  let match = await Match.findById(matchId);
    match.accountDetails.stripeAccountId = "acct_1SFedPCeF5hZRVMG" // temp for testing
  if (!match) {
    return {
      success: false,
      message: 'Match not found'
    };
  }

  // ---- 1️⃣ Basic validation ----
  if (!match.accountDetails?.stripeAccountId) {
    return {
      success: false,
      message: 'Team payout account not set up'
    };
  }

  // ---- 2️⃣ Prevent duplicate payouts ----
  if (match.payoutRef || match.payoutInitiated) {
    return {
      success: false,
      message: 'Payout already processed or in progress'
    };
  }

  // Mark payout as in-progress (atomic update)
  const locked = await Match.findOneAndUpdate(
    { _id: matchId, payoutInitiated: { $ne: true } },
    { 
        $set: { payoutInitiated: true },
        $push: { payoutHistory: { status: payoutHistoryStatusInt.INITIATED, date: new Date() } }
    },
    
    { new: true }
  );
  if (!locked) {
    return {
      success: false,
      message: 'Payout already in progress'
    };
  }

// ---- 1️⃣ Compute total collected ----
const payments = await Payment.find({ matchId, status: "SUCCESS" });
const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
const expectedTotal = match.spots * match.pricing.finalPricePerSpot;

const epsilon = 0.01;
if (Math.abs(totalCollected - expectedTotal) > epsilon) {
  await Match.findByIdAndUpdate(matchId, {
    $push: {
      payoutHistory: {
        status: payoutHistoryStatusInt.DISCREPANCY,
        message: `Expected £${expectedTotal}, collected £${totalCollected}`,
        date: new Date(),
      },
    },
    $set: { payoutInitiated: false },
  });
  return {
    success: false,
    message: `Payout discrepancy: expected £${expectedTotal}, collected £${totalCollected}`,
  };
}

// ---- 2️⃣ Compute fees (from match) ----
const { platformFeePerSpot, basePricePerSpot } = match.pricing;
const platformFee = platformFeePerSpot * match.spots;
const payoutAmount = basePricePerSpot * match.spots; // what admin expects net
const payoutAmountInPence = Math.round(payoutAmount * 100);

// optional sanity log
console.log({
  totalCollected,
  platformFee,
  payoutAmount,
  expectedTotal,
});

// ---- 3️⃣ Proceed with payout ----
try {
  const payout = await stripe.transfers.create(
    {
      amount: payoutAmountInPence,
      currency: "gbp",
      destination: match.accountDetails.stripeAccountId,
      metadata: {
        matchId,
        teamId: match.teamId,
        totalCollected,
        platformFee,
      },
    },
    {
      idempotencyKey: `payout_${matchId}`,
    }
  );

    // ---- 6️⃣ Mark match as completed ----
    await Match.findByIdAndUpdate(matchId, {
      $set: {
        status: MatchStatusInt.COMPLETED,
        payoutRef: payout.id,
        payoutAmount,
        platformFee,
        payoutDate: new Date(),
        payoutInitiated: false,
        },
        $push: { payoutHistory: { status: payoutHistoryStatusInt.SUCCESS, message: `Payout of £${payoutAmount} successful`, date: new Date(), payoutRef: payout.id } },
    });

    console.log(`✅ Payout successful for match ${matchId}: £${payoutAmount}`);
    return {
      success: true,
      message: `Payout of £${payoutAmount} successful`,
      data: { payoutId: payout.id, amount: payoutAmount }
    };
  } catch (err) {
    console.error("❌ Stripe payout failed:", err);

    // Mark payout as failed for retry later
    await Match.findByIdAndUpdate(matchId, {
        $set: { payoutInitiated: false },
        $push: {
        payoutHistory: {
            status: payoutHistoryStatusInt.FAILED,
            message: err.message,
            date: new Date(),
        },
        },
    });

    return {
      success: false,
      message: 'Stripe payout failed, please retry later'
    };
  }
}


// ==========================================
// 4. TEAM ACCOUNT SETUP (STRIPE CONNECT)
// ==========================================

/**
 * Create Stripe Connect account for teams
 * POST /api/teams/setup-payout-account
 */
// Ask whether this should be done at admin level or team level
export async function setupTeamPayoutAccount(req: Request, res: Response) {
  try {
    const { matchId } = req.body;
    const adminId = req.user.userId;
    // i have to get match by id to ensure admin owns the team
    const match = await Match.findOne({ _id: matchId, adminId: adminId });
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found or unauthorized'
      });
    }

    // Create Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'GB',
      email: req.user.email,
      capabilities: {
        transfers: { requested: true }
      },
      metadata: {
        matchId: matchId,
        adminId: adminId
      }
    });

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL}/team/setup-payout?refresh=true`,
      return_url: `${process.env.FRONTEND_URL}/team/setup-payout?success=true`,
      type: 'account_onboarding',
    });

    // Store Stripe account ID in match accountDetails
    // update match to include stripeAccountId
    // then store the accountDetails on the admin user 
    match.accountDetails.stripeAccountId = account.id;
    await match.save();

    const admin = await User.findOne({ _id: adminId })
    const adminAccountDetails = admin.accountDetails || [];
    const matchAccountDetails = match.accountDetails

    // check if accountDetails with same bankName and accountNumber exists
    const existingIndex = adminAccountDetails.findIndex(ad =>
      ad.bankName === matchAccountDetails.bankName &&
      ad.accountNumber === matchAccountDetails.accountNumber &&
      ad.sortCode === matchAccountDetails.sortCode
    );
    if (existingIndex !== -1) {
      // update existing
      adminAccountDetails[existingIndex].stripeAccountId = account.id;
      adminAccountDetails[existingIndex].connectedAt = new Date();
    } else {
      // add new
      adminAccountDetails.push({
        accountName: matchAccountDetails.accountName,
        accountNumber: matchAccountDetails.accountNumber,
        bankName: matchAccountDetails.bankName,
        sortCode: matchAccountDetails.sortCode,
        stripeAccountId: account.id,
        connectedAt: new Date()
      });
    }
    admin.accountDetails = adminAccountDetails;
    await admin.save();
    // Return onboarding URL to frontend
    res.json({
      success: true,
      stripeAccountId: account.id,
      onboardingUrl: accountLink.url
    });

  } catch (error) {
    console.error('Account setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup payout account'
    });
  }
}

// ==========================================
// 5. REFUND SYSTEM
// ==========================================

/**
 * Handle refunds when match is cancelled or doesn't fill up
 */
// async function processRefunds(matchId, reason = 'MATCH_CANCELLED') {
//   try {
//     // Get all successful payments for this match
//     const payments = await Payment.find({
//       matchId: matchId,
//       status: 'SUCCESS'
//     }).populate('userId');

//     const refundPromises = payments.map(async (payment) => {
//       try {
//         // Create Stripe refund
//         const refund = await stripe.refunds.create({
//           payment_intent: payment.stripePaymentIntentId,
//           reason: 'requested_by_customer',
//           metadata: {
//             originalPaymentId: payment._id,
//             matchId: matchId,
//             refundReason: reason
//           }
//         });

//         // Update payment record
//         await Payment.findByIdAndUpdate(payment._id, {
//           status: 'REFUNDED',
//           refundRef: refund.id,
//           refundDate: new Date(),
//           refundReason: reason
//         });

//         // Update booking
//         await Booking.findByIdAndUpdate(payment.bookingId, {
//           status: 'REFUNDED',
//           $inc: { amountPaid: -payment.amount }
//         });

//         console.log(`Refunded £${payment.amount} to user ${payment.userId._id}`);
        
//         // Send refund notification
//         await sendRefundNotification(payment.userId, payment.amount, reason);

//       } catch (refundError) {
//         console.error(`Refund failed for payment ${payment._id}:`, refundError);
//         // Log for manual review
//       }
//     });

//     await Promise.allSettled(refundPromises);

//     // Update match status
//     await Match.findByIdAndUpdate(matchId, {
//       status: 'CANCELLED',
//       cancellationReason: reason,
//       cancellationDate: new Date()
//     });

//   } catch (error) {
//     console.error('Bulk refund process failed:', error);
//     throw error;
//   }
// }

// ==========================================
// 6. PAYMENT STATUS ENDPOINTS
// ==========================================

/**
 * Get payment status
 * GET /api/payments/:paymentId/status
 */
async function getPaymentStatus(req: Request, res: Response) {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findById(paymentId)
      .populate('userId', 'firstName lastName email')
      .populate('matchId', 'pitchName matchDate pricePerSpot')
      .populate('bookingId');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment: {
        id: payment._id,
        status: payment.status,
        amount: payment.amount,
        transactionRef: payment.transactionRef,
        createdAt: payment.createdAt,
        match: payment.matchId,
        spotBooked: payment.spotBooked
      }
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment status'
    });
  }
}

/**
 * Get user's payment history
 * GET /api/payments/history
 */
// async function getPaymentHistory(req, res) {
//   try {
//     const userId = req.user.id;
//     const { page = 1, limit = 10 } = req.query;

//     const payments = await Payment.find({ userId })
//       .populate('matchId', 'pitchName matchDate pricePerSpot teamId')
//       .sort({ createdAt: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit);

//     const total = await Payment.countDocuments({ userId });

//     res.json({
//       success: true,
//       payments,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit)
//       }
//     });

//   } catch (error) {
//     console.error('Payment history error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to get payment history'
//     });
//   }
// }

// ==========================================
// 7. ADMIN DASHBOARD FUNCTIONS
// ==========================================

/**
 * Get match financial summary for team admins
 * GET /api/admin/matches/:matchId/finances
 */
async function getMatchFinances(req: Request, res: Response) {
  try {
    const { matchId } = req.params;
    const adminId = req.user.userId;

    // Verify admin owns this match
    const match = await Match.findOne({
      _id: matchId,
      adminId: adminId
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found or unauthorized'
      });
    }

    // Get all payments for this match
    const payments = await Payment.find({ matchId })
      .populate('userId', 'firstName lastName email')
      .populate('bookingId');

    const totalCollected = payments
      .filter(p => p.status === 'SUCCESS')
      .reduce((sum, p) => sum + p.amount, 0);

    const platformFee = totalCollected * 0.05; // 5% platform fee
    const expectedPayout = totalCollected - platformFee;

    res.json({
      success: true,
      finances: {
        totalSpots: match.spots,
        bookedSpots: match.spotsBooked,
        pricePerSpot: match.pricePerSpot,
        totalCollected,
        platformFee,
        expectedPayout,
        payoutStatus: match.status,
        payoutRef: match.payoutRef,
        payments: payments.map(p => ({
          id: p._id,
          user: p.userId,
          amount: p.amount,
          status: p.status,
          spotBooked: p.spotBooked,
          createdAt: p.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Match finances error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get match finances'
    });
  }
}

// ==========================================
// 8. MANUAL OPERATIONS
// ==========================================

/**
 * Manual refund (admin only)
 * POST /api/admin/payments/:paymentId/refund
 */
// async function manualRefund(req, res) {
//   try {
//     const { paymentId } = req.params;
//     const { reason } = req.body;

//     const payment = await Payment.findOne({
//       _id: paymentId,
//       status: 'SUCCESS'
//     });

//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: 'Payment not found or already processed'
//       });
//     }

//     // Create Stripe refund
//     const refund = await stripe.refunds.create({
//       payment_intent: payment.stripePaymentIntentId,
//       reason: 'requested_by_customer',
//       metadata: {
//         adminRefund: true,
//         reason: reason
//       }
//     });

//     // Update payment record
//     await Payment.findByIdAndUpdate(paymentId, {
//       status: 'REFUNDED',
//       refundRef: refund.id,
//       refundDate: new Date(),
//       refundReason: reason
//     });

//     res.json({
//       success: true,
//       message: 'Refund processed successfully',
//       refundId: refund.id
//     });

//   } catch (error) {
//     console.error('Manual refund error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to process refund'
//     });
//   }
// }



// ==========================================
// 9. UTILITY FUNCTIONS
// ==========================================

function generateTransactionRef() {
  return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// async function sendPayoutNotification(adminId, amount, pitchName) {

//   console.log(`Payout notification: £${amount} for ${pitchName} match`);
// }

// async function sendRefundNotification(user, amount, reason) {

//   console.log(`Refund notification: £${amount} refunded to ${user.email}`);
// }

// ==========================================
// 10. ROUTE DEFINITIONS
// ==========================================




