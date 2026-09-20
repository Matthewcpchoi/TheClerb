"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "@phosphor-icons/react";
import { OutlineButton, Sheet, SolidButton } from "./ui";

/**
 * Capture a line from a page without typing it.
 *
 * Photograph the page, drag a box over the passage, and the text is read on
 * the device — the picture never leaves the phone and is dropped the moment
 * the quote is saved. Recognition runs through tesseract.js, loaded only when
 * this sheet opens so the bundle stays small for everyone who never uses it.
 */

type Phase = "capture" | "select" | "reading" | "edit";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function QuoteCapture({
  onSave,
  onClose,
}: {
  onSave: (content: string, page: string) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("capture");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [text, setText] = useState("");
  const [page, setPage] = useState("");
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // The photo lives in an object URL and is revoked on the way out.
  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl]
  );

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUrl(URL.createObjectURL(file));
    setBox(null);
    setFailed(false);
    setPhase("select");
  }

  function pointFrom(e: React.PointerEvent) {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pointFrom(e);
    dragStart.current = p;
    setBox({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const p = pointFrom(e);
    const s = dragStart.current;
    setBox({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  }

  function onPointerUp() {
    dragStart.current = null;
  }

  const readSelection = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !box || box.w < 0.02 || box.h < 0.01) return;

    setPhase("reading");
    setProgress(0);
    setFailed(false);

    try {
      // Crop at native resolution — OCR needs the pixels, not the preview.
      const sx = box.x * img.naturalWidth;
      const sy = box.y * img.naturalHeight;
      const sw = box.w * img.naturalWidth;
      const sh = box.h * img.naturalHeight;

      // Upscale hard. Tesseract wants roughly 30px-tall characters, and a
      // cropped paragraph off a phone photo is usually well under that.
      const scale = Math.min(6, Math.max(2, 2400 / Math.max(sw, 1)));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no canvas");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      // Grey, then threshold with Otsu. A fixed contrast curve left grey
      // paper and ink too close together, which is what turned whole words
      // into punctuation soup.
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const grey = new Uint8ClampedArray(px.data.length / 4);
      const hist = new Array(256).fill(0);
      for (let i = 0, g = 0; i < px.data.length; i += 4, g++) {
        const v = Math.round(
          0.299 * px.data[i] + 0.587 * px.data[i + 1] + 0.114 * px.data[i + 2]
        );
        grey[g] = v;
        hist[v]++;
      }

      const total = grey.length;
      let sum = 0;
      for (let t = 0; t < 256; t++) sum += t * hist[t];
      let sumB = 0;
      let wB = 0;
      let best = 0;
      let threshold = 128;
      for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (wB === 0) continue;
        const wF = total - wB;
        if (wF === 0) break;
        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > best) {
          best = between;
          threshold = t;
        }
      }

      for (let i = 0, g = 0; i < px.data.length; i += 4, g++) {
        const v = grey[g] > threshold ? 255 : 0;
        px.data[i] = px.data[i + 1] = px.data[i + 2] = v;
      }
      ctx.putImageData(px, 0, 0);

      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      // Page segmentation 6: one uniform block of text. The default assumes a
      // whole page with columns and headings, and shreds a single paragraph.
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
      });
      const { data } = await worker.recognize(canvas);
      await worker.terminate();

      const cleaned = data.text
        .replace(/-\n/g, "") // rejoin words broken across lines
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

      if (!cleaned) {
        setFailed(true);
        setPhase("select");
        return;
      }
      setText(cleaned);
      setPhase("edit");
    } catch {
      setFailed(true);
      setPhase("select");
    }
  }, [box]);

  function save() {
    if (!text.trim()) return;
    onSave(text.trim(), page.trim());
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    onClose();
  }

  return (
    <Sheet title="Capture a Line" onClose={onClose} full>
      {phase === "capture" && (
        <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-tan py-14">
          <Camera size={30} className="text-green" />
          <span className="text-[14px] text-ink">Photograph the page</span>
          <span className="text-[12px] text-muted">Stays on your phone</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={pickFile}
            className="hidden"
          />
        </label>
      )}

      {(phase === "select" || phase === "reading") && imageUrl && (
        <div>
          <p className="pb-2 text-[12.5px] text-muted">Drag a box over the passage.</p>
          <div
            ref={frameRef}
            onPointerDown={phase === "select" ? onPointerDown : undefined}
            onPointerMove={phase === "select" ? onPointerMove : undefined}
            onPointerUp={onPointerUp}
            className="relative touch-none overflow-hidden rounded-lg bg-tan/30"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="The page you photographed"
              className="block w-full select-none"
              draggable={false}
            />
            {box && box.w > 0 && (
              <div
                className="pointer-events-none absolute border-2 border-green"
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.w * 100}%`,
                  height: `${box.h * 100}%`,
                  background: "rgba(0,151,116,.16)",
                }}
              />
            )}
          </div>

          {failed && (
            <p className="pt-3 text-[12.5px] text-muted">
              Couldn&apos;t read that. Try a tighter box, or better light.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <OutlineButton
              className="flex-1"
              onClick={() => {
                setPhase("capture");
                setBox(null);
              }}
            >
              Retake
            </OutlineButton>
            <SolidButton
              className="flex-1"
              onClick={readSelection}
              disabled={phase === "reading" || !box || box.w < 0.02}
            >
              {phase === "reading" ? `Reading ${progress}%` : "Read the text"}
            </SolidButton>
          </div>
        </div>
      )}

      {phase === "edit" && (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-lg border border-tan bg-transparent px-3 py-2 text-[14px] italic leading-relaxed text-ink outline-none focus:border-green"
          />
          <input
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder="Page"
            inputMode="numeric"
            className="num w-[110px] rounded-lg border border-tan bg-transparent px-3 py-2 text-[13px] text-ink outline-none placeholder:text-muted/60 focus:border-green"
          />
          <div className="flex gap-2">
            <OutlineButton className="flex-1" onClick={() => setPhase("select")}>
              Back
            </OutlineButton>
            <SolidButton className="flex-1" onClick={save} disabled={!text.trim()}>
              Save the Line
            </SolidButton>
          </div>
          <p className="text-[11.5px] text-muted">The photo is discarded when you save.</p>
        </div>
      )}
    </Sheet>
  );
}
