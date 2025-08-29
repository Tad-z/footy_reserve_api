import mongoose, { Model, Schema } from "mongoose";
import { AccountDetailsInt, MatchInt, MatchStatusInt } from "../interface";

const AccountDetailsSchema = new Schema<AccountDetailsInt>(
  {
    accountName: {
      type: String,
      required: true,
    },
    accountNumber: {
      type: String,
      required: true,
    },
    bankName: {
      type: String,
      required: true,
    },
    sortCode: {
      type: String,
    },
  },
  { _id: false }
);

const MatchSchema = new Schema<MatchInt>(
  {
    teamId: {
      type: String,
      required: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pitchName: {
      type: String,
      required: true,
    },
    matchDate: {
      type: Date,
      required: true,
    },
    matchTime: {
      type: String,
      required: true,
    },
    spots: {
      type: Number,
      required: true,
      min: 1,
    },
    spotsBooked: {
      type: Number,
      default: 0,
    },
    pricePerSpot: {
      type: Number,
      required: true,
      min: 0,
    },
    password: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: MatchStatusInt,
      default: MatchStatusInt.ACTIVE,
    },
    accountDetails: AccountDetailsSchema,
  },
  { timestamps: true }
);

MatchSchema.index({ matchDate: 1, matchTime: 1 });
MatchSchema.index({ adminId: 1 });

const Match: Model<MatchInt> = mongoose.model<MatchInt>("Match", MatchSchema);
export default Match;
