import { DEFAULT_EXPECTATIONS_MARKDOWN } from "@/lib/getting-started";

interface Props {
  markdown?: string;
}

export function PartnerExpectations({ markdown }: Props) {
  const source = (markdown && markdown.trim()) || DEFAULT_EXPECTATIONS_MARKDOWN;
  return (
    <div className="card p-6 sm:p-8">
      <div className="prose-fintella max-w-none">
        {renderMarkdown(source)}
      </div>
    </div>
  );
}

/**
 * Intentionally tiny markdown renderer — we ship no heavy md dependency on
 * the partner bundle. Supports `## heading`, `- bullet`, `**bold**`, and
 * paragraph breaks, which is everything the default copy uses.
 */
function renderMarkdown(src: string): React.ReactNode {
  const blocks = src.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={i} className="font-display text-lg sm:text-xl font-semibold text-[var(--app-text)] mb-3">
          {renderInline(trimmed.slice(3))}
        </h2>
      );
    }
    if (trimmed.startsWith("- ")) {
      const items = trimmed.split(/\n- /).map((line, idx) => (idx === 0 ? line.replace(/^- /, "") : line));
      return (
        <ul key={i} className="list-disc pl-5 space-y-1.5 mb-4 text-[var(--app-text-secondary)] text-[13px] sm:text-[14px] leading-relaxed">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="font-body text-[13px] sm:text-[14px] text-[var(--app-text-secondary)] leading-relaxed mb-3">
        {renderInline(trimmed)}
      </p>
    );
  });
}

function renderInline(src: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src)) !== null) {
    if (match.index > lastIndex) parts.push(src.slice(lastIndex, match.index));
    parts.push(<strong key={match.index} className="font-semibold text-[var(--app-text)]">{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < src.length) parts.push(src.slice(lastIndex));
  return parts;
}
