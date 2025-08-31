import express from 'express';
import { createMatch, getAdminUpcomingMatches, getAllMatches, getMatchDetails, updateMatch } from '../controller/match';
import auth from '../authorization/auth';


const router = express.Router();

router.post('/create', auth, createMatch);
router.get('/myMatches', auth, getAdminUpcomingMatches);
router.get('/', getAllMatches)
router.get('/:matchId', getMatchDetails);
router.patch('/update/:matchId', auth, updateMatch);

export default router