import { Request, Response } from "express";
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../dao/notification";
import { sendToUser, sendToUsers, broadcast } from "../services/firebase";
import { NotificationTypeInt } from "../interface";

/**
 * Get user's notifications (paginated)
 * GET /notification/
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await getUserNotifications(userId, page, limit);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

/**
 * Get unread notification count
 * GET /notification/unread/count
 */
export const getUnreadNotificationCount = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user.userId;
    const count = await getUnreadCount(userId);

    return res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch unread count",
    });
  }
};

/**
 * Mark a notification as read
 * PATCH /notification/:notificationId/read
 */
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "notificationId is required",
      });
    }

    const notification = await markAsRead(notificationId, userId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
};

/**
 * Mark all notifications as read
 * PATCH /notification/read/all
 */
export const markAllNotificationsAsRead = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user.userId;
    await markAllAsRead(userId);

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
};

/**
 * Send notification to a specific user (admin/system use)
 * POST /notification/send/user/:userId
 */
export const sendNotificationToUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { title, body, type, data } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({
        success: false,
        message: "userId, title, and body are required",
      });
    }

    const result = await sendToUser(userId, {
      title,
      body,
      type: type || NotificationTypeInt.BROADCAST,
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Notification sent",
      result,
    });
  } catch (error) {
    console.error("Error sending notification to user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send notification",
    });
  }
};

/**
 * Send notification to multiple users (admin/system use)
 * POST /notification/send/users
 */
export const sendNotificationToUsers = async (req: Request, res: Response) => {
  try {
    const { userIds, title, body, type, data } = req.body;

    if (!userIds || !Array.isArray(userIds) || !title || !body) {
      return res.status(400).json({
        success: false,
        message: "userIds (array), title, and body are required",
      });
    }

    const result = await sendToUsers(userIds, {
      title,
      body,
      type: type || NotificationTypeInt.BROADCAST,
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Notifications sent",
      result,
    });
  } catch (error) {
    console.error("Error sending notifications to users:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send notifications",
    });
  }
};

/**
 * Broadcast notification to all users (system admin only)
 * POST /notification/broadcast
 * Requires SYSTEM_ADMIN_KEY in header
 */
export const broadcastNotification = async (req: Request, res: Response) => {
  try {
    // Check for system admin key
    const adminKey = req.headers["x-system-admin-key"];
    if (adminKey !== process.env.SYSTEM_ADMIN_KEY) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. System admin key required.",
      });
    }

    const { title, body, data } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: "title and body are required",
      });
    }

    const result = await broadcast({
      title,
      body,
      type: NotificationTypeInt.BROADCAST,
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Broadcast sent",
      result,
    });
  } catch (error) {
    console.error("Error broadcasting notification:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to broadcast notification",
    });
  }
};
