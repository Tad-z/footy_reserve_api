import mongoose, { Model, Schema } from 'mongoose';
import { AccountDetailsInt, UserInt } from "../interface";

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
    stripeAccountId: {
      type: String,
    },
    connectedAt: {
      type: Date
    }
  },
  { _id: false }
);

const UserSchema = new Schema<UserInt>(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
    refreshToken: {
      type: String,
    },
    deviceToken: {
      type: [String],
    },
    accountDetails: [AccountDetailsSchema]
  },
  { timestamps: true }
);

const User: Model<UserInt> = mongoose.model<UserInt>('User', UserSchema);
export default User
