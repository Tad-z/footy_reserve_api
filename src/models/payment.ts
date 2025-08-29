import mongoose, { Model, Schema } from "mongoose";
import { PaymentInt, PaymentStatusInt } from "../interface";

const PaymentSchema = new Schema<PaymentInt>({
  bookingId: {
    type: Schema.Types.ObjectId,
    ref: "Booking",
    required: true,
  },
  matchId: {
    type: Schema.Types.ObjectId,
    ref: "Match",
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: PaymentStatusInt,
    default: PaymentStatusInt.PENDING,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  transactionRef: {
    type: String,
    required: true,
  }
},
 { timestamps: true }
);

PaymentSchema.index({ matchId: 1, userId: 1, bookingId: 1 });

const Payment: Model<PaymentInt> = mongoose.model<PaymentInt>(
  "Payment",
  PaymentSchema
);
export default Payment;
