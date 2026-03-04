import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user";
import { generateAccessToken, generateRefreshToken } from "../logic/user";
import { OtpTypeInt } from "../interface";
import cloudinary from "../services/cloudinary";
import validator from "validator";
import { createOtp, verifyOtp, deleteOtp, resendOtp, isOtpVerified, markOtpAsVerified } from "../dao/otp";
import { createTempUser, getTempUserByEmail, deleteTempUser } from "../dao/tempUser";
import { sendOtpEmail } from "../services/email";
import TempUser from "../models/tempUser";

const validateEmail = (email: string): boolean => {
  return validator.isEmail(email);
};

export const createUser = async (req: Request, res: Response) => {
  const requiredFields = [
    "firstName",
    "lastName",
    "email",
    "password",
    "country",
  ];
  for (const field of requiredFields) {
    if (!req.body[field]) {
      return res.status(400).json({
        message: `Missing required field: ${field}`,
      });
    }
  }

  if (validateEmail(req.body.email) === false) {
    return res.status(400).json({
      message: "Email Address is not valid",
    });
  }

  try {
    // Check if user already exists in User collection
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    // Check if user already exists in TempUser collection (pending verification)
    const existingTempUser = await getTempUserByEmail(req.body.email);
    if (existingTempUser) {
      // Delete old temp user to allow re-registration
      await deleteTempUser(req.body.email);
    }

    let imageUrl = "";
    const hash = await bcrypt.hash(req.body.password, 10);

    if (req.file) {
      const file = req.file;
      const fileStr = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      try {
        const result = await cloudinary.uploader.upload(fileStr);
        if (result && result.secure_url) {
          imageUrl = result.secure_url;
        } else {
          return res.status(500).json({
            message: "Image upload failed",
          });
        }
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          message: "Image upload failed",
        });
      }
    }

    // Create temp user
    await createTempUser({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: hash,
      country: req.body.country,
      image: imageUrl,
    });

    // Generate and send OTP
    const otpCode = await createOtp(req.body.email, OtpTypeInt.SIGNUP);
    await sendOtpEmail(req.body.email, otpCode, "signup");

    return res.status(201).json({
      message: "OTP sent to your email. Please verify to complete registration.",
      email: req.body.email,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const verifySignupOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      message: "Email and OTP are required",
    });
  }

  try {
    // Verify OTP
    const result = await verifyOtp(email, otp, OtpTypeInt.SIGNUP);
    if (!result.success) {
      return res.status(400).json({
        message: result.message,
      });
    }

    // Get temp user
    const tempUser = await getTempUserByEmail(email);
    if (!tempUser) {
      return res.status(404).json({
        message: "Registration expired. Please sign up again.",
      });
    }

    // Create actual user
    const user = new User({
      firstName: tempUser.firstName,
      lastName: tempUser.lastName,
      email: tempUser.email,
      password: tempUser.password,
      country: tempUser.country,
      image: tempUser.image,
    });

    const savedUser = await user.save();
    if (!savedUser) {
      return res.status(500).json({
        message: "User creation failed",
      });
    }

    // Clean up temp user and OTP
    await deleteTempUser(email);
    await deleteOtp(email, OtpTypeInt.SIGNUP);

    // Generate tokens
    const jwtKey = process.env.JWT_KEY;
    if (!jwtKey) {
      return res.status(500).json({
        message: "JWT secret key is missing in environment variables.",
      });
    }

    const accessToken = generateAccessToken(savedUser, jwtKey);
    const refreshToken = generateRefreshToken(savedUser, jwtKey);

    savedUser.refreshToken = refreshToken;
    await savedUser.save();

    return res.status(201).json({
      message: "Email verified successfully. Account created.",
      accessToken,
      refreshToken,
      user: {
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        email: savedUser.email,
        country: savedUser.country,
        image: savedUser.image,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const resendOtpCode = async (req: Request, res: Response) => {
  const { email, type } = req.body;

  if (!email || !type) {
    return res.status(400).json({
      message: "Email and type are required",
    });
  }

  if (!Object.values(OtpTypeInt).includes(type)) {
    return res.status(400).json({
      message: "Invalid OTP type",
    });
  }

  try {
    // For signup, check if temp user exists
    if (type === OtpTypeInt.SIGNUP) {
      const tempUser = await getTempUserByEmail(email);
      if (!tempUser) {
        return res.status(404).json({
          message: "No pending registration found. Please sign up again.",
        });
      }
    }

    // For password reset, check if user exists
    if (type === OtpTypeInt.PASSWORD_RESET) {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }
    }

    // Resend OTP
    const result = await resendOtp(email, type);
    if (!result.success) {
      return res.status(429).json({
        message: result.message,
        waitSeconds: result.waitSeconds,
      });
    }

    // Send email
    const emailType = type === OtpTypeInt.SIGNUP ? "signup" : "password_reset";
    await sendOtpEmail(email, result.code!, emailType);

    return res.status(200).json({
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({
        message: "Email and password are required",
        });
    }
    
    try {
        const user = await User.findOne({ email });
    
        if (!user) {
        return res.status(404).json({
            message: "User not found",
        });
        }
    
        const isPasswordValid = await bcrypt.compare(password, user.password);
    
        if (!isPasswordValid) {
        return res.status(401).json({
            message: "Invalid credentials",
        });
        }
        
        const jwtKey = process.env.JWT_KEY;
        if (!jwtKey) {
            return res.status(500).json({
                message: "JWT secret key is missing in environment variables."
            });
        }
        const accessToken = generateAccessToken(user, jwtKey);
        const refreshToken = generateRefreshToken(user, jwtKey);

        const deviceToken = req.body.deviceToken;
        if (deviceToken) {
        if (!user.deviceToken) {
            user.deviceToken = [];
        }
        if (!user.deviceToken.includes(deviceToken)) {
            user.deviceToken.push(deviceToken);
        }
        }
    
        user.refreshToken = refreshToken;
        await user.save();
    
        return res.status(200).json({
        message: "Login successful",
        accessToken,
        refreshToken,
        user: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            country: user.country,
            image: user.image,
        },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
        message: "Internal server error",
        });
    }
}

export const refreshToken = async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(401).json({
      message: "Refresh token is required",
    });
  }

  try {
    const jwtKey = process.env.JWT_KEY;
    if (!jwtKey) {
      throw new Error("JWT secret key is missing in environment variables.");
    }

    const decoded = jwt.verify(token, jwtKey) as any;
    const user = await User.findById(decoded.userId).exec();
    if (!user || user.refreshToken !== token) {
      return res.status(403).json({
        message: "Invalid refresh token",
      });
    }

    const newAccessToken = generateAccessToken(user, jwtKey);
    const newRefreshToken = generateRefreshToken(user, jwtKey);

    // Update refreshToken in the database or secure storage
    user.refreshToken = newRefreshToken;

    await user.save();

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.log(error);
    return res.status(403).json({
      message: "Invalid refresh token",
    });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const userId = req.user.userId;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (req.body.firstName) {
      user.firstName = req.body.firstName;
    }
    if (req.body.lastName) {
      user.lastName = req.body.lastName;
    }
    if (req.body.country) {
      user.country = req.body.country;
    }

    let imageUrl = "";
    if (req.file) {
      const file = req.file;
      const fileStr = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      try {
        const result = await cloudinary.uploader.upload(fileStr);
        if (result && result.secure_url) {
          imageUrl = result.secure_url;
        } else {
          return res.status(500).json({
            message: "Image upload failed",
          });
        }
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          message: "Image upload failed",
        });
      }
    }

    user.image = imageUrl;

    if (req.body.email) {
      if (validateEmail(req.body.email) === false) {
        return res.status(400).json({
          message: "Email Address is not valid",
        });
      }
      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser && existingUser._id.toString() !== userId) {
        return res.status(409).json({
          message: "Email is already in use by another account",
        });
      }
      user.email = req.body.email;
    }

    await user.save();

    return res.status(200).json({
      message: "User updated successfully",
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        country: user.country,
        image: user.image,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export const checkPassword = async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({
      message: "Password is required",
    });
  }
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    return res.status(200).json({
      valid: isPasswordValid,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  } 
}

export const updateUserPassword = async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const { newPassword, confirmPassword } = req.body;
  if (!newPassword || !confirmPassword) {
    return res.status(400).json({
      message: "New password and confirm password are required",
    });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      message: "New password and confirm password do not match",
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    await user.save();
    return res.status(200).json({
      message: "Password updated successfully",
    });
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      message: "Email is required",
    });
  }

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        message: "If an account with this email exists, an OTP has been sent.",
      });
    }

    // Generate and send OTP
    const otpCode = await createOtp(email, OtpTypeInt.PASSWORD_RESET);
    await sendOtpEmail(email, otpCode, "password_reset");

    return res.status(200).json({
      message: "If an account with this email exists, an OTP has been sent.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export const verifyPasswordResetOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      message: "Email and OTP are required",
    });
  }

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Verify OTP
    const result = await verifyOtp(email, otp, OtpTypeInt.PASSWORD_RESET);
    if (!result.success) {
      return res.status(400).json({
        message: result.message,
      });
    }

    // Mark OTP as verified (allows password reset)
    await markOtpAsVerified(email, OtpTypeInt.PASSWORD_RESET);

    return res.status(200).json({
      message: "OTP verified. You can now reset your password.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and new password are required",
    });
  }

  try {
    // Check if OTP was verified
    const otpVerified = await isOtpVerified(email, OtpTypeInt.PASSWORD_RESET);
    if (!otpVerified) {
      return res.status(403).json({
        message: "Please verify OTP before resetting password",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const hash = await bcrypt.hash(password, 10);
    user.password = hash;
    await user.save();

    // Clean up OTP
    await deleteOtp(email, OtpTypeInt.PASSWORD_RESET);

    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}