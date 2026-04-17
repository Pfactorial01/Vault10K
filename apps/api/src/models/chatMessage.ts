import mongoose, { Schema, type InferSchemaType } from "mongoose";

const citationSub = {
  chunkId: { type: String, required: true },
  ticker: { type: String, required: true },
  year: { type: Number, required: true },
  section: { type: String, required: true },
  excerpt: { type: String, required: true },
  charStart: { type: Number, required: true },
  charEnd: { type: Number, required: true },
  filingId: { type: String },
};

const chatMessageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
      index: true,
    },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    citations: { type: [citationSub], default: [] },
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversationId: 1, createdAt: 1 });

export type ChatMessageDoc = InferSchemaType<typeof chatMessageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ChatMessageModel =
  mongoose.models.ChatMessage ?? mongoose.model("ChatMessage", chatMessageSchema);
