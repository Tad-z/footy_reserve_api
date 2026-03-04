import { NotificationDataInt, NotificationTypeInt } from "../interface";
import Notification from "../models/notification";

export const createNotification = async (
  userId: string,
  title: string,
  body: string,
  type: NotificationTypeInt,
  data?: NotificationDataInt
) => {
  const notification = new Notification({
    userId,
    title,
    body,
    type,
    data: data || {},
  });
  return await notification.save();
};

export const createManyNotifications = async (
  notifications: {
    userId: string;
    title: string;
    body: string;
    type: NotificationTypeInt;
    data?: NotificationDataInt;
  }[]
) => {
  return await Notification.insertMany(notifications);
};

export const getUserNotifications = async (
  userId: string,
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit;
  const notifications = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Notification.countDocuments({ userId });

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getUnreadCount = async (userId: string) => {
  return await Notification.countDocuments({ userId, isRead: false });
};

export const markAsRead = async (notificationId: string, userId: string) => {
  return await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true },
    { new: true }
  );
};

export const markAllAsRead = async (userId: string) => {
  return await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );
};

export const deleteNotification = async (
  notificationId: string,
  userId: string
) => {
  return await Notification.findOneAndDelete({ _id: notificationId, userId });
};
