import express from 'express';
import multer from 'multer';
import { createUser,  login, refreshToken } from '../controller/user';
import auth from '../authorization/auth';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
  });

router.post('/signup', createUser);
router.post('/login', login);
router.post("/refresh-token", refreshToken);

export default router;