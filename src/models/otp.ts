import mongoose, { Model, Schema } from "mongoose";
import { OtpInt, OtpTypeInt } from "../interface";

const OtpSchema = new Schema<OtpInt>(
  {
    email: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: OtpTypeInt,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    lastSentAt: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 300, // 5 minutes TTL
    },
  },
  { timestamps: false }
);

OtpSchema.index({ email: 1, type: 1 });

const Otp: Model<OtpInt> = mongoose.model<OtpInt>("Otp", OtpSchema);
export default Otp;
