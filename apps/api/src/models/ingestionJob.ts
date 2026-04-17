import mongoose, { Schema, type InferSchemaType } from "mongoose";

export type JobStage =
  | "queued"
  | "downloading"
  | "processing"
  | "completed"
  | "failed";

const ingestionJobSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["queued", "downloading", "processing", "completed", "failed"],
      default: "queued",
      index: true,
    },
    stage: { type: String, default: "queued" },
    ticker: { type: String, required: true },
    cik: { type: String, default: "" },
    reportYear: { type: Number },
    force: { type: Boolean, default: false },
    error: { type: String },
    bytesDownloaded: { type: Number },
    localFile: { type: String },
    filingId: { type: Schema.Types.ObjectId },
    skipped: { type: Boolean, default: false },
    skipReason: { type: String },
  },
  { timestamps: true }
);

export type IngestionJobDoc = InferSchemaType<typeof ingestionJobSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const IngestionJobModel =
  mongoose.models.IngestionJob ??
  mongoose.model("IngestionJob", ingestionJobSchema);
