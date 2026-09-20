"use client";

import { useState, useEffect } from "react";
import { DiscussionTopic } from "@/types";
import { DeleteButton, Kicker, OutlineButton, SolidButton } from "./ui";
import { cn } from "@/lib/utils";

/** Questions for the meeting. Blurred until tapped, so nobody is spoiled. */
export default function DiscussionTopics({
  topics,
  bookId,
  memberId,
  onAddTopic,
  onDelete,
}: {
  topics: DiscussionTopic[];
  bookId: string;
  memberId: string | null;
  onAddTopic: (content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => setOpen(new Set()), [bookId]);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <Kicker>Discussion questions</Kicker>

      {topics.length === 0 && !adding && (
        <p className="py-4 text-[12.5px] text-muted">Nothing queued yet.</p>
      )}

      {topics.map((t, i) => (
        <div
          key={t.id}
          className={cn("flex items-start gap-2 py-[13px]", i < topics.length - 1 && "row-line")}
        >
          <button onClick={() => toggle(t.id)} className="min-w-0 flex-1 text-left">
            <span className="text-[11.5px] text-muted">{t.member?.name || "Anonymous"}</span>
            <p
              className="mt-[5px] text-[13.5px] leading-[1.5] text-ink transition-[filter] duration-300"
              style={{ filter: open.has(t.id) ? "blur(0)" : "blur(4.5px)" }}
            >
              {t.content}
            </p>
          </button>
          {memberId === t.member_id && (
            <DeleteButton onDelete={() => onDelete(t.id)} label="Delete this question" />
          )}
        </div>
      ))}

      {memberId &&
        (!adding ? (
          <OutlineButton className="mt-3" onClick={() => setAdding(true)}>
            Add a question
          </OutlineButton>
        ) : (
          <div className="mt-3 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              placeholder="What do you want to talk about?"
              className="w-full resize-none rounded-lg border border-tan bg-transparent px-3 py-2 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-muted/60 focus:border-green"
            />
            <div className="flex gap-2">
              <OutlineButton
                className="flex-1"
                onClick={() => {
                  setAdding(false);
                  setDraft("");
                }}
              >
                Cancel
              </OutlineButton>
              <SolidButton
                className="flex-1"
                disabled={!draft.trim()}
                onClick={() => {
                  onAddTopic(draft.trim());
                  setDraft("");
                  setAdding(false);
                }}
              >
                Add
              </SolidButton>
            </div>
          </div>
        ))}
    </div>
  );
}
