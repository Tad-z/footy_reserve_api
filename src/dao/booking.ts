import Booking from "../models/booking";
import { MatchStatusInt } from "../interface";
import Match from "../models/match";

export const getUserUpcomingMatches = async (userId: string) => {
  const currentDate = new Date();

  const results = await Booking.aggregate([
    { $match: { userId } }, // find bookings by user
    {
      $lookup: {
        from: "matches", // collection name of Match
        localField: "matchId",
        foreignField: "_id",
        as: "match"
      }
    },
    { $unwind: "$match" }, // flatten match array
    {
      $match: {
        "match.status": MatchStatusInt.ACTIVE,
        // "match.matchDate": { $gte: currentDate }
      }
    },
    { $sort: { "match.matchDate": 1 } }, // nearest first
    {
      $replaceRoot: { newRoot: "$match" } // return just match objects
    }
  ]);

  return results;
};

export const getAllUpcomingMatchesForUser = async (userId: string) => {
  const currentDate = new Date();
  
  // Admin matches
  const adminMatches = await Match.find({
    adminId: userId,
    matchDate: { $gte: currentDate },
    status: MatchStatusInt.ACTIVE,
  }).lean();
  
  // User bookings
  const userMatches = await Booking.aggregate([
    { $match: { userId } },
    {
      $lookup: {
        from: "matches", // Fixed: consistent lowercase plural
        localField: "matchId",
        foreignField: "_id",
        as: "match"
      }
    },
    { $unwind: "$match" },
    {
      $match: {
        "match.status": MatchStatusInt.ACTIVE,
        "match.matchDate": { $gte: currentDate }
      }
    },
    {
      $replaceRoot: { newRoot: "$match" }
    }
  ]);
  
  // Merge and sort chronologically
  const allMatches = [...adminMatches, ...userMatches];
  allMatches.sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  
  return allMatches;
};

export const getUpcomingMatches = async (userId: string) => {
  const currentDate = new Date();
  
  const results = await Match.aggregate([
    // First branch: matches where user is admin
    {
      $match: {
        adminId: userId,
        status: MatchStatusInt.ACTIVE,
        matchDate: { $gte: currentDate }
      }
    },
    // Merge with bookings branch
    {
      $unionWith: {
        coll: "bookings", 
        pipeline: [
          { $match: { userId } },
          {
            $lookup: {
              from: "matches",
              localField: "matchId",
              foreignField: "_id",
              as: "match"
            }
          },
          { $unwind: "$match" },
          {
            $match: {
              "match.status": MatchStatusInt.ACTIVE,
              "match.matchDate": { $gte: currentDate }
            }
          },
          { $replaceRoot: { newRoot: "$match" } }
        ]
      }
    },
    {
      $group: {
        _id: "$_id",
        doc: { $first: "$$ROOT" }
      }
    },
    {
      $replaceRoot: { newRoot: "$doc" }
    },
    // Finally sort merged results
    { $sort: { matchDate: 1 } }
  ]);
  
  return results;
};
