import { Request, Response } from "express";
import Match from "../models/match";
import { MatchInt, MatchStatusInt } from "../interface";
import bcrypt from "bcrypt";
import { _getAdminUpcomingMatches } from "../dao/match";
import { getUserById } from "../dao/user";

export const createMatch = async (req: Request, res: Response) => {
  const adminId = req.user.userId;
  console.log({ reqBody: req.body });
  const {
    teamId,
    pitchName,
    matchDate,
    matchTime,
    spots,
    totalAmount,
    password,
    accountDetails,
  } = req.body;

  if (
    !teamId ||
    !pitchName ||
    !matchDate ||
    !matchTime ||
    !spots ||
    !totalAmount ||
    !password ||
    !accountDetails
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Ensure match date is not in the past
    if (new Date(matchDate) < new Date()) {
      return res
        .status(400)
        .json({ message: "Match date must be in the future" });
    }

    // Prevent same admin from creating more than 3 active matches
    const activeMatchesCount = await Match.countDocuments({
      adminId,
      matchDate: { $gte: new Date() },
      status: MatchStatusInt.ACTIVE,
    });

    if (activeMatchesCount >= 3) {
      return res.status(400).json({
        message: "You cannot create more than 3 active matches",
      });
    }

    // Check if teamId already exists
    const existing = await Match.findOne({ teamId });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Team ID already in use. Choose another." });
    }

    const pricePerSpot = totalAmount / spots;

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const newMatch = new Match({
      teamId,
      adminId,
      pitchName,
      matchDate,
      matchTime,
      spots,
      pricePerSpot,
      totalAmount,
      password: hashedPassword,
      accountDetails,
    });

    const savedMatch = await newMatch.save();
    return res
      .status(201)
      .json({ message: "Match created successfully", match: savedMatch });
  } catch (error) {
    console.error("Error creating match:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateMatch = async (req: Request, res: Response) => {
  const adminId = req.user.userId; // from auth middleware
  const { matchId } = req.params;
  const { pitchName, matchDate, matchTime, spots, password, totalAmount } = req.body;

  try {
    const match = await Match.findById(matchId);

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    if (match.adminId.toString() !== adminId) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this match" });
    }

    // Update only allowed fields if provided
    if (pitchName) match.pitchName = pitchName;
    if (matchDate) match.matchDate = matchDate;
    if (matchTime) match.matchTime = matchTime;
    // recalculate pricePerSpot if totalAmount or spots change
    if (spots) match.spots = spots;
    if (totalAmount) match.totalAmount = totalAmount;
    if (spots || totalAmount) {
      match.pricePerSpot = match.totalAmount / match.spots;
    }
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      match.password = hashedPassword;
    }

    const updatedMatch = await match.save();

    return res.status(200).json({
      message: "Match updated successfully",
      match: updatedMatch,
    });
  } catch (error) {
    console.error("Error updating match:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMatchDetails = async (req: Request, res: Response) => {
  const { matchId } = req.params;
  try {
    // use the adminId to include admin info
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }
    const adminId = match.adminId.toString();
    const admin = await getUserById(adminId);
    if (admin) {
      const adminInfo = {
        firstName: admin.firstName,
        lastName: admin.lastName,
        image: admin.image,
      };
      const matchObj = match.toObject();
      matchObj.admin = adminInfo;
      return res.status(200).json({ match: matchObj });
    }
    return res.status(200).json({ match });
  } catch (error) {
    console.error("Error fetching match details:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAdminUpcomingMatches = async (req: Request, res: Response) => {
  const userId = req.user.userId;
  try {
    const matches = await _getAdminUpcomingMatches(userId);
    if (!matches) {
      return res.status(404).json({ message: "No upcoming matches found" });
    }
    // for each match, include admin details
    const matchesWithAdmin = await Promise.all(
      matches.map(async (match: any) => {
      const admin = await getUserById(match.adminId.toString());
      if (admin) {
        return {
        ...match.toObject(),
        admin: {
          firstName: admin.firstName,
          lastName: admin.lastName,
          image: admin.image,
        },
        };
      }
      return match;
      })
    );
    // return matches with admin info
    return res.status(200).json({ matches: matchesWithAdmin });
  } catch (error) {
    console.error("Error fetching upcoming matches:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllMatches = async (req: Request, res: Response) => {
  try {
    const matches = await Match.find().sort({ matchDate: 1 });
    return res.status(200).json({ matches });
  } catch (error) {
    console.error("Error fetching all matches:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
