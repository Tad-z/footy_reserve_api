import Match from "../models/match";
import { MatchInt, MatchStatusInt } from "../interface";

export const _updateMatch = async (id, update) => {
  return Match.findByIdAndUpdate(id, update, { new: true });
};


export const updateAllMatches = async (match, data) => {
    const newData = { ...data };
    const matches = await Match.updateMany(match, { $set: newData }).exec();
    return matches;
}

export const getMatchById = async (id: string) => {
    const match = await Match.findById(id);
    return match;
}

export const _getAdminUpcomingMatches = async (adminId: string) => {
  return await Match.find({
    adminId,
    matchDate: { $gte: new Date() },
    status: MatchStatusInt.ACTIVE,
  }).sort({ matchDate: 1 });
};