import mongoose, { Schema, type InferSchemaType } from "mongoose";

const chatConversationSchema = new Schema(
  {
    title: { type: String, default: "New chat" },
    tickerFilter: { type: String, default: "" },
    yearFilter: { type: Number },
  },
  { timestamps: true }
);

export type ChatConversationDoc = InferSchemaType<typeof chatConversationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ChatConversationModel =
  mongoose.models.ChatConversation ??
  mongoose.model("ChatConversation", chatConversationSchema);
