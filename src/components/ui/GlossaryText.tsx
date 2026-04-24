"use client";

/**
 * Inline glossary tooltip wrapper. Phase 2d of the PartnerOS roadmap.
 *
 * Wraps a string in a <span> that auto-annotates any occurrence of a
 * TrainingGlossary term (or alias) with a native <abbr title="…"> tooltip.
 * Native <abbr> gives a free accessible tooltip on desktop hover + iOS
 * long-press + keyboard focus without pulling in a popover library.
 *
 * Glossary is fetched once per tab and cached in-module. The fetch is
 * fire-and-forget; until it returns, text renders unannotated so nothing
 * flashes.
 */
import { useEffect, useState, useMemo } from "react";

interface GlossaryEntry {
  id: string;
  term: string;
  aliases: string[];
  definition: string;
  category: string | null;
}

let _cache: GlossaryEntry[] | null = null;
let _cachePromise: Promise<GlossaryEntry[]> | null = null;

async function fetchGlossary(): Promise<GlossaryEntry[]> {
  if (_cache) return _cache;
  if (_cachePromise) return _cachePromise;
  _cachePromise = fetch("/api/training/glossary")
    .then((r) => (r.ok ? r.json() : { entries: [] }))
    .then((d) => {
      _cache = (d.entries as GlossaryEntry[] | undefined) ?? [];
      return _cache;
    })
    .catch(() => {
      _cache = [];
      return _cache;
    });
  return _cachePromise;
}

function buildMatcher(entries: GlossaryEntry[]): {
  regex: RegExp | null;
  lookup: Map<string, GlossaryEntry>;
} {
  const lookup = new Map<string, GlossaryEntry>();
  const allTerms: string[] = [];
  for (const e of entries) {
    if (e.term) {
      lookup.set(e.term.toLowerCase(), e);
      allTerms.push(e.term);
    }
    for (const a of e.aliases ?? []) {
      if (!a) continue;
      lookup.set(a.toLowerCase(), e);
      allTerms.push(a);
    }
  }
  if (allTerms.length === 0) return { regex: null, lookup };
  // Longest-first so "Closed Won" wins over "Closed".
  allTerms.sort((a, b) => b.length - a.length);
  const escaped = allTerms.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");
  return { regex, lookup };
}

export default function GlossaryText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [entries, setEntries] = useState<GlossaryEntry[] | null>(_cache);

  useEffect(() => {
    if (!entries) {
      fetchGlossary().then((e) => setEntries(e));
    }
  }, [entries]);

  const rendered = useMemo(() => {
    if (!text) return null;
    if (!entries || entries.length === 0) return text;
    const { regex, lookup } = buildMatcher(entries);
    if (!regex) return text;

    const parts: (string | JSX.Element)[] = [];
    let lastIdx = 0;
    // exec-in-loop (rather than matchAll) keeps us compatible with the
    // project's current TS target without touching tsconfig.
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const startIdx = m.index;
      const matched = m[0];
      if (!matched) {
        // zero-width match guard against infinite loops
        regex.lastIndex += 1;
        continue;
      }
      if (startIdx > lastIdx) parts.push(text.slice(lastIdx, startIdx));
      const entry = lookup.get(matched.toLowerCase());
      if (entry) {
        parts.push(
          <abbr
            key={`${startIdx}-${matched}`}
            title={entry.definition}
            className="border-b border-dotted border-brand-gold/60 cursor-help no-underline"
          >
            {matched}
          </abbr>
        );
      } else {
        parts.push(matched);
      }
      lastIdx = startIdx + matched.length;
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
    return parts;
  }, [text, entries]);

  return <span className={className}>{rendered}</span>;
}
