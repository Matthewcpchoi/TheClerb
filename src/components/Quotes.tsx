"use client";

import { useState } from "react";
import { Camera } from "@phosphor-icons/react";
import { BookQuote } from "@/types";
import { DeleteButton, Kicker, Num, OutlineButton, SolidButton } from "./ui";
import QuoteCapture from "./QuoteCapture";
import { cn } from "@/lib/utils";

/** Lines worth keeping — typed, or photographed and read off the page. */
export default function Quotes({
  quotes,
  memberId,
  onAdd,
  onDelete,
}: {
  quotes: BookQuote[];
  memberId: string | null;
  onAdd: (content: string, page: string) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState("");
  const [adding, setAdding] = useState(false);
  const [capturing, setCapturing] = useState(false);

  return (
    <div>
      <Kicker>Favourite Lines</Kicker>

      {quotes.length === 0 && !adding && (
        <p className="py-4 text-[12.5px] text-muted">Nothing marked yet.</p>
      )}

      {quotes.map((q, i) => (
        <div
          key={q.id}
          className={cn("flex items-start gap-2 py-[14px]", i < quotes.length - 1 && "row-line")}
        >
          <div className="min-w-0 flex-1 border-l-2 border-green pl-[14px]">
            <p className="text-[14px] italic leading-[1.55] text-ink">&ldquo;{q.content}&rdquo;</p>
            <p className="mt-[6px] text-[11.5px] text-muted">
              {q.page && (
                <>
                  <Num>p.{q.page}</Num>
                  {" · "}
                </>
              )}
              {q.member?.name || "Anonymous"}
            </p>
          </div>
          {memberId === q.member_id && (
            <DeleteButton onDelete={() => onDelete(q.id)} label="Delete this quote" />
          )}
        </div>
      ))}

      {memberId &&
        (!adding ? (
          <div className="mt-3 flex gap-2">
            <OutlineButton
              className="flex flex-1 items-center justify-center gap-2"
              onClick={() => setCapturing(true)}
            >
              <Camera size={15} />
              Photograph A Line
            </OutlineButton>
            <OutlineButton onClick={() => setAdding(true)}>Type It</OutlineButton>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              placeholder="The line that stopped you"
              className="w-full resize-none rounded-lg border border-tan bg-transparent px-3 py-2 text-[14px] italic leading-relaxed text-ink outline-none placeholder:not-italic placeholder:text-muted/60 focus:border-green"
            />
            <input
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="Page"
              inputMode="numeric"
              className="num w-[110px] rounded-lg border border-tan bg-transparent px-3 py-2 text-[13px] text-ink outline-none placeholder:text-muted/60 focus:border-green"
            />
            <div className="flex gap-2">
              <OutlineButton
                className="flex-1"
                onClick={() => {
                  setAdding(false);
                  setDraft("");
                  setPage("");
                }}
              >
                Cancel
              </OutlineButton>
              <SolidButton
                className="flex-1"
                disabled={!draft.trim()}
                onClick={() => {
                  onAdd(draft.trim(), page.trim());
                  setDraft("");
                  setPage("");
                  setAdding(false);
                }}
              >
                Add
              </SolidButton>
            </div>
          </div>
        ))}

      {capturing && (
        <QuoteCapture onSave={(c, p) => onAdd(c, p)} onClose={() => setCapturing(false)} />
      )}
    </div>
  );
}
