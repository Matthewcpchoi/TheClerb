"use client";

import { useState, useEffect } from "react";
import { DiscussionTopic } from "@/types";
import { getInitials, getAvatarColor } from "@/lib/utils";

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
    const key = `topics-revealed-${bookId}`;
    const stored = localStorage.getItem(key);
    if (stored === "true") setRevealed(true);
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
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-charcoal">
          Discussion Topics
        </h3>
        {topics.length > 0 && (
          <button
            onClick={handleReveal}
            className="px-4 py-2 rounded-lg bg-espresso/10 text-espresso font-sans text-sm hover:bg-espresso/20 transition-colors"
          >
            {revealed
              ? "Hide topics"
              : `Reveal ${topics.length} topic${topics.length !== 1 ? "s" : ""}`}
          </button>
        )}
      </div>

      {topics.length === 0 && !isAdding && (
        <p className="font-sans text-sm text-warm-brown/60 italic">
          No discussion topics yet. Be the first to add one.
        </p>
      )}

      {topics.length > 0 && (
        <div className="space-y-3">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className={`p-4 rounded-lg border border-cream-dark ${
                !revealed ? "spoiler-blur" : "spoiler-blur revealed"
              }`}
            >
              <p className="font-sans text-sm text-charcoal leading-relaxed">
                {topic.content}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-cream flex-shrink-0"
                  style={{
                    backgroundColor: getAvatarColor(
                      topic.member?.name || "?"
                    ),
                    fontSize: "8px",
                  }}
                >
                  {getInitials(topic.member?.name || "?")}
                </div>
                <span className="font-sans text-xs text-warm-brown/60">
                  {topic.member?.name || "Anonymous"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add topic */}
      {memberId && (
        <div className="mt-4">
          {!isAdding ? (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-3 rounded-lg border-2 border-dashed border-gold/30 text-gold font-sans text-sm hover:border-gold hover:bg-gold/5 transition-all"
            >
              Add a Discussion Topic
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="What would you like to discuss?"
                className="w-full px-4 py-3 rounded-lg border border-cream-dark bg-white font-sans text-sm text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewTopic("");
                  }}
                  className="flex-1 py-2 rounded-lg border border-cream-dark text-warm-brown font-sans text-sm hover:bg-cream-dark transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors"
                >
                  Add Topic
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
