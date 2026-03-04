import cron from "node-cron";
import Match from "../models/match";
import Booking from "../models/booking";
import { MatchStatusInt, NotificationTypeInt } from "../interface";
import { sendToUsers } from "../services/firebase";

/**
 * Send reminder notifications to all players 1 hour before match starts
 * Runs every 15 minutes to check for upcoming matches
 */
export const startMatchReminderCron = () => {
  // Run every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    console.log("Running match reminder cron job...");

    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

      // Find matches starting within the next hour that haven't been reminded
      // We look for matches where:
      // - matchDate is today
      // - matchTime is within ~1 hour from now
      // - status is ACTIVE or FULLY_BOOKED
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const matches = await Match.find({
        matchDate: { $gte: today, $lt: tomorrow },
        status: { $in: [MatchStatusInt.ACTIVE, MatchStatusInt.FULLY_BOOKED, MatchStatusInt.PAID_UP] },
        reminderSent: { $ne: true },
      });

      for (const match of matches) {
        // Parse match time and check if it's within the reminder window
        const [hours, minutes] = match.matchTime.split(":").map(Number);
        const matchDateTime = new Date(match.matchDate);
        matchDateTime.setHours(hours, minutes, 0, 0);

        // Check if match is starting within the next hour (but not already started)
        if (matchDateTime > now && matchDateTime <= oneHourFromNow) {
          console.log(`Sending reminder for match ${match._id} at ${match.pitchName}`);

          // Get all users booked for this match
          const bookings = await Booking.find({ matchId: match._id });
          const userIds = bookings.map((b) => b.userId.toString());

          if (userIds.length > 0) {
            // Send notification to all players
            await sendToUsers(userIds, {
              title: "Match Starting Soon! ⚽",
              body: `Your match at ${match.pitchName} starts in about 1 hour at ${match.matchTime}`,
              type: NotificationTypeInt.MATCH_REMINDER,
              data: {
                matchId: match._id,
                pitchName: match.pitchName,
              },
            });

            // Mark reminder as sent
            await Match.findByIdAndUpdate(match._id, { reminderSent: true });

            console.log(`Reminder sent to ${userIds.length} users for match ${match._id}`);
          }
        }
      }
    } catch (error) {
      console.error("Error in match reminder cron:", error);
    }
  });

  console.log("Match reminder cron job started - runs every 15 minutes");
};
