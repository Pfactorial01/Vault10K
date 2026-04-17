import { Fragment, useMemo, type ReactNode } from "react";

/** Renders **bold** spans in plain text. */
function formatInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return <strong key={i}>{m[1]}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Props = {
  content: string;
  className?: string;
};

/**
 * Splits assistant-style answers into blocks on blank lines, preserves line breaks within blocks.
 */
export function MessageBody({ content, className }: Props) {
  const blocks = useMemo(() => {
    return content.split(/\n\n+/).filter((b) => b.length > 0);
  }, [content]);

  return (
    <div className={className ?? "chat-msg-body"}>
      {blocks.map((block, bi) => (
        <p key={bi} className="chat-msg-para">
          {block.split("\n").map((line, li) => (
            <Fragment key={li}>
              {li > 0 && <br />}
              {formatInline(line)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
