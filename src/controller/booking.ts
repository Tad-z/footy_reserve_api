import { Request, Response } from "express";
import Booking from "../models/booking";
import { BookingInt, BookingStatusInt, MatchStatusInt } from "../interface";
import { getMatchById, _updateMatch } from "../dao/match";
import bcrypt from "bcrypt";
import { toObjectId } from "../utils/helpers";
import { getAllUpcomingMatchesForUser, getUserUpcomingMatches } from "../dao/booking";

export const joinMatch = async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const { teamId, password } = req.body;
  const matchId = req.params.matchId;

  if (!matchId || !password) {
    return res
      .status(400)
      .json({ message: "Match ID and password are required" });
  }
  try {
    const match = await getMatchById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }
    // Check if match is active
    if (match.status !== MatchStatusInt.ACTIVE) {
      return res.status(400).json({ message: "Match not active" });
    }
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, match.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }
    // verify teamId
    if (match.teamId !== teamId) {
      return res
        .status(400)
        .json({ message: "Invalid team ID for this match" });
    }
    // Check if user has already booked
    const existingBooking = await Booking.findOne({ matchId, userId });
    if (existingBooking) {
      return res
        .status(400)
        .json({ message: "You have already joined this match" });
    }
    // Check if spots are available
    if (match.spotsBooked >= match.spots) {
      return res.status(400).json({ message: "No spots available" });
    }
    // Create booking
    const newBooking: BookingInt = {
      matchId: toObjectId(matchId),
      userId: toObjectId(userId),
      status: BookingStatusInt.PENDING,
    };
    const booking = new Booking(newBooking);
    const savedBooking = await booking.save();
    if (!savedBooking) {
      return res.status(500).json({ message: "Failed to create booking" });
    }
  } catch (error) {
    console.error("Error joining match:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


export const getUserMatches = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const matches = await getUserUpcomingMatches(userId);
    return res.status(200).json({ matches });
  } catch (error) {
    console.error("Error fetching user matches:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllUserUpcomingMatches = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const matches = await getAllUpcomingMatchesForUser(userId);
    return res.status(200).json({ matches });
  } catch (error) {
    console.error("Error fetching all user matches:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
