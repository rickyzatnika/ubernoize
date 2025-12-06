import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable in .env.local");
}

let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

export async function connectToDatabase() {
  try {
    if (cached.conn) return cached.conn;
    
    if (!cached.promise) {
      console.log("Connecting to MongoDB:", MONGODB_URI ? "URI provided" : "URI missing");
      cached.promise = mongoose
        .connect(MONGODB_URI, {
          bufferCommands: false,
          dbName: "ubernoize",
        })
        .then((mongoose) => {
          console.log("MongoDB connected successfully");
          return mongoose;
        })
        .catch((error) => {
          console.error("MongoDB connection error:", error);
          cached.promise = null; // Reset promise on failure
          throw error;
        });
    }
    
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    console.error("Database connection failed:", error.message);
    // Reset cache on error
    cached.conn = null;
    cached.promise = null;
    throw new Error(`Database connection failed: ${error.message}`);
  }
}
