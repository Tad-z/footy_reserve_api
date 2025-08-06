import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user";
import { generateAccessToken, generateRefreshToken } from "../logic/user";
import { UserInt } from "../interface";
import cloudinary from "../services/cloudinary";

const validateEmail = (email: string): boolean => {
  const regex = new RegExp(
    "([a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)"
  );
  const testEmail = regex.test(email);
  return testEmail;
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

    if (req.file) {
      const file = req.file;
      const fileStr = `data:${file.mimetype};base64,${file.buffer.toString(
        "base64"
      )}`;
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

