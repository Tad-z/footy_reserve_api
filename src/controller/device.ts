import { Request, Response } from "express";
import {
  createOrUpdateDevice,
  getDeviceById,
  invalidateToken,
  linkUserToDevice,
  unlinkUserFromDevice,
} from "../dao/device";
import { DevicePlatformInt } from "../interface";

/**
 * Register a device with FCM token
 * POST /device/register
 */
export const registerDevice = async (req: Request, res: Response) => {
  try {
    const { deviceId, fcmToken, platform, appVersion } = req.body;

    if (!deviceId || !fcmToken || !platform || !appVersion) {
      return res.status(400).json({
        success: false,
        message: "deviceId, fcmToken, platform, and appVersion are required",
      });
    }

    // Validate platform
    if (!Object.values(DevicePlatformInt).includes(platform)) {
      return res.status(400).json({
        success: false,
        message: "Invalid platform. Must be ios, android, or web",
      });
    }

    const device = await createOrUpdateDevice(
      deviceId,
      fcmToken,
      platform,
      appVersion
    );

    return res.status(200).json({
      success: true,
      message: "Device registered successfully",
      device,
    });
  } catch (error) {
    console.error("Error registering device:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to register device",
    });
  }
};

/**
 * Link a device to an authenticated user
 * PATCH /device/link/user
 */
export const linkDevice = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required",
      });
    }

    // Check if device exists
    const existingDevice = await getDeviceById(deviceId);
    if (!existingDevice) {
      return res.status(404).json({
        success: false,
        message: "Device not found. Please register the device first.",
      });
    }

    const device = await linkUserToDevice(deviceId, userId);

    return res.status(200).json({
      success: true,
      message: "Device linked to user successfully",
      device,
    });
  } catch (error) {
    console.error("Error linking device:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to link device",
    });
  }
};

/**
 * Unlink a device from authenticated user (e.g., on logout)
 * PATCH /device/unlink/user
 */
export const unlinkDevice = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required",
      });
    }

    const device = await unlinkUserFromDevice(deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Device unlinked from user successfully",
    });
  } catch (error) {
    console.error("Error unlinking device:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to unlink device",
    });
  }
};

/**
 * Invalidate a device token (called when FCM reports token as invalid)
 * PATCH /device/invalidate/token/:deviceId
 */
export const invalidateDeviceToken = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required",
      });
    }

    const device = await invalidateToken(deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Device token invalidated successfully",
    });
  } catch (error) {
    console.error("Error invalidating device token:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to invalidate device token",
    });
  }
};
