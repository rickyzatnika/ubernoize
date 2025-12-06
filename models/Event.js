import mongoose, { Schema } from "mongoose";

const EventSchema = new Schema(
  {
    name: { type: String, required: true },
    city: { type: String, required: true },
    date: { type: Date, required: true },
    venue: { type: String },
    description: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.Event || mongoose.model("Event", EventSchema);
