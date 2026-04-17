import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

type Ticker = { ticker: string; title: string };

export function TickerSearchInput({
  id,
  value,
  onChange,
  placeholder,
  required,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Ticker[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = value.trim();
  const isCik = /^\d+$/.test(trimmed);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isCik || trimmed.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      void api<{ tickers: Ticker[] }>(
        `/api/tickers?q=${encodeURIComponent(trimmed)}&limit=30`
      )
        .then((r) => {
          setItems(r.tickers);
          setActiveIdx(-1);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, isCik]);

  const onPick = useCallback(
    (t: string) => {
      onChange(t);
      setOpen(false);
      setItems([]);
    },
    [onChange]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      onPick(items[activeIdx].ticker);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList =
    open && !isCik && trimmed.length > 0 && (loading || items.length > 0);
  const showNoResults =
    open &&
    !isCik &&
    trimmed.length > 0 &&
    !loading &&
    items.length === 0;

  return (
    <div className="combobox" ref={wrapRef}>
      <input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => !disabled && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {isCik && trimmed.length > 0 && (
        <p className="combobox-hint muted">
          Numeric CIK — submit without picking from the list.
        </p>
      )}
      {loading && trimmed.length > 0 && !isCik && (
        <div className="combobox-dropdown muted">Searching SEC ticker list…</div>
      )}
      {showNoResults && (
        <div className="combobox-dropdown empty">
          No matching tickers — check spelling or use CIK.
        </div>
      )}
      {showList && items.length > 0 && (
        <ul className="combobox-dropdown" role="listbox">
          {items.map((it, idx) => (
            <li
              key={it.ticker}
              role="option"
              aria-selected={idx === activeIdx}
              className={idx === activeIdx ? "active" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(it.ticker);
              }}
            >
              <span className="combobox-ticker">{it.ticker}</span>
              <span className="combobox-title">{it.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
