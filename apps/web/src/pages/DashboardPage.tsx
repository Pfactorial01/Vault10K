import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { MessageBody } from "../components/MessageBody";
import { TickerSearchInput } from "../components/TickerSearchInput";

const apiBase = import.meta.env.VITE_API_URL ?? "";

type FilingRow = {
  id: string;
  ticker: string;
  companyName: string;
  reportDate: string;
  filingDate: string;
  accession: string;
};

type Citation = {
  chunkId: string;
  ticker: string;
  year: number;
  section: string;
  excerpt: string;
  charStart: number;
  charEnd: number;
};

type ChatListItem = {
  id: string;
  title: string;
  tickerFilter?: string;
  yearFilter?: number;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt: string;
};

type ChatDetail = {
  id: string;
  title: string;
  tickerFilter?: string;
  yearFilter?: number;
  messages: ChatMessage[];
};

export default function DashboardPage() {
  const [filings, setFilings] = useState<FilingRow[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [listErr, setListErr] = useState<string | null>(null);
  const [htmlErr, setHtmlErr] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatsLoaded, setChatsLoaded] = useState(false);

  const [query, setQuery] = useState("");
  const [tickerFilter, setTickerFilter] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const readerCloseRef = useRef<HTMLButtonElement>(null);
  const chatsCloseRef = useRef<HTMLButtonElement>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [chatsPanelOpen, setChatsPanelOpen] = useState(false);

  useEffect(() => {
    api<{ filings: FilingRow[] }>("/api/filings")
      .then((r) => setFilings(r.filings))
      .catch((e: Error) => setListErr(e.message))
      .finally(() => setListLoaded(true));
  }, []);

  useEffect(() => {
    if (!selected) {
      setHtmlErr(null);
      setIframeLoaded(false);
      return;
    }
    setHtmlErr(null);
    setIframeLoaded(false);
  }, [selected]);

  const loadChats = useCallback(async () => {
    const r = await api<{ chats: ChatListItem[] }>("/api/chats");
    setChats(r.chats);
    return r.chats;
  }, []);

  const fetchChatDetail = useCallback(async (chatId: string) => {
    const d = await api<ChatDetail>(`/api/chats/${chatId}`);
    setMessages(d.messages);
    setTickerFilter(d.tickerFilter ?? "");
    setYearFilter(
      d.yearFilter !== undefined && d.yearFilter !== null
        ? String(d.yearFilter)
        : ""
    );
    return d;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        let list = await loadChats();
        if (list.length === 0) {
          const created = await api<ChatListItem>("/api/chats", {
            method: "POST",
            body: JSON.stringify({}),
          });
          list = await loadChats();
          setActiveChatId(created.id);
        } else {
          setActiveChatId((id) => id ?? list[0]?.id ?? null);
        }
      } catch {
        /* ignore */
      } finally {
        setChatsLoaded(true);
      }
    })();
  }, [loadChats]);

  useEffect(() => {
    if (!activeChatId || !chatsLoaded) return;
    setChatLoading(true);
    setSendErr(null);
    fetchChatDetail(activeChatId)
      .catch((e: Error) => setSendErr(e.message))
      .finally(() => setChatLoading(false));
  }, [activeChatId, chatsLoaded, fetchChatDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!readerOpen && !chatsPanelOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [readerOpen, chatsPanelOpen]);

  useEffect(() => {
    if (chatsPanelOpen) chatsCloseRef.current?.focus();
  }, [chatsPanelOpen]);

  useEffect(() => {
    if (readerOpen) readerCloseRef.current?.focus();
  }, [readerOpen]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (readerOpen) setReaderOpen(false);
      else if (chatsPanelOpen) setChatsPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatsPanelOpen, readerOpen]);

  const selectedFiling = useMemo(
    () => filings.find((f) => f.id === selected),
    [filings, selected]
  );

  const htmlSrc =
    selected.length > 0 ? `${apiBase}/api/filings/${selected}/html` : undefined;

  const activeChatTitle = useMemo(
    () => chats.find((c) => c.id === activeChatId)?.title ?? "Chat",
    [chats, activeChatId]
  );

  const persistFilters = useCallback(
    async (chatId: string, ticker: string, year: string) => {
      const y = year.trim();
      const yearNum = y ? parseInt(y, 10) : null;
      await api(`/api/chats/${chatId}`, {
        method: "PATCH",
        body: JSON.stringify({
          tickerFilter: ticker.trim(),
          year: Number.isFinite(yearNum) ? yearNum : null,
        }),
      });
      void loadChats();
    },
    [loadChats]
  );

  const onNewChat = useCallback(async () => {
    setSendErr(null);
    const c = await api<ChatListItem>("/api/chats", {
      method: "POST",
      body: JSON.stringify({}),
    });
    await loadChats();
    setActiveChatId(c.id);
    setMessages([]);
    setQuery("");
    setChatsPanelOpen(false);
  }, [loadChats]);

  const onSend = useCallback(async () => {
    const text = query.trim();
    if (!text || !activeChatId || filings.length === 0) return;
    setSending(true);
    setSendErr(null);
    try {
      await persistFilters(activeChatId, tickerFilter, yearFilter);
      await api<{
        answer: string;
        citations: Citation[];
        conversation: { id: string; title: string; updatedAt: string };
      }>(`/api/chats/${activeChatId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });
      setQuery("");
      await fetchChatDetail(activeChatId);
      void loadChats();
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [
    query,
    activeChatId,
    filings.length,
    tickerFilter,
    yearFilter,
    persistFilters,
    loadChats,
    fetchChatDetail,
  ]);

  const onQuestionKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      void onSend();
    },
    [onSend]
  );

  const copyExcerpt = useCallback((text: string) => {
    void navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  const showIframe = listLoaded && filings.length > 0 && selected.length > 0;

  const deleteChat = useCallback(
    async (id: string) => {
      if (!confirm("Delete this chat?")) return;
      await api(`/api/chats/${id}`, { method: "DELETE" });
      const list = await loadChats();
      if (activeChatId === id) {
        setActiveChatId(list[0]?.id ?? null);
        if (list.length === 0) {
          const c = await api<ChatListItem>("/api/chats", {
            method: "POST",
            body: JSON.stringify({}),
          });
          await loadChats();
          setActiveChatId(c.id);
        }
      }
    },
    [activeChatId, loadChats]
  );

  return (
    <div className="dash dash--chat-first">
      <header className="dash-hero dash-hero--compact">
        <h1 className="dash-title">Chat</h1>
        <p className="dash-lead">
          Ask questions over your indexed 10-K chunks. Open the document viewer
          on the right when you want to read the filing HTML. Each thread keeps
          its own filters and history.
        </p>
      </header>

      {listErr && (
        <div className="dash-alert dash-alert--error" role="alert">
          {listErr}
        </div>
      )}

      <div className="dash-workspace dash-workspace--chat-main">
        <section className="dash-chat-shell dash-chat-shell--full" aria-label="Chat">
          <div className="chat-main chat-main--solo">
            <div className="chat-main-head chat-main-head--row chat-main-head--bar">
              <div className="chat-main-head-text">
                <button
                  type="button"
                  className="chat-chats-trigger"
                  onClick={() => setChatsPanelOpen(true)}
                  aria-expanded={chatsPanelOpen}
                  aria-controls="chats-popover-panel"
                >
                  <span className="chat-chats-trigger-icon" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                  </span>
                  Chats
                </button>
                <h2 className="chat-session-title">{activeChatTitle}</h2>
                <p className="chat-main-desc">
                  Retrieval filters below apply to this thread.
                </p>
              </div>
              <div className="chat-main-actions">
                <button
                  type="button"
                  className="chat-doc-toggle"
                  onClick={() => setReaderOpen(true)}
                  disabled={!listLoaded || filings.length === 0}
                  title={
                    filings.length === 0
                      ? "Ingest a filing first"
                      : "Open 10-K document viewer"
                  }
                >
                  <span className="chat-doc-toggle-icon" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </span>
                  10-K document
                </button>
              </div>
            </div>

            <div className="chat-thread">
              {chatLoading && (
                <p className="muted chat-thread-loading">Loading messages…</p>
              )}
              {!chatLoading &&
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "user"
                        ? "chat-turn chat-turn--user"
                        : "chat-turn chat-turn--assistant"
                    }
                  >
                    <div
                      className={
                        m.role === "user"
                          ? "chat-bubble chat-bubble--user"
                          : "chat-bubble chat-bubble--assistant"
                      }
                    >
                      <div className="chat-bubble-role">
                        {m.role === "user" ? "You" : "Assistant"}
                      </div>
                      {m.role === "user" ? (
                        <MessageBody
                          content={m.content}
                          className="chat-msg-body chat-msg-body--user"
                        />
                      ) : (
                        <MessageBody
                          content={m.content}
                          className="chat-msg-body chat-msg-body--assistant"
                        />
                      )}
                      {m.role === "assistant" && m.citations.length > 0 && (
                        <div className="chat-cites-block">
                          <div className="chat-cites-header">
                            <span className="chat-cites-icon" aria-hidden>
                              ◆
                            </span>
                            <span>Sources</span>
                            <span className="chat-cites-count">
                              {m.citations.length}
                            </span>
                          </div>
                          <ul
                            className="cite-cards"
                            role="list"
                            aria-label="Source excerpts"
                          >
                            {m.citations.map((c, idx) => (
                              <li key={c.chunkId} className="cite-card">
                                <div className="cite-card-head">
                                  <span className="cite-card-num">
                                    {idx + 1}
                                  </span>
                                  <div className="cite-card-meta">
                                    <span className="cite-card-ticker">
                                      {c.ticker}
                                    </span>
                                    <span className="cite-card-year">
                                      {c.year}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    className="cite-card-copy"
                                    title="Copy excerpt"
                                    onClick={() => copyExcerpt(c.excerpt)}
                                  >
                                    Copy
                                  </button>
                                </div>
                                <div className="cite-card-section" title={c.section}>
                                  {c.section}
                                </div>
                                <p className="cite-card-excerpt">{c.excerpt}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-composer">
              <div className="dash-filters chat-composer-filters">
                <div className="dash-field">
                  <label className="dash-label" htmlFor="ticker-filter">
                    Ticker filter
                  </label>
                  <TickerSearchInput
                    id="ticker-filter"
                    value={tickerFilter}
                    onChange={setTickerFilter}
                    placeholder="Any"
                    disabled={filings.length === 0}
                  />
                </div>
                <div className="dash-field dash-field--narrow">
                  <label className="dash-label" htmlFor="year-filter">
                    Year
                  </label>
                  <input
                    id="year-filter"
                    className="dash-input"
                    placeholder="e.g. 2024"
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    inputMode="numeric"
                    disabled={filings.length === 0}
                  />
                </div>
              </div>
              <label className="dash-label" htmlFor="chat-input">
                Message
              </label>
              <textarea
                id="chat-input"
                className="dash-textarea chat-composer-input"
                rows={3}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onQuestionKeyDown}
                placeholder="Ask about your filings…"
                disabled={filings.length === 0 || !activeChatId}
              />
              <p className="dash-hint chat-composer-hint">
                <kbd className="dash-kbd">Enter</kbd>
                <span className="dash-hint-text">to send</span>
                <span className="dash-hint-dot" aria-hidden>
                  ·
                </span>
                <kbd className="dash-kbd">Shift</kbd>
                <span className="dash-hint-plus">+</span>
                <kbd className="dash-kbd">Enter</kbd>
                <span className="dash-hint-text">new line</span>
              </p>
              <button
                type="button"
                className="dash-btn dash-btn--primary chat-composer-send"
                disabled={
                  sending ||
                  filings.length === 0 ||
                  !query.trim() ||
                  !activeChatId
                }
                onClick={() => void onSend()}
              >
                {sending ? (
                  <>
                    <span className="dash-spinner dash-spinner--inline" />
                    Sending…
                  </>
                ) : (
                  "Send"
                )}
              </button>
              {filings.length === 0 && listLoaded && (
                <p className="dash-inline-hint">
                  Ingest filings to enable chat.
                </p>
              )}
              {sendErr && (
                <div className="dash-alert dash-alert--error">{sendErr}</div>
              )}
            </div>
          </div>
        </section>
      </div>

      {chatsPanelOpen && (
        <>
          <div
            className="chats-overlay"
            aria-hidden
            onClick={() => setChatsPanelOpen(false)}
          />
          <aside
            id="chats-popover-panel"
            className="chats-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chats-popover-title"
          >
            <div className="chats-popover-top">
              <h2 id="chats-popover-title" className="chats-popover-h">
                Chats
              </h2>
              <button
                ref={chatsCloseRef}
                type="button"
                className="chats-popover-close"
                aria-label="Close chat list"
                onClick={() => setChatsPanelOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="chats-popover-actions">
              <button
                type="button"
                className="chats-popover-new"
                onClick={() => void onNewChat()}
              >
                + New chat
              </button>
            </div>
            <ul className="chats-popover-list" role="list">
              {chats.map((c) => (
                <li key={c.id} className="chats-popover-row">
                  <button
                    type="button"
                    className={
                      c.id === activeChatId
                        ? "chats-popover-item chats-popover-item--active"
                        : "chats-popover-item"
                    }
                    onClick={() => {
                      setActiveChatId(c.id);
                      setChatsPanelOpen(false);
                    }}
                    title={c.id}
                  >
                    <span className="chats-popover-title">{c.title}</span>
                    <span className="chats-popover-id" aria-hidden>
                      {c.id.slice(-8)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="chats-popover-del"
                    aria-label="Delete chat"
                    onClick={() => void deleteChat(c.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </>
      )}

      {readerOpen && (
        <>
          <div
            className="reader-overlay"
            aria-hidden
            onClick={() => setReaderOpen(false)}
          />
          <aside
            className="reader-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reader-popover-title"
          >
            <div className="reader-popover-top">
              <div className="reader-popover-titles">
                <h2 id="reader-popover-title" className="reader-popover-h">
                  10-K document
                </h2>
                <p className="reader-popover-sub">
                  HTML filing · scroll inside the frame
                </p>
              </div>
              <button
                ref={readerCloseRef}
                type="button"
                className="reader-popover-close"
                aria-label="Close document viewer"
                onClick={() => setReaderOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="reader-popover-body">
              {!listLoaded && (
                <div className="dash-placeholder">
                  <div className="dash-skeleton dash-skeleton--line" />
                  <div className="dash-skeleton dash-skeleton--line short" />
                </div>
              )}

              {listLoaded && filings.length === 0 && !listErr && (
                <div className="dash-empty reader-popover-empty">
                  <div className="dash-empty-icon" aria-hidden>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                  </div>
                  <h3 className="dash-empty-title">No filings yet</h3>
                  <p className="dash-empty-text">
                    Ingest a 10-K from the ingestion flow. When processing
                    completes, it will show up here.
                  </p>
                  <Link className="dash-btn dash-btn--primary" to="/ingest">
                    Go to ingestion
                  </Link>
                </div>
              )}

              {listLoaded && filings.length > 0 && (
                <>
                  <div className="dash-toolbar">
                    <label className="dash-label" htmlFor="filing-select-pop">
                      Filing
                    </label>
                    <select
                      id="filing-select-pop"
                      className="dash-select"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                      aria-label="Choose filing to view"
                    >
                      <option value="">Select a filing…</option>
                      {filings.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.ticker} · FY report {f.reportDate} · {f.companyName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!selected && (
                    <div className="dash-pick-hint">
                      <p className="dash-pick-hint-text">
                        Choose a filing to load its HTML.
                      </p>
                    </div>
                  )}

                  {selected && selectedFiling && (
                    <div className="dash-meta-bar">
                      <div className="dash-badges">
                        <span className="dash-badge">{selectedFiling.ticker}</span>
                        <span className="dash-badge dash-badge--muted">
                          Report {selectedFiling.reportDate}
                        </span>
                      </div>
                      <h3 className="dash-meta-title">{selectedFiling.companyName}</h3>
                      <p className="dash-meta-sub">
                        Filed {selectedFiling.filingDate} · {selectedFiling.accession}
                      </p>
                    </div>
                  )}

                  <div className="dash-reader-frame">
                    {htmlErr && (
                      <div className="dash-alert dash-alert--error">{htmlErr}</div>
                    )}
                    {showIframe && (
                      <div className="dash-iframe-wrap">
                        {!iframeLoaded && !htmlErr && (
                          <div className="dash-iframe-loading" aria-busy="true">
                            <div className="dash-spinner" />
                            <span>Loading HTML…</span>
                          </div>
                        )}
                        <iframe
                          key={selected}
                          className={`dash-iframe${iframeLoaded ? " dash-iframe--ready" : ""}`}
                          title={
                            selectedFiling
                              ? `10-K · ${selectedFiling.ticker} · ${selectedFiling.reportDate}`
                              : "Filing HTML"
                          }
                          src={htmlSrc}
                          sandbox="allow-same-origin allow-scripts allow-popups allow-downloads"
                          referrerPolicy="no-referrer-when-downgrade"
                          onLoad={() => setIframeLoaded(true)}
                          onError={() => {
                            setHtmlErr("Could not load filing HTML.");
                            setIframeLoaded(true);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
