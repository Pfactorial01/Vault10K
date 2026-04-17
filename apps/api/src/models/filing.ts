import mongoose, { Schema, type InferSchemaType } from "mongoose";

const filingSchema = new Schema(
  {
    ticker: { type: String, required: true, index: true },
    cik: { type: String, required: true },
    companyName: { type: String, default: "" },
    reportDate: { type: String, required: true },
    filingDate: { type: String, required: true },
    accession: { type: String, required: true, unique: true },
    localFile: { type: String, required: true },
    /** Legacy: full text in DB (small filings only). Prefer scrubbedFile for large 10-Ks (Mongo 16MB limit). */
    scrubbedText: { type: String, required: false },
    /** Path to UTF-8 scrubbed plain text (written at ingest). */
    scrubbedFile: { type: String, required: false },
    /** Path to extracted primary 10-K HTML (written at ingest). */
    primaryHtmlFile: { type: String, required: false },
    contentHash: { type: String, required: true, index: true },
    sectionLabels: { type: Schema.Types.Mixed, default: {} },
    chunkMarkers: [
      {
        chunkId: { type: String, required: true },
        charStart: { type: Number, required: true },
        charEnd: { type: Number, required: true },
        section: { type: String, default: "Unknown" },
      },
    ],
  },
  { timestamps: true }
);

export type FilingDoc = InferSchemaType<typeof filingSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const FilingModel =
  mongoose.models.Filing ?? mongoose.model("Filing", filingSchema);
