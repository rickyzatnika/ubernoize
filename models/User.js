import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String },
    email: { type: String, unique: true, index: true, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    passwordHash: { type: String },
    image: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
