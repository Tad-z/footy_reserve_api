import mongoose from "mongoose";

const main = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MongoDB URI is missing in environment variables.");
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.log((err as Error).message); // Cast err to Error type
    process.exit(1);
  }
};

export default main;
