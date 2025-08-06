import mongoose, { Model, Schema } from 'mongoose';
import { UserInt } from "../interface";

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
  },
  { timestamps: true }
);

const User: Model<UserInt> = mongoose.model<UserInt>('User', UserSchema);
export default User
