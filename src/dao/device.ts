import { TokenStatusInt } from "../interface";
import Device from "../models/device";

export const getDeviceById = async (deviceId: string) => {
  return await Device.findOne({ deviceId });
};

export const getDevicesByUserId = async (userId: string) => {
  return await Device.find({
    userId,
    tokenStatus: TokenStatusInt.ACTIVE
  });
};

export const getActiveDevicesByUserIds = async (userIds: string[]) => {
  return await Device.find({
    userId: { $in: userIds },
    tokenStatus: TokenStatusInt.ACTIVE,
  });
};

export const getAllActiveDevices = async () => {
  return await Device.find({ tokenStatus: TokenStatusInt.ACTIVE });
};

export const updateDeviceToken = async (
  deviceId: string,
  fcmToken: string
) => {
  return await Device.findOneAndUpdate(
    { deviceId },
    { fcmToken, lastSeenAt: new Date(), tokenStatus: TokenStatusInt.ACTIVE },
    { new: true }
  );
};

export const invalidateToken = async (deviceId: string) => {
  return await Device.findOneAndUpdate(
    { deviceId },
    { tokenStatus: TokenStatusInt.INVALID },
    { new: true }
  );
};

export const invalidateTokenByFcmToken = async (fcmToken: string) => {
  return await Device.findOneAndUpdate(
    { fcmToken },
    { tokenStatus: TokenStatusInt.INVALID },
    { new: true }
  );
};

export const linkUserToDevice = async (deviceId: string, userId: string) => {
  return await Device.findOneAndUpdate(
    { deviceId },
    { userId, lastSeenAt: new Date() },
    { new: true }
  );
};

export const unlinkUserFromDevice = async (deviceId: string) => {
  return await Device.findOneAndUpdate(
    { deviceId },
    { userId: null },
    { new: true }
  );
};

export const createOrUpdateDevice = async (
  deviceId: string,
  fcmToken: string,
  platform: string,
  appVersion: string,
  userId?: string | null
) => {
  return await Device.findOneAndUpdate(
    { deviceId },
    {
      deviceId,
      fcmToken,
      platform,
      appVersion,
      userId: userId || null,
      lastSeenAt: new Date(),
      tokenStatus: TokenStatusInt.ACTIVE,
    },
    { upsert: true, new: true }
  );
};
