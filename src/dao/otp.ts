import { OtpTypeInt } from "../interface";
import Otp from "../models/otp";
import bcrypt from "bcrypt";

const OTP_LENGTH = 4;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

export const generateOtpCode = (): string => {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

export const createOtp = async (email: string, type: OtpTypeInt) => {
  // Delete any existing OTP for this email and type
  await Otp.deleteMany({ email, type });

  // Generate new OTP
  const code = generateOtpCode();
  const hashedCode = await bcrypt.hash(code, 10);

  const otp = new Otp({
    email,
    code: hashedCode,
    type,
    lastSentAt: new Date(),
  });

  await otp.save();

  // Return plain code for sending via email
  return code;
};

export const getOtpByEmail = async (email: string, type: OtpTypeInt) => {
  return await Otp.findOne({ email, type });
};

export const verifyOtp = async (
  email: string,
  code: string,
  type: OtpTypeInt
): Promise<{ success: boolean; message: string }> => {
  const otp = await Otp.findOne({ email, type });

  if (!otp) {
    return { success: false, message: "OTP not found or expired" };
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    return { success: false, message: "Maximum attempts exceeded. Please request a new OTP." };
  }

  // Increment attempts
  otp.attempts += 1;
  await otp.save();

  // Verify code
  const isValid = await bcrypt.compare(code, otp.code);

  if (!isValid) {
    const remainingAttempts = MAX_ATTEMPTS - otp.attempts;
    return {
      success: false,
      message: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining.`,
    };
  }

  return { success: true, message: "OTP verified successfully" };
};

export const markOtpAsVerified = async (email: string, type: OtpTypeInt) => {
  return await Otp.findOneAndUpdate(
    { email, type },
    { verified: true },
    { new: true }
  );
};

export const isOtpVerified = async (email: string, type: OtpTypeInt) => {
  const otp = await Otp.findOne({ email, type, verified: true });
  return !!otp;
};

export const canResendOtp = async (
  email: string,
  type: OtpTypeInt
): Promise<{ canResend: boolean; waitSeconds?: number }> => {
  const otp = await Otp.findOne({ email, type });

  if (!otp) {
    return { canResend: true };
  }

  const now = new Date();
  const lastSent = new Date(otp.lastSentAt);
  const diffSeconds = Math.floor((now.getTime() - lastSent.getTime()) / 1000);

  if (diffSeconds < RESEND_COOLDOWN_SECONDS) {
    return {
      canResend: false,
      waitSeconds: RESEND_COOLDOWN_SECONDS - diffSeconds,
    };
  }

  return { canResend: true };
};

export const resendOtp = async (
  email: string,
  type: OtpTypeInt
): Promise<{ success: boolean; code?: string; message?: string; waitSeconds?: number }> => {
  const canResend = await canResendOtp(email, type);

  if (!canResend.canResend) {
    return {
      success: false,
      message: `Please wait ${canResend.waitSeconds} seconds before requesting a new OTP`,
      waitSeconds: canResend.waitSeconds,
    };
  }

  // Generate new OTP (this deletes the old one)
  const code = await createOtp(email, type);

  return { success: true, code };
};

export const deleteOtp = async (email: string, type: OtpTypeInt) => {
  return await Otp.deleteMany({ email, type });
};
