import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user";
import { generateAccessToken, generateRefreshToken } from "../logic/user";
import { UserInt } from "../interface";
import cloudinary from "../services/cloudinary";
import validator from "validator";

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
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    let imageUrl = "";
    const hash = await bcrypt.hash(req.body.password, 10);

    // Handle image upload - support both file upload and base64
    if (req.file) {
      // Handle multipart form file upload (your original working method)
      const file = req.file;
      const fileStr = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      
      try {
        const result = await cloudinary.uploader.upload(fileStr, {
          resource_type: "auto",
          folder: "user_profiles", // Optional: organize uploads in folders
        });
        
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
    } else if (req.body.image) {
      // Handle base64 image sent in request body
      try {
        let imageData = req.body.image;
        
        // If the image data doesn't already have the data URL format, add it
        if (!imageData.startsWith('data:')) {
          imageData = `data:image/jpeg;base64,${imageData}`;
        }
        
        const result = await cloudinary.uploader.upload(imageData, {
          resource_type: "auto",
          folder: "footy_user_profiles",
          // Add a custom public_id to avoid filename issues
          public_id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
        
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

    const user = new User({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: hash,
      country: req.body.country,
      image: imageUrl,
    });

    try {
      const savedUser = await user.save();
      if (!savedUser) {
        return res.status(500).json({
          message: "User creation failed",
        });
      }

      return res.status(201).json({
        message: "User created successfully",
        user: savedUser,
      });
    } catch (error) {
      console.error("Error saving user:", error);
      return res.status(500).json({
        message: "Internal server error",
      });
    }
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
