import express from 'express';
import { joinMatch, getUserMatches, getAllUserUpcomingMatches } from '../controller/booking';

import auth from '../authorization/auth';

const router = express.Router();
router.post('/join', auth, joinMatch);
router.get('/joinedMatches', auth, getUserMatches);
router.get('/allMyMatches', auth, getAllUserUpcomingMatches);

export default router;