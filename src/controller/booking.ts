import { Request, Response } from "express";
import Booking from "../models/booking";
import { BookingInt, BookingStatusInt, MatchStatusInt } from "../interface";
import { getMatchById, _updateMatch } from "../dao/match";
import bcrypt from "bcrypt";
import { toObjectId } from "../utils/helpers";
import { getAllUpcomingMatchesForUser, getUpcomingMatches, getUserUpcomingMatches } from "../dao/booking";
import { getUserById } from "../dao/user";

// ask whether the admin automatically gets booked into their own match or not
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

    if (match.blacklist.includes(toObjectId(userId))) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to join this match."
      });
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

    return res.status(201).json({ booking: savedBooking });
  } catch (error) {
    console.error("Error joining match:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// admin kick joined user out of match
export const forceLeaveMatch = async (req: Request, res: Response) => {
  try {
    const { matchId, userId } = req.params;

    if (!matchId || !userId) {
      return res.status(400).json({ message: "missing values" });
    }

    // Ensure admin performing the action
    const match = await getMatchById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    if (match.adminId.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Only the match admin can perform this action" });
    }

    // Fetch booking first
    const booking = await Booking.findOne({ matchId, userId });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found for this user in the match" });
    }

    // Prevent kicking a PAID user
    if (booking.status === BookingStatusInt.CONFIRMED) {
      return res.status(400).json({ message: "Cannot kick a user who has already paid" });
    }

    // Delete the booking (user has not paid yet)
    await Booking.deleteOne({ _id: booking._id });

    // Add user to blacklist
    await _updateMatch(matchId, {
      $addToSet: { blacklist: userId }
    });

    return res.status(200).json({
      message: "User has been removed from the match and blocked from rejoining"
    });

  } catch (error) {
    console.error("Error forcing user to leave match:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


export const getMatchSpots = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    if (!matchId) {
      return res.status(400).json({ message: "matchId is required" });
    }

    // Find bookings for the match and populate only firstName, lastName
    const bookings = await Booking.find({ matchId })
      .populate("userId", "firstName lastName image") // only select these fields
      .select("status userId spotBooked"); // only return relevant booking fields

    return res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching match spots:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getUserMatches = async (req: Request, res: Response) => {
  try {
    const userId = toObjectId(req.user.userId);
    const matches = await getUserUpcomingMatches(userId);
    if (!matches) {
      return res.status(404).json({ message: "No upcoming matches found" });
    }
    const matchesWithAdmin = await Promise.all(
          matches.map(async (match: any) => {
            console.log(match);
          const admin = await getUserById(match.adminId.toString());
          if (admin) {
            return {
            ...match,
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
    console.error("Error fetching user matches:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllUserUpcomingMatches = async (req: Request, res: Response) => {
  try {
    const userId = toObjectId(req.user.userId);
    const matches = await getUpcomingMatches(userId);
    if (!matches) {
      return res.status(404).json({ message: "No upcoming matches found" });
    }
    const matchesWithAdmin = await Promise.all(
          matches.map(async (match: any) => {
          const admin = await getUserById(match.adminId.toString());
          if (admin) {
            return {
            ...match,
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
    console.error("Error fetching all user matches:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
