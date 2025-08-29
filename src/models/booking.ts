import mongoose, { Model, Schema } from "mongoose";
import {  BookingInt, BookingStatusInt } from "../interface";

const BookingSchema = new Schema<BookingInt>(
  {
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
      enum: BookingStatusInt,
      default: BookingStatusInt.PENDING,
      required: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    spotBooked: [Number],
  },
   { timestamps: true }
);

BookingSchema.index({ matchId: 1, userId: 1 });

const Booking: Model<BookingInt> = mongoose.model<BookingInt>("Booking", BookingSchema);
export default Booking;