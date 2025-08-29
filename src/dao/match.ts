import Match from "../models/match";
import { MatchInt } from "../interface";

export const updateMatch = async (id, data) => {
    const newData = { ...data };
    const match = await Match.findByIdAndUpdate(id, newData, { new: true });
    return match;
}

export const updateAllMatches = async (match, data) => {
    const newData = { ...data };
    const matches = await Match.updateMany(match, { $set: newData }).exec();
    return matches;
}