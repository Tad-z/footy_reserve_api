import mongoose, { Model, Schema } from "mongoose";
import { TempUserInt } from "../interface";

const TempUserSchema = new Schema<TempUserInt>(
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
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 900, // 15 minutes TTL
    },
  },
  { timestamps: false }
);

const TempUser: Model<TempUserInt> = mongoose.model<TempUserInt>(
  "TempUser",
  TempUserSchema
);
export default TempUser;
