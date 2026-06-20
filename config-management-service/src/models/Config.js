import mongoose from "mongoose";

const ConfigSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true },
    key: { type: String, required: true, trim: true },
    environment: { type: String, required: true },
    activeVersion: { type: Number, required: true },
    type: { type: String, enum: ['string', 'boolean', 'number', 'json'], default: 'string' },
  },
  { timestamps: true }
);

ConfigSchema.index({ clientId: 1, key: 1, environment: 1 }, { unique: true });

export default mongoose.model("Config", ConfigSchema);
