import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  value?: string;
  onChange?: (dataUrl: string) => void;
  readOnly?: boolean;
  className?: string;
  height?: number;
  label?: string;
};

export function SignaturePad({
  value = "",
  onChange,
  readOnly = false,
  className,
  height = 72,
  label = "Signature",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const skipLoad = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(value));

  function prepareCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const nextW = Math.max(1, Math.floor(rect.width * dpr));
    const nextH = Math.max(1, Math.floor(rect.height * dpr));

    // Preserve existing strokes when resizing.
    let snapshot: ImageData | null = null;
    if (canvas.width > 0 && canvas.height > 0 && (canvas.width !== nextW || canvas.height !== nextH)) {
      try {
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {
        snapshot = null;
      }
    }

    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#171717";
    ctx.lineWidth = 2;

    if (snapshot) {
      const tmp = document.createElement("canvas");
      tmp.width = snapshot.width;
      tmp.height = snapshot.height;
      tmp.getContext("2d")?.putImageData(snapshot, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(tmp, 0, 0, nextW, nextH);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#171717";
      ctx.lineWidth = 2;
    }

    return { ctx, cssWidth: rect.width, cssHeight: rect.height, dpr };
  }

  function fillPad(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Keep the pad surface white so saved signatures (and PDF exports) stay clean.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }

  useEffect(() => {
    if (readOnly) return;
    if (skipLoad.current) {
      skipLoad.current = false;
      setHasInk(Boolean(value));
      return;
    }

    const prepared = prepareCanvas();
    if (!prepared) return;
    const { ctx, cssWidth, cssHeight } = prepared;
    fillPad(ctx, cssWidth, cssHeight);

    if (!value) {
      setHasInk(false);
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
      setHasInk(true);
    };
    img.src = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, readOnly]);

  function pointFromEvent(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function commit() {
    const canvas = canvasRef.current;
    if (!canvas || !onChange) return;
    skipLoad.current = true;
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const prepared = prepareCanvas();
    if (!prepared || !onChange) return;
    fillPad(prepared.ctx, prepared.cssWidth, prepared.cssHeight);
    setHasInk(false);
    skipLoad.current = true;
    onChange("");
  }

  if (readOnly) {
    return (
      <div
        className={cn("flex items-center justify-center bg-white", className)}
        style={{ minHeight: height }}
      >
        {value ? (
          <img src={value} alt={label} className="max-h-full max-w-full object-contain px-1" />
        ) : (
          <span className="text-neutral-300">&nbsp;</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative bg-amber-50/40", className)} style={{ minHeight: height }}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none cursor-crosshair"
        style={{ height }}
        aria-label={label}
        onPointerDown={(e) => {
          const prepared = prepareCanvas();
          const pt = pointFromEvent(e);
          if (!prepared || !pt) return;
          // First stroke on empty pad: ensure white background is painted.
          if (!hasInk && !value) {
            fillPad(prepared.ctx, prepared.cssWidth, prepared.cssHeight);
          }
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = pt;
          setHasInk(true);
          prepared.ctx.beginPath();
          prepared.ctx.moveTo(pt.x, pt.y);
          prepared.ctx.lineTo(pt.x + 0.01, pt.y + 0.01);
          prepared.ctx.stroke();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const prepared = prepareCanvas();
          const pt = pointFromEvent(e);
          if (!prepared || !pt || !last.current) return;
          prepared.ctx.beginPath();
          prepared.ctx.moveTo(last.current.x, last.current.y);
          prepared.ctx.lineTo(pt.x, pt.y);
          prepared.ctx.stroke();
          last.current = pt;
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          last.current = null;
          commit();
        }}
        onPointerCancel={() => {
          drawing.current = false;
          last.current = null;
        }}
      />
      {hasInk || value ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute right-0.5 top-0.5 size-6 rounded-md bg-white/80 text-neutral-600 hover:bg-white"
          onClick={clear}
          title="Clear signature"
        >
          <Eraser className="size-3.5" />
        </Button>
      ) : (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-neutral-400">
          Draw signature
        </span>
      )}
    </div>
  );
}
