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
  reminderSent?: boolean;
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

// Device types
export enum DevicePlatformInt {
  IOS = "ios",
  ANDROID = "android",
  WEB = "web",
}

export enum TokenStatusInt {
  ACTIVE = "active",
  INVALID = "invalid",
  EXPIRED = "expired",
}

export type DeviceInt = {
  _id?: Schema.Types.ObjectId;
  deviceId: string;
  fcmToken: string;
  platform: DevicePlatformInt;
  appVersion: string;
  userId?: Schema.Types.ObjectId | null;
  lastSeenAt?: Date;
  tokenStatus?: TokenStatusInt;
  createdAt?: Date;
  updatedAt?: Date;
};

// Notification types
export enum NotificationTypeInt {
  // Match events
  MATCH_JOINED = "MATCH_JOINED",
  MATCH_FULLY_BOOKED = "MATCH_FULLY_BOOKED",
  MATCH_CANCELLED = "MATCH_CANCELLED",
  MATCH_REMINDER = "MATCH_REMINDER",
  MATCH_UPDATED = "MATCH_UPDATED",

  // Booking events
  USER_KICKED = "USER_KICKED",

  // Payment events
  PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  SPOT_PAID = "SPOT_PAID",
  REFUND_PROCESSED = "REFUND_PROCESSED",

  // Payout events
  PAYOUT_INITIATED = "PAYOUT_INITIATED",
  PAYOUT_COMPLETED = "PAYOUT_COMPLETED",
  PAYOUT_FAILED = "PAYOUT_FAILED",

  // System
  BROADCAST = "BROADCAST",
}

export type NotificationDataInt = {
  matchId?: Schema.Types.ObjectId;
  bookingId?: Schema.Types.ObjectId;
  paymentId?: Schema.Types.ObjectId;
  userId?: Schema.Types.ObjectId;
  amount?: number;
  pitchName?: string;
  spots?: number;
};

export type NotificationInt = {
  _id?: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  title: string;
  body: string;
  type: NotificationTypeInt;
  data?: NotificationDataInt;
  isRead?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type NotificationPayloadInt = {
  title: string;
  body: string;
  type: NotificationTypeInt;
  data?: NotificationDataInt;
};

// OTP types
export enum OtpTypeInt {
  SIGNUP = "SIGNUP",
  PASSWORD_RESET = "PASSWORD_RESET",
}

export type OtpInt = {
  _id?: Schema.Types.ObjectId;
  email: string;
  code: string;
  type: OtpTypeInt;
  attempts?: number;
  verified?: boolean;
  lastSentAt?: Date;
  createdAt?: Date;
};

export type TempUserInt = {
  _id?: Schema.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  country: string;
  image?: string;
  createdAt?: Date;
};
