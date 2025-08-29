import mongoose from "mongoose";

export const toObjectId = (ids: any) => {
  try {
    if (ids.constructor === Array) {
      return ids.map((id: any) => new mongoose.Types.ObjectId(id));
    }
    return new mongoose.Types.ObjectId(ids);
  } catch (error) {
    console.log("toObjectId failed for", { ids });
    return ids;
  }
};