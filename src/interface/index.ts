import { Schema } from "mongoose";

export type UserInt = {
  _id?: Schema.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  country: string;
  image?: string;
  refreshToken?: string;
  deviceToken?: string[];
};

export type DecodedTokenInt = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type MatchInt = {
  _id?: Schema.Types.ObjectId;
  teamId: string;
  adminId: Schema.Types.ObjectId;
  pitchName: string;
  matchDate: Date;
  matchTime: string;
  spots: number;
  spotsBooked?: number;
  pricePerSpot: number;
  totalAmount: number;
  password: string;
  status?: MatchStatusInt;
  accountDetails: AccountDetailsInt;
};

export type AccountDetailsInt = {
  accountName: string;
  accountNumber: string;
  bankName: string;
  sortCode?: string;
};

export type BookingInt = {
  _id?: Schema.Types.ObjectId;
  matchId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  status: BookingStatusInt;
  amountPaid?: number;
  spotBooked?: number[];
};

export type PaymentInt = {
  _id?: Schema.Types.ObjectId;
  bookingId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  matchId: Schema.Types.ObjectId;
  amount: number;
  status: PaymentStatusInt;
  transactionRef: string;
  createdAt: Date;
};

export enum MatchStatusInt {
  ACTIVE = "ACTIVE",
  FULLY_BOOKED = "FULLY_BOOKED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
}

export enum BookingStatusInt {
  CONFIRMED = "CONFIRMED",
  PENDING = "PENDING",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatusInt {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}
