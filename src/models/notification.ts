import mongoose, { Model, Schema } from "mongoose";
import { NotificationInt, NotificationTypeInt } from "../interface";

const NotificationDataSchema = new Schema(
  {
    matchId: {
      type: Schema.Types.ObjectId,
      ref: "Match",
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    amount: {
      type: Number,
    },
    pitchName: {
      type: String,
    },
    spots: {
      type: Number,
    },
  },
  { _id: false }
);

const NotificationSchema = new Schema<NotificationInt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: NotificationTypeInt,
      required: true,
    },
    data: {
      type: NotificationDataSchema,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

const Notification: Model<NotificationInt> = mongoose.model<NotificationInt>(
  "Notification",
  NotificationSchema
);
export default Notification;
