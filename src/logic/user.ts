import jwt from "jsonwebtoken";

export const generateAccessToken = (user: any, jwtKey: string) => {
    return jwt.sign(
      {
        firstName: user.firstName,
        lastName: user.lastName,
        userId: user._id,
        email: user.email
      },
      jwtKey,
      {
        expiresIn: "1h",
      }
    );
  };
  
export const generateRefreshToken = (user: any, jwtKey: string) => {
    return jwt.sign(
      {
        userId: user._id,
      },
      jwtKey,
      {
        expiresIn: "7d",
      }
    );
  };