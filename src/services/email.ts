import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const fromAddress = process.env.SMTP_FROM || "Footy Reserve <noreply@footyreserve.com>";

export const sendOtpEmail = async (
  email: string,
  otp: string,
  type: "signup" | "password_reset"
) => {
  const subject =
    type === "signup"
      ? "Verify Your Email - Footy Reserve"
      : "Password Reset - Footy Reserve";

  const heading =
    type === "signup" ? "Welcome to Footy Reserve!" : "Password Reset Request";

  const message =
    type === "signup"
      ? "Thank you for signing up! Please use the code below to verify your email address."
      : "You requested to reset your password. Use the code below to proceed.";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1a472a 0%, #2d5a3f 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">⚽ Footy Reserve</h1>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1a472a; margin-top: 0;">${heading}</h2>

        <p style="color: #555;">${message}</p>

        <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 25px 0;">
          <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your verification code is:</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a472a;">${otp}</div>
        </div>

        <p style="color: #888; font-size: 14px;">
          This code will expire in <strong>5 minutes</strong>.
        </p>

        <p style="color: #888; font-size: 14px;">
          If you didn't request this, please ignore this email.
        </p>

        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">

        <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
          © ${new Date().getFullYear()} Footy Reserve. All rights reserved.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
${heading}

${message}

Your verification code is: ${otp}

This code will expire in 5 minutes.

If you didn't request this, please ignore this email.

© ${new Date().getFullYear()} Footy Reserve. All rights reserved.
  `;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject,
      text: textContent,
      html,
    });

    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error };
  }
};

export const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log("Email service connected successfully");
    return true;
  } catch (error) {
    console.error("Email service connection failed:", error);
    return false;
  }
};

export default {
  sendOtpEmail,
  verifyEmailConnection,
};
