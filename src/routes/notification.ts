import express from "express";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  sendNotificationToUser,
  sendNotificationToUsers,
  broadcastNotification,
} from "../controller/notification";
import auth from "../authorization/auth";

const router = express.Router();

// User notification routes (require auth)
router.get("/", auth, getNotifications);
router.get("/unread/count", auth, getUnreadNotificationCount);
router.patch("/:notificationId/read", auth, markNotificationAsRead);
router.patch("/read/all", auth, markAllNotificationsAsRead);

// Admin/System notification routes
router.post("/send/user/:userId", auth, sendNotificationToUser);
router.post("/send/users", auth, sendNotificationToUsers);
router.post("/broadcast", broadcastNotification); // Uses x-system-admin-key header

export default router;
