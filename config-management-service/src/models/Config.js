import mongoose from "mongoose";

const ConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    environment: {
      type: String,
      enum: ["dev", "stage", "prod"],
      required: true,
    },
    activeVersion: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One config per key per environment
ConfigSchema.index({ key: 1, environment: 1 }, { unique: true });

export default mongoose.model("Config", ConfigSchema);
