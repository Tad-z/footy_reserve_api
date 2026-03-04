import { TempUserInt } from "../interface";
import TempUser from "../models/tempUser";

export const createTempUser = async (userData: TempUserInt) => {
  // Delete any existing temp user with this email
  await TempUser.deleteMany({ email: userData.email });

  const tempUser = new TempUser(userData);
  return await tempUser.save();
};

export const getTempUserByEmail = async (email: string) => {
  return await TempUser.findOne({ email });
};

export const deleteTempUser = async (email: string) => {
  return await TempUser.deleteMany({ email });
};
