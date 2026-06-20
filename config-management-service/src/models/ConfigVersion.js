import mongoose from "mongoose";

const ConfigVersionSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true },
    configKey: { type: String, required: true, trim: true },
    environment: { type: String, required: true },
    version: { type: Number, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    type: { type: String, enum: ['string', 'boolean', 'number', 'json'], default: 'string' },
    createdBy: { type: String, default: "system" },
  },
  { timestamps: true }
);

ConfigVersionSchema.index(
  { clientId: 1, configKey: 1, environment: 1, version: -1 },
  { unique: true }
);

export default mongoose.model("ConfigVersion", ConfigVersionSchema);
