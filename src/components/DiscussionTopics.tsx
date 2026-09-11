"use client";

import { useState, useEffect } from "react";
import { DiscussionTopic } from "@/types";
import { Avatar, Button, textareaClass } from "./ui";

interface DiscussionTopicsProps {
  topics: DiscussionTopic[];
  bookId: string;
  memberId: string | null;
  onAddTopic: (content: string) => void;
}

export default function DiscussionTopics({
  topics,
  bookId,
  memberId,
  onAddTopic,
}: DiscussionTopicsProps) {
  const [revealed, setRevealed] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    setRevealed(localStorage.getItem(`topics-revealed-${bookId}`) === "true");
  }, [bookId]);

  function handleReveal() {
    const next = !revealed;
    setRevealed(next);
    localStorage.setItem(`topics-revealed-${bookId}`, next ? "true" : "false");
  }

  function handleSubmit() {
    if (!newTopic.trim()) return;
    onAddTopic(newTopic.trim());
    setNewTopic("");
    setIsAdding(false);
  }

  return (
    <div className="space-y-4">
      {topics.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="font-sans text-xs text-warm-brown/70">
            Blurred until you&apos;re ready — spoilers live here.
          </p>
          <Button size="sm" variant="secondary" onClick={handleReveal}>
            {revealed ? "Hide" : `Reveal ${topics.length}`}
          </Button>
        </div>
      )}

      {topics.length === 0 && !isAdding && (
        <p className="font-sans text-sm text-warm-brown/70">
          No questions queued for the meeting yet.
        </p>
      )}

      {topics.length > 0 && (
        <ol className="space-y-2.5">
          {topics.map((topic, i) => (
            <li
              key={topic.id}
              className="flex gap-3 rounded-xl border border-charcoal/[0.08] bg-white/50 px-4 py-3"
            >
              <span className="font-serif text-lg text-gold/80 leading-none pt-0.5 w-5 flex-shrink-0 tabular-nums">
                {i + 1}
              </span>
              <div className={`min-w-0 flex-1 ${revealed ? "spoiler-blur revealed" : "spoiler-blur"}`}>
                <p className="font-sans text-[15px] text-charcoal leading-relaxed">{topic.content}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Avatar name={topic.member?.name || "?"} size="xs" />
                  <span className="font-sans text-[11px] text-warm-brown/70">
                    {topic.member?.name || "Anonymous"}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {memberId &&
        (!isAdding ? (
          <Button variant="secondary" className="w-full" onClick={() => setIsAdding(true)}>
            Add a question
          </Button>
        ) : (
          <div className="space-y-3">
            <textarea
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="What do you want to talk about?"
              className={textareaClass}
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setIsAdding(false);
                  setNewTopic("");
                }}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSubmit}>
                Add
              </Button>
            </div>
          </div>
        ))}
    </div>
  );
}
