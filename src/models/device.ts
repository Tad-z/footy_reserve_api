import mongoose, { Model, Schema } from "mongoose";
import { DeviceInt, DevicePlatformInt, TokenStatusInt } from "../interface";

const DeviceSchema = new Schema<DeviceInt>(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
    },
    fcmToken: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      enum: DevicePlatformInt,
      required: true,
    },
    appVersion: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    tokenStatus: {
      type: String,
      enum: TokenStatusInt,
      default: TokenStatusInt.ACTIVE,
    },
  },
  { timestamps: true }
);

DeviceSchema.index({ userId: 1 });
DeviceSchema.index({ fcmToken: 1 });
DeviceSchema.index({ tokenStatus: 1 });

const Device: Model<DeviceInt> = mongoose.model<DeviceInt>("Device", DeviceSchema);
export default Device;
