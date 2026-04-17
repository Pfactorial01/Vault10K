import type { Express } from "express";
import mongoose from "mongoose";
import OpenAI from "openai";
import { config } from "../config.js";
import { ChatConversationModel } from "../models/chatConversation.js";
import { ChatMessageModel } from "../models/chatMessage.js";
import {
  runRagPipeline,
  type ChatHistoryTurn,
} from "../services/ragPipeline.js";
import { resolveRetrievalTicker } from "../services/tickerFromQuery.js";
import { getVaultStats } from "../services/vaultContext.js";

function titleFromFirstMessage(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= 48) return t || "New chat";
  return `${t.slice(0, 45)}…`;
}

export function registerChats(app: Express): void {
  const openai = config.openaiApiKey
    ? new OpenAI({ apiKey: config.openaiApiKey })
    : null;

  app.get("/api/chats", async (_req, res) => {
    const rows = await ChatConversationModel.find()
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    res.json({
      chats: rows.map((r) => ({
        id: String(r._id),
        title: r.title,
        tickerFilter: r.tickerFilter ?? "",
        yearFilter: r.yearFilter,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
      })),
    });
  });

  app.post("/api/chats", async (req, res) => {
    const body = req.body as {
      title?: string;
      tickerFilter?: string;
      year?: number;
    };
    const doc = await ChatConversationModel.create({
      title: body.title?.trim() || "New chat",
      tickerFilter: body.tickerFilter?.trim() ?? "",
      yearFilter:
        body.year !== undefined && Number.isFinite(body.year)
          ? Number(body.year)
          : undefined,
    });
    res.status(201).json({
      id: String(doc._id),
      title: doc.title,
      tickerFilter: doc.tickerFilter ?? "",
      yearFilter: doc.yearFilter,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  });

  app.get("/api/chats/:id", async (req, res) => {
    const convRaw = await ChatConversationModel.findById(
      String(req.params.id)
    ).lean();
    if (!convRaw || Array.isArray(convRaw)) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const conv = convRaw as unknown as {
      _id: mongoose.Types.ObjectId;
      title: string;
      tickerFilter?: string;
      yearFilter?: number;
      createdAt: Date;
      updatedAt: Date;
    };
    const messages = await ChatMessageModel.find({
      conversationId: conv._id,
    })
      .sort({ createdAt: 1 })
      .lean();
    res.json({
      id: String(conv._id),
      title: conv.title,
      tickerFilter: conv.tickerFilter ?? "",
      yearFilter: conv.yearFilter,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messages: messages.map((m) => ({
        id: String(m._id),
        role: m.role,
        content: m.content,
        citations: m.citations ?? [],
        createdAt: m.createdAt,
      })),
    });
  });

  app.patch("/api/chats/:id", async (req, res) => {
    const body = req.body as {
      title?: string;
      tickerFilter?: string;
      year?: number | null;
    };
    const setOps: Record<string, unknown> = {};
    if (body.title !== undefined) setOps.title = body.title.trim();
    if (body.tickerFilter !== undefined)
      setOps.tickerFilter = body.tickerFilter.trim();
    let unsetYear = false;
    if (body.year !== undefined) {
      if (body.year === null) {
        unsetYear = true;
      } else {
        setOps.yearFilter = Number(body.year);
      }
    }
    const mongoUpdate: mongoose.UpdateQuery<unknown> = {};
    if (Object.keys(setOps).length > 0) {
      mongoUpdate.$set = setOps;
    }
    if (unsetYear) {
      mongoUpdate.$unset = { yearFilter: 1 };
    }
    const docRaw = await ChatConversationModel.findByIdAndUpdate(
      String(req.params.id),
      mongoUpdate,
      { new: true }
    )
      .lean()
      .exec();
    if (!docRaw || Array.isArray(docRaw)) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const doc = docRaw as unknown as {
      _id: mongoose.Types.ObjectId;
      title: string;
      tickerFilter?: string;
      yearFilter?: number;
      updatedAt: Date;
    };
    res.json({
      id: String(doc._id),
      title: doc.title,
      tickerFilter: doc.tickerFilter ?? "",
      yearFilter: doc.yearFilter,
      updatedAt: doc.updatedAt,
    });
  });

  app.delete("/api/chats/:id", async (req, res) => {
    const id = String(req.params.id);
    const del = await ChatConversationModel.findByIdAndDelete(id);
    if (!del) {
      res.status(404).json({ error: "not found" });
      return;
    }
    await ChatMessageModel.deleteMany({ conversationId: id });
    res.status(204).send();
  });

  app.post("/api/chats/:id/messages", async (req, res) => {
    if (!openai) {
      res.status(503).json({ error: "OPENAI_API_KEY not configured" });
      return;
    }
    const convId = String(req.params.id);
    const conv = await ChatConversationModel.findById(convId);
    if (!conv) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const body = req.body as { content?: string };
    const content = body.content?.trim();
    if (!content) {
      res.status(400).json({ error: "content required" });
      return;
    }

    const stats = await getVaultStats();
    const indexedTickers = Object.keys(stats.byTicker);
    const ticker = resolveRetrievalTicker(
      content,
      indexedTickers,
      conv.tickerFilter ?? ""
    );
    const year = conv.yearFilter;

    const prior = await ChatMessageModel.find({ conversationId: conv._id })
      .sort({ createdAt: 1 })
      .lean();

    const history: ChatHistoryTurn[] = prior.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const { answer, citations, cached } = await runRagPipeline(
      openai,
      content,
      {
        ticker,
        year,
        history,
        useSemanticCache: history.length === 0,
      }
    );

    await ChatMessageModel.create({
      conversationId: conv._id,
      role: "user",
      content,
      citations: [],
    });

    await ChatMessageModel.create({
      conversationId: conv._id,
      role: "assistant",
      content: answer,
      citations,
    });

    if (conv.title === "New chat" || !conv.title?.trim()) {
      conv.title = titleFromFirstMessage(content);
    }
    conv.updatedAt = new Date();
    await conv.save();

    res.status(201).json({
      answer,
      citations,
      cached,
      conversation: {
        id: String(conv._id),
        title: conv.title,
        tickerFilter: conv.tickerFilter ?? "",
        yearFilter: conv.yearFilter,
        updatedAt: conv.updatedAt,
      },
    });
  });
}
