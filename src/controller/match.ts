import { Request, Response } from "express";
import Match from "../models/match";
import { MatchInt } from "../interface";
import bcrypt from "bcrypt";
import { _getAdminUpcomingMatches } from "../dao/match";

export const createMatch = async (req: Request, res: Response) => {
  const adminId = req.user.userId;
  const {
    teamId,
    pitchName,
    matchDate,
    matchTime,
    spots,
    pricePerSpot,
    password,
    accountDetails,
  } = req.body;

  if (
    !teamId ||
    !pitchName ||
    !matchDate ||
    !matchTime ||
    !spots ||
    !pricePerSpot ||
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

    // Check if teamId already exists
    const existing = await Match.findOne({ teamId });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Team ID already in use. Choose another." });
    }

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
    const { pitchName, matchDate, matchTime, spots, password } = req.body;

    try {
        const match = await Match.findById(matchId);

        if (!match) {
            return res.status(404).json({ message: "Match not found" });
        }

        if (match.adminId.toString() !== adminId) {
            return res.status(403).json({ message: "Not authorized to update this match" });
        }

        // Update only allowed fields if provided
        if (pitchName) match.pitchName = pitchName;
        if (matchDate) match.matchDate = matchDate;
        if (matchTime) match.matchTime = matchTime;
        if (spots) match.spots = spots;
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
        const match = await Match.findById(matchId)
        return res.status(200).json({ match });

    } catch (error) {
        console.error("Error fetching match details:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
    }

export const getAdminUpcomingMatches = async (req: Request, res: Response) => {
    const userId = req.user.userId; 
    try {
        const matches = await _getAdminUpcomingMatches(userId);
        return res.status(200).json({ matches });
    } catch (error) {
        console.error("Error fetching upcoming matches:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}