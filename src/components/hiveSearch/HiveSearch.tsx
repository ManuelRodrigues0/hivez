/**
 * Reusable smart Hive search (sidebar + Create Report discovery).
 *
 * Deterministic-first: exact/partial name, alias and keyword matches resolve
 * instantly with no OmniRoute usage. Only weak/ambiguous queries trigger the
 * server-side semantic fallback (which itself is capped, cached and debounced).
 * The UI only ever shows Hivez-level results — never provider/model internals.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { buildHiveRegistry, intelSearchHives, type HiveRegistryEntry } from "@/services/omnirouteIntel";
import { hiveStatusLabel } from "@/services/hives";

interface HiveSearchProps {
  onSelect: (hiveId: string, hive: HiveRegistryEntry) => void;
  onCreateNewIssue?: () => void;
  placeholder?: string;
  maxResults?: number;
  autoFocus?: boolean;
}

interface RankedResult {
  hive: HiveRegistryEntry;
  score: number;
  reason: string;
  matchType: string;
}

const MIN_QUERY_LENGTH = 2;

/** Lightweight deterministic scorer over hive metadata (never calls AI). */
function scoreHive(queryTokens: string[], hive: HiveRegistryEntry): number {
  const name = hive.name.toLowerCase();
  const aliases = (hive.aliases ?? []).map((alias) => alias.toLowerCase());
  const keywords = (hive.keywords ?? []).map((keyword) => keyword.toLowerCase());
  const fullText = [name, ...aliases, ...keywords].join(" | ");
  let best = 0;
  for (const token of queryTokens) {
    if (!token) continue;
    if (name === token) best = Math.max(best, 1.0);
    else if (name.startsWith(token)) best = Math.max(best, 0.92);
    else if (aliases.some((alias) => alias === token)) best = Math.max(best, 0.95);
    else if (aliases.some((alias) => alias.startsWith(token))) best = Math.max(best, 0.85);
    else if (keywords.some((keyword) => keyword.includes(token))) best = Math.max(best, 0.8);
    else if (name.includes(token)) best = Math.max(best, 0.75);
    else if (fullText.includes(token)) best = Math.max(best, 0.6);
  }
  return best;
}

function deterministicResults(query: string, registry: HiveRegistryEntry[], maxResults: number): RankedResult[] {
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return [];
  return registry
    .map((hive) => {
      const combined = `${hive.name} ${(hive.aliases ?? []).join(" ")} ${(hive.keywords ?? []).join(" ")}`.toLowerCase();
      const score = scoreHive(tokens, hive);
      const reason = combined.includes(tokens.join(" ")) || hive.name.toLowerCase().includes(tokens.join(" "))
        ? "Matches this hive"
        : "Related to your search";
      return { hive, score, reason, matchType: score >= 0.82 ? "existing_hive" : score >= 0.4 ? "related_hive" : "semantic_hive" };
    })
    .filter((entry) => entry.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}
export default function HiveSearch({ onSelect, onCreateNewIssue, placeholder = "Search Hives...", maxResults = 6, autoFocus = false }: HiveSearchProps) {
  const [query, setQuery] = useState("");
  const [registry, setRegistry] = useState<HiveRegistryEntry[]>([]);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [semanticMatches, setSemanticMatches] = useState<RankedResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [semanticUsed, setSemanticUsed] = useState(false);
  const [semanticError, setSemanticError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildHiveRegistry().then((entries) => {
      if (!cancelled) {
        setRegistry(entries);
        setRegistryLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const trimmed = query.trim();
  const local = useMemo(() => (trimmed.length >= MIN_QUERY_LENGTH ? deterministicResults(trimmed, registry, maxResults) : []), [trimmed, registry, maxResults]);
  const strongMatch = local.length > 0 && local[0].score >= 0.82;

  // Semantic fallback: only for non-empty weak queries, debounced + cancellable.
  // All state updates happen inside callbacks/timeouts, never synchronously.
  useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    abortRef.current?.abort();
    const queryAtDispatch = trimmed;
    const strongAtDispatch = strongMatch;
    timerRef.current = window.setTimeout(() => {
      if (queryAtDispatch.length < MIN_QUERY_LENGTH || strongAtDispatch) {
        setSemanticMatches([]);
        setSearching(false);
        setSemanticUsed(false);
        setSemanticError(false);
        return;
      }
      setSearching(true);
      setSemanticUsed(false);
      setSemanticError(false);
      const controller = new AbortController();
      abortRef.current = controller;
      intelSearchHives(queryAtDispatch, registry, controller.signal).then((result) => {
        if (controller.signal.aborted || abortRef.current !== controller) return;
        abortRef.current = null;
        setSearching(false);
        if (!result) {
          setSemanticError(true);
          return;
        }
        const byId = new Map(registry.map((hive) => [hive.id, hive]));
        const ranked: RankedResult[] = [];
        result.matches.forEach((match) => {
          const hive = byId.get(match.hiveId);
          if (!hive) return;
          ranked.push({ hive, score: match.confidence, reason: match.reason, matchType: match.matchType });
        });
        setSemanticMatches(ranked.slice(0, maxResults));
        setSemanticUsed(true);
      });
    }, 300);
  }, [trimmed, strongMatch, registry, maxResults]);

  const results: RankedResult[] = trimmed.length < MIN_QUERY_LENGTH ? [] : local.length > 0 ? local : semanticMatches;
  const showSemanticNote = semanticUsed && results.length > 0 && local.length === 0;

  return (
    <div>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-8 text-sm text-foreground outline-none transition focus:border-primary/50"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        ) : null}
      </div>

      {trimmed.length < MIN_QUERY_LENGTH ? (
        <div className="mt-2">
          {registryLoading ? (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
              <Loader2 size={13} className="animate-spin" />
              Loading Hives...
            </div>
          ) : (
            <>
              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Suggested Hives</p>
              {registry.slice(0, 4).map((hive) => (
                <button
                  key={hive.id}
                  type="button"
                  onClick={() => onSelect(hive.id, hive)}
                  className="flex w-full items-center rounded-lg px-2 py-2 text-left text-sm font-medium transition hover:bg-muted"
                >
                  {hive.name}
                  {hiveStatusLabel(hive.status) ? <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{hiveStatusLabel(hive.status)}</span> : null}
                </button>
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="mt-2">
          {searching && results.length === 0 ? (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
              <Loader2 size={13} className="animate-spin" />
              Searching...
            </div>
          ) : null}

          {results.map((result) => {
            const status = hiveStatusLabel(result.hive.status);
            return (
              <button
                key={result.hive.id}
                type="button"
                onClick={() => onSelect(result.hive.id, result.hive)}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                    {result.hive.name}
                    {status ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{status}</span> : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{result.reason}</span>
                </span>
              </button>
            );
          })}

          {showSemanticNote ? <p className="px-2 pt-1 text-[11px] text-muted-foreground">Suggested by understanding your description.</p> : null}

          {!searching && trimmed.length >= MIN_QUERY_LENGTH && results.length === 0 ? (
            <div className="px-2 py-2">
              <p className="text-xs text-muted-foreground">{semanticError ? "Hive search is temporarily unavailable." : "No suitable Hive found."}</p>
              {onCreateNewIssue ? (
                <button type="button" onClick={onCreateNewIssue} className="mt-2 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90">
                  Create New Issue
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}