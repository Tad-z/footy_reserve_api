import Booking from "../models/booking";
import { MatchStatusInt } from "../interface";

export const getUserUpcomingMatches = async (userId: string) => {
  const currentDate = new Date();

  const results = await Booking.aggregate([
    { $match: { userId } }, // find bookings by user
    {
      $lookup: {
        from: "Match", // collection name of Match
        localField: "matchId",
        foreignField: "_id",
        as: "match"
      }
    },
    { $unwind: "$match" }, // flatten match array
    {
      $match: {
        "match.status": MatchStatusInt.ACTIVE,
        "match.matchDate": { $gte: currentDate }
      }
    },
    { $sort: { "match.matchDate": 1 } }, // nearest first
    {
      $replaceRoot: { newRoot: "$match" } // return just match objects
    }
  ]);

  return results;
};
