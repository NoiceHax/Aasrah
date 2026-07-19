"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/ui/icon";
import { searchApi } from "@/lib/api/admin";
import { cn } from "@/lib/utils";

const kindIcon: Record<string, string> = {
  report: "description",
  ngo: "corporate_fare",
  volunteer: "person",
  user: "account_circle",
};

/** Debounced global search with a results dropdown. */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounce the query value.
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(term.trim()), 300);
    return () => window.clearTimeout(t);
  }, [term]);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: hits, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => searchApi.query(debounced),
    enabled: debounced.length >= 2,
  });

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
        />
        <input
          type="search"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search reports, NGOs, people…"
          aria-label="Global search"
          className="w-full rounded-md border border-outline-variant bg-surface-container-low py-2 pl-10 pr-3 text-body-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
        />
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-outline-variant bg-surface-container-lowest shadow-raised">
          {isFetching && <p className="px-3 py-2 text-label-sm text-on-surface-variant">Searching…</p>}
          {!isFetching && (hits?.length ?? 0) === 0 && (
            <p className="px-3 py-2 text-label-sm text-on-surface-variant">No results.</p>
          )}
          {hits?.map((h) => (
            <button
              key={`${h.kind}-${h.id}`}
              type="button"
              onClick={() => {
                setOpen(false);
                setTerm("");
                if (h.href) router.push(h.href);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-container-low"
            >
              <Icon name={kindIcon[h.kind] ?? "search"} className="text-[20px] text-secondary" />
              <span className="flex-1 overflow-hidden">
                <span className="block truncate text-label-md text-primary">{h.label}</span>
                {h.sublabel && (
                  <span className="block truncate text-label-sm text-on-surface-variant">{h.sublabel}</span>
                )}
              </span>
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] uppercase text-on-surface-variant">
                {h.kind}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
