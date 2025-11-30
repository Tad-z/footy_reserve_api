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
  accountDetails?: AccountDetailsInt[];
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
  admin?: AdminDetailsInt;
  pitchName: string;
  matchDate: Date;
  matchTime: string;
  spots: number;
  spotsBooked?: number;
  bookedSpots?: number[];
  pricePerSpot: number;
  totalAmount: number;
  password: string;
  status?: MatchStatusInt;
  blacklist?: Schema.Types.ObjectId[];
  accountDetails: AccountDetailsInt;
  pricing?: PricingInt;
  autoPayout?: boolean;
  payoutInitiated?: boolean;
  payoutHistory?: PayoutHistoryInt[];
  payoutRef?: string;
  payoutAmount?: number;
  platformFee?: number;
  payoutDate?: Date;
};

export type PricingInt = {
  basePricePerSpot: number;
  platformFeePerSpot: number;
  stripeFeePerSpot: number;
  finalPricePerSpot: number;
  platformFeeRate: number;
  stripeFeeRate: number;
  stripeFixedFee: number;
  totalExpected: number;
};

export type PayoutHistoryInt = {
  status: payoutHistoryStatusInt;
  message: string;
  date: Date;
  payoutRef?: string;
};


export type AdminDetailsInt = {
    firstName: string;
    lastName: string;
    image?: string;
  };

export type AccountDetailsInt = {
  accountName: string;
  accountNumber: string;
  bankName: string;
  sortCode?: string;
  stripeAccountId?: string;
  connectedAt?: Date;
};

export type BookingInt = {
  _id?: Schema.Types.ObjectId;
  matchId: Schema.Types.ObjectId | MatchInt; 
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
  spotBooked?: number[];
  createdAt: Date;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  refundRef?: string;
  refundDate?: Date;
  refundReason?: string;
  failureReason?: string;
};

export enum payoutHistoryStatusInt {
  INITIATED= "INITIATED",
  SUCCESS= "SUCCESS",
  FAILED= "FAILED",
  DISCREPANCY= "DISCREPANCY"
};

export enum MatchStatusInt {
  ACTIVE = "ACTIVE",
  FULLY_BOOKED = "FULLY_BOOKED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
  PAID_UP = "PAID_UP",
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
  CANCELED = "CANCELED",
  REFUNDED = "REFUNDED",
}
