import express from 'express';
import multer from 'multer';
import {
  checkPassword,
  createUser,
  login,
  refreshToken,
  requestPasswordReset,
  resetPassword,
  updateUser,
  updateUserPassword,
  verifySignupOtp,
  resendOtpCode,
  verifyPasswordResetOtp,
} from '../controller/user';
import auth from '../authorization/auth';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
  });

router.post('/signup', upload.single('file'), createUser);
router.post('/verify/signup', verifySignupOtp);
router.post('/resend/otp', resendOtpCode);
router.post('/login', login);
router.post("/refresh-token", refreshToken);
router.patch('/update/', auth, upload.single('file'), updateUser);
router.post('/password/check', auth, checkPassword);
router.patch('/update/password', auth, updateUserPassword);
router.post('/request/password/reset', requestPasswordReset);
router.post('/verify/password/reset', verifyPasswordResetOtp);
router.patch('/reset/password', resetPassword);

export default router;