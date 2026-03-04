import express from "express";
import {
  registerDevice,
  linkDevice,
  unlinkDevice,
  invalidateDeviceToken,
} from "../controller/device";
import auth from "../authorization/auth";

const router = express.Router();

// Register device (no auth required - can be called before login)
router.post("/register", registerDevice);

// Link device to authenticated user
router.patch("/link/user", auth, linkDevice);

// Unlink device from user (e.g., on logout)
router.patch("/unlink/user", auth, unlinkDevice);

// Invalidate device token (no auth - can be called by FCM callback)
router.patch("/invalidate/token/:deviceId", invalidateDeviceToken);

export default router;
