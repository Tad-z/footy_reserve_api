import express from 'express';
import { joinMatch, getUserMatches, getAllUserUpcomingMatches, getMatchSpots, forceLeaveMatch } from '../controller/booking';

import auth from '../authorization/auth';

const router = express.Router();
router.post('/join/:matchId', auth, joinMatch);
router.get('/spots/:matchId', getMatchSpots);
router.get('/joinedMatches', auth, getUserMatches);
router.get('/allMyMatches', auth, getAllUserUpcomingMatches);
router.patch('/match/:matchId/kick/:userId', auth, forceLeaveMatch);

export default router;