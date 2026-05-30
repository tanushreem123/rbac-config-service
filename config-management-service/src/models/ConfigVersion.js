import mongoose from "mongoose";

const ConfigVersionSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      required: true,
      trim: true,
    },
    environment: {
      type: String,
      enum: ["dev", "stage", "prod"],
      required: true,
    },
    version: {
      type: Number,
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    createdBy: {
      type: String,
      default: "system",
    },
  },
  {
    timestamps: true,
  }
);

// For fast lookups and versioning
ConfigVersionSchema.index(
  { configKey: 1, environment: 1, version: -1 },
  { unique: true }
);

export default mongoose.model("ConfigVersion", ConfigVersionSchema);
