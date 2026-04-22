import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../helpers/logger";

// Connect to MongoDB
const connectToDatabase = async () => {
  try {
    await mongoose.connect(env.mongodbUri, {
      sanitizeFilter: true,
      autoCreate: true,
    });
    logger.info("Connected to MongoDB successfully");
  } catch (error) {
    logger.error("Error connecting to MongoDB", error);
    process.exit(1); // Exit process with failure
  }
};

export default connectToDatabase;
