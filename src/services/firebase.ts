import admin from "firebase-admin";
import dotenv from "dotenv";
import { NotificationPayloadInt } from "../interface";
import {
  getDevicesByUserId,
  getActiveDevicesByUserIds,
  getAllActiveDevices,
  invalidateTokenByFcmToken,
} from "../dao/device";
import {
  createNotification,
  createManyNotifications,
} from "../dao/notification";

dotenv.config();

// Initialize Firebase Admin SDK
// You need to set FIREBASE_SERVICE_ACCOUNT_KEY in your .env as a JSON string
// or use GOOGLE_APPLICATION_CREDENTIALS to point to the service account file
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
  });
}

/**
 * Send push notification to a single device
 */
export const sendToDevice = async (
  fcmToken: string,
  payload: NotificationPayloadInt
) => {
  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        type: payload.type,
        ...(payload.data
          ? Object.fromEntries(
              Object.entries(payload.data).map(([k, v]) => [k, String(v)])
            )
          : {}),
      },
    };

    const response = await admin.messaging().send(message);
    console.log("Successfully sent message:", response);
    return { success: true, response };
  } catch (error: any) {
    console.error("Error sending message:", error);

    // Handle invalid token
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      await invalidateTokenByFcmToken(fcmToken);
    }

    return { success: false, error };
  }
};

/**
 * Send push notification to a user (all their active devices)
 * Also saves notification to database for in-app notification feed
 */
export const sendToUser = async (
  userId: string,
  payload: NotificationPayloadInt,
  saveToDb: boolean = true
) => {
  try {
    // Save to database for in-app notifications
    if (saveToDb) {
      await createNotification(
        userId,
        payload.title,
        payload.body,
        payload.type,
        payload.data
      );
    }

    // Get all active devices for this user
    const devices = await getDevicesByUserId(userId);

    if (!devices || devices.length === 0) {
      console.log(`No active devices found for user ${userId}`);
      return { success: true, message: "No devices to send to" };
    }

    // Send to all devices
    const results = await Promise.allSettled(
      devices.map((device) => sendToDevice(device.fcmToken, payload))
    );

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    console.log(
      `Sent notification to ${successCount}/${devices.length} devices for user ${userId}`
    );

    return { success: true, sent: successCount, total: devices.length };
  } catch (error) {
    console.error("Error sending to user:", error);
    return { success: false, error };
  }
};

/**
 * Send push notification to multiple users
 * Also saves notifications to database
 */
export const sendToUsers = async (
  userIds: string[],
  payload: NotificationPayloadInt,
  saveToDb: boolean = true
) => {
  try {
    if (!userIds || userIds.length === 0) {
      return { success: true, message: "No users to send to" };
    }

    // Save to database for all users
    if (saveToDb) {
      const notifications = userIds.map((userId) => ({
        userId,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        data: payload.data,
      }));
      await createManyNotifications(notifications);
    }

    // Get all active devices for these users
    const devices = await getActiveDevicesByUserIds(userIds);

    if (!devices || devices.length === 0) {
      console.log("No active devices found for users");
      return { success: true, message: "No devices to send to" };
    }

    // Send to all devices (batch if > 500)
    const tokens = devices.map((d) => d.fcmToken);
    const batches = [];

    for (let i = 0; i < tokens.length; i += 500) {
      batches.push(tokens.slice(i, i + 500));
    }

    let successCount = 0;
    let failureCount = 0;

    for (const batch of batches) {
      const message: admin.messaging.MulticastMessage = {
        tokens: batch,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          type: payload.type,
          ...(payload.data
            ? Object.fromEntries(
                Object.entries(payload.data).map(([k, v]) => [k, String(v)])
              )
            : {}),
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      successCount += response.successCount;
      failureCount += response.failureCount;

      // Handle failed tokens
      response.responses.forEach(async (resp, idx) => {
        if (
          !resp.success &&
          (resp.error?.code === "messaging/invalid-registration-token" ||
            resp.error?.code === "messaging/registration-token-not-registered")
        ) {
          await invalidateTokenByFcmToken(batch[idx]);
        }
      });
    }

    console.log(
      `Sent notification to ${successCount} devices, ${failureCount} failed`
    );

    return { success: true, sent: successCount, failed: failureCount };
  } catch (error) {
    console.error("Error sending to users:", error);
    return { success: false, error };
  }
};

/**
 * Broadcast notification to all users with active devices
 * Use sparingly - this is for system-wide announcements
 */
export const broadcast = async (
  payload: NotificationPayloadInt,
  saveToDb: boolean = true
) => {
  try {
    // Get all active devices
    const devices = await getAllActiveDevices();

    if (!devices || devices.length === 0) {
      console.log("No active devices to broadcast to");
      return { success: true, message: "No devices to broadcast to" };
    }

    // Get unique user IDs for saving to DB
    if (saveToDb) {
      const uniqueUserIds = [
        ...new Set(
          devices
            .filter((d) => d.userId)
            .map((d) => d.userId!.toString())
        ),
      ];

      if (uniqueUserIds.length > 0) {
        const notifications = uniqueUserIds.map((userId) => ({
          userId,
          title: payload.title,
          body: payload.body,
          type: payload.type,
          data: payload.data,
        }));
        await createManyNotifications(notifications);
      }
    }

    // Send to all devices in batches
    const tokens = devices.map((d) => d.fcmToken);
    const batches = [];

    for (let i = 0; i < tokens.length; i += 500) {
      batches.push(tokens.slice(i, i + 500));
    }

    let successCount = 0;
    let failureCount = 0;

    for (const batch of batches) {
      const message: admin.messaging.MulticastMessage = {
        tokens: batch,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          type: payload.type,
          ...(payload.data
            ? Object.fromEntries(
                Object.entries(payload.data).map(([k, v]) => [k, String(v)])
              )
            : {}),
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      successCount += response.successCount;
      failureCount += response.failureCount;

      // Handle failed tokens
      response.responses.forEach(async (resp, idx) => {
        if (
          !resp.success &&
          (resp.error?.code === "messaging/invalid-registration-token" ||
            resp.error?.code === "messaging/registration-token-not-registered")
        ) {
          await invalidateTokenByFcmToken(batch[idx]);
        }
      });
    }

    console.log(
      `Broadcast sent to ${successCount} devices, ${failureCount} failed`
    );

    return { success: true, sent: successCount, failed: failureCount };
  } catch (error) {
    console.error("Error broadcasting:", error);
    return { success: false, error };
  }
};

export default {
  sendToDevice,
  sendToUser,
  sendToUsers,
  broadcast,
};
