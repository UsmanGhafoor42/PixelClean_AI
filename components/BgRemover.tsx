"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { removeBackground } from "@imgly/background-removal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Brush,
  Check,
  Download,
  Eraser,
  Eye,
  FileImage,
  ImagePlus,
  Layers3,
  Loader2,
  Maximize2,
  Palette,
  RefreshCcw,
  RotateCcw,
  SlidersHorizontal,
  Wand2,
} from "lucide-react";

type OutputFormat = "png" | "webp" | "jpeg";
type Stage = "idle" | "ready" | "removing" | "exporting" | "done" | "error";
type EditorTool = "restore" | "erase";
type PreviewBackdrop = "checker" | "white" | "dark" | "brand";
type ModalPanel = "restore" | "background" | "export";

type CanvasPoint = {
  x: number;
  y: number;
};

type CanvasSize = {
  width: number;
  height: number;
};

const maxFileBytes = 25 * 1024 * 1024;
const imglyAssetPath = "/imgly/background-removal/";
const acceptedTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const formatOptions: Array<{
  id: OutputFormat;
  label: string;
  detail: string;
}> = [
  { id: "png", label: "PNG", detail: "Transparent" },
  { id: "webp", label: "WebP", detail: "Compact" },
  { id: "jpeg", label: "JPEG", detail: "White base" },
];

const modalPanels: Array<{
  id: ModalPanel;
  label: string;
  icon: typeof Brush;
}> = [
  { id: "restore", label: "Restore", icon: Brush },
  { id: "background", label: "Backdrop", icon: Palette },
  { id: "export", label: "Export", icon: Download },
];

const backdropOptions: Array<{
  id: PreviewBackdrop;
  label: string;
  swatch: string;
}> = [
  { id: "checker", label: "Checker", swatch: "checkerboard" },
  { id: "white", label: "White", swatch: "bg-white" },
  { id: "dark", label: "Graphite", swatch: "bg-slate-900" },
  { id: "brand", label: "Brand", swatch: "bg-emerald-100" },
];

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the image preview."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not render the edited image."));
      }
    }, "image/png");
  });
}

function backdropClass(backdrop: PreviewBackdrop) {
  if (backdrop === "white") {
    return "bg-white";
  }

  if (backdrop === "dark") {
    return "checkerboard-dark";
  }

  if (backdrop === "brand") {
    return "bg-emerald-100";
  }

  return "checkerboard";
}

function stageTone(stage: Stage) {
  if (stage === "done") {
    return "success" as const;
  }

  if (stage === "error") {
    return "warning" as const;
  }

  return "outline" as const;
}

function stageLabel(stage: Stage) {
  if (stage === "removing") {
    return "Removing";
  }

  if (stage === "exporting") {
    return "Exporting";
  }

  if (stage === "done") {
    return "Ready";
  }

  if (stage === "error") {
    return "Needs attention";
  }

  if (stage === "ready") {
    return "Loaded";
  }

  return "Idle";
}

export default function BgRemover() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const originalUrlRef = useRef<string | null>(null);
  const cutoutUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const restoreCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const cutoutImageRef = useRef<HTMLImageElement | null>(null);
  const paintingRef = useRef(false);
  const lastPointRef = useRef<CanvasPoint | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [format, setFormat] = useState<OutputFormat>("png");
  const [quality, setQuality] = useState(94);
  const [optimize, setOptimize] = useState(true);
  const [stage, setStage] = useState<Stage>("idle");
  const [status, setStatus] = useState("Select an image to begin.");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPanel, setModalPanel] = useState<ModalPanel>("restore");
  const [editorTool, setEditorTool] = useState<EditorTool>("restore");
  const [brushSize, setBrushSize] = useState(48);
  const [previewBackdrop, setPreviewBackdrop] =
    useState<PreviewBackdrop>("checker");
  const [canvasSize, setCanvasSize] = useState<CanvasSize | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [hasRestoreMask, setHasRestoreMask] = useState(false);

  const busy = stage === "removing" || stage === "exporting";
  const canDownload = Boolean(resultBlob && resultUrl);

  const fileSummary = useMemo(() => {
    if (!file) {
      return "PNG, JPG, WebP up to 25 MB";
    }

    return `${file.name} - ${formatBytes(file.size)}`;
  }, [file]);

  const setOriginalObjectUrl = useCallback((url: string | null) => {
    if (originalUrlRef.current) {
      URL.revokeObjectURL(originalUrlRef.current);
    }

    originalUrlRef.current = url;
    setOriginalUrl(url);
  }, []);

  const setCutoutObjectUrl = useCallback((url: string | null) => {
    if (cutoutUrlRef.current) {
      URL.revokeObjectURL(cutoutUrlRef.current);
    }

    cutoutUrlRef.current = url;
    setCutoutUrl(url);
  }, []);

  const setResultObjectUrl = useCallback((url: string | null) => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
    }

    resultUrlRef.current = url;
    setResultUrl(url);
  }, []);

  const resetEditorState = useCallback(() => {
    maskCanvasRef.current = null;
    restoreCanvasRef.current = null;
    originalImageRef.current = null;
    cutoutImageRef.current = null;
    paintingRef.current = false;
    lastPointRef.current = null;
    setCanvasSize(null);
    setIsEditorReady(false);
    setHasRestoreMask(false);
    setModalPanel("restore");
    setEditorTool("restore");
  }, []);

  const resetProcessedResult = useCallback(() => {
    setCutoutObjectUrl(null);
    setResultObjectUrl(null);
    setResultBlob(null);
    setProgress(0);
    resetEditorState();
  }, [resetEditorState, setCutoutObjectUrl, setResultObjectUrl]);

  const drawCompositeToCanvas = useCallback((targetCanvas: HTMLCanvasElement) => {
    const originalImage = originalImageRef.current;
    const cutoutImage = cutoutImageRef.current;

    if (!originalImage || !cutoutImage) {
      return false;
    }

    const width = cutoutImage.naturalWidth || originalImage.naturalWidth;
    const height = cutoutImage.naturalHeight || originalImage.naturalHeight;
    const context = targetCanvas.getContext("2d");

    if (!context || width <= 0 || height <= 0) {
      return false;
    }

    if (targetCanvas.width !== width) {
      targetCanvas.width = width;
    }

    if (targetCanvas.height !== height) {
      targetCanvas.height = height;
    }

    context.clearRect(0, 0, width, height);
    context.drawImage(cutoutImage, 0, 0, width, height);

    const maskCanvas = maskCanvasRef.current;

    if (maskCanvas) {
      let restoreCanvas = restoreCanvasRef.current;

      if (!restoreCanvas) {
        restoreCanvas = document.createElement("canvas");
        restoreCanvasRef.current = restoreCanvas;
      }

      if (restoreCanvas.width !== width) {
        restoreCanvas.width = width;
      }

      if (restoreCanvas.height !== height) {
        restoreCanvas.height = height;
      }

      const restoreContext = restoreCanvas.getContext("2d");

      if (restoreContext) {
        restoreContext.clearRect(0, 0, width, height);
        restoreContext.globalCompositeOperation = "source-over";
        restoreContext.drawImage(originalImage, 0, 0, width, height);
        restoreContext.globalCompositeOperation = "destination-in";
        restoreContext.drawImage(maskCanvas, 0, 0, width, height);
        restoreContext.globalCompositeOperation = "source-over";
        context.drawImage(restoreCanvas, 0, 0, width, height);
      }
    }

    return true;
  }, []);

  const renderEditorCanvas = useCallback(() => {
    const canvas = editorCanvasRef.current;

    if (canvas) {
      drawCompositeToCanvas(canvas);
    }
  }, [drawCompositeToCanvas]);

  const commitEditedCanvas = useCallback(async () => {
    const originalImage = originalImageRef.current;
    const cutoutImage = cutoutImageRef.current;

    if (!originalImage || !cutoutImage) {
      return;
    }

    const outputCanvas = document.createElement("canvas");

    if (!drawCompositeToCanvas(outputCanvas)) {
      return;
    }

    const blob = await canvasToBlob(outputCanvas);
    setResultBlob(blob);
    setResultObjectUrl(URL.createObjectURL(blob));
    setStage("done");
    setStatus(`Edits applied: ${formatBytes(blob.size)} PNG working file.`);
  }, [drawCompositeToCanvas, setResultObjectUrl]);

  useEffect(() => {
    return () => {
      if (originalUrlRef.current) {
        URL.revokeObjectURL(originalUrlRef.current);
      }

      if (cutoutUrlRef.current) {
        URL.revokeObjectURL(cutoutUrlRef.current);
      }

      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!modalOpen || !originalUrl || !cutoutUrl) {
      return;
    }

    let cancelled = false;
    const activeOriginalUrl = originalUrl;
    const activeCutoutUrl = cutoutUrl;
    setIsEditorReady(false);

    async function prepareEditor() {
      try {
        const [originalImage, cutoutImage] = await Promise.all([
          loadImage(activeOriginalUrl),
          loadImage(activeCutoutUrl),
        ]);

        if (cancelled) {
          return;
        }

        const width = cutoutImage.naturalWidth || originalImage.naturalWidth;
        const height = cutoutImage.naturalHeight || originalImage.naturalHeight;

        originalImageRef.current = originalImage;
        cutoutImageRef.current = cutoutImage;

        if (
          !maskCanvasRef.current ||
          maskCanvasRef.current.width !== width ||
          maskCanvasRef.current.height !== height
        ) {
          const maskCanvas = document.createElement("canvas");
          maskCanvas.width = width;
          maskCanvas.height = height;
          maskCanvasRef.current = maskCanvas;
          setHasRestoreMask(false);
        }

        setCanvasSize({ width, height });
        setIsEditorReady(true);
        requestAnimationFrame(renderEditorCanvas);
      } catch (error) {
        console.error(error);
        setStage("error");
        setStatus("The editor could not open this image preview.");
      }
    }

    void prepareEditor();

    return () => {
      cancelled = true;
      paintingRef.current = false;
      lastPointRef.current = null;
    };
  }, [cutoutUrl, modalOpen, originalUrl, renderEditorCanvas]);

  function handleFile(selected: File | null) {
    if (!selected) {
      return;
    }

    if (!selected.type.startsWith("image/") || !acceptedTypes.has(selected.type)) {
      setStage("error");
      setStatus("Choose a PNG, JPG, or WebP image.");
      return;
    }

    if (selected.size > maxFileBytes) {
      setStage("error");
      setStatus("Choose an image that is 25 MB or smaller.");
      return;
    }

    setModalOpen(false);
    setFile(selected);
    setOriginalObjectUrl(URL.createObjectURL(selected));
    resetProcessedResult();
    setStage("ready");
    setStatus("Ready to remove the background.");
  }

  async function processImage() {
    if (!file || busy) {
      return;
    }

    try {
      setModalOpen(false);
      resetProcessedResult();
      setStage("removing");
      setProgress(8);
      setStatus("Preparing the background removal model.");

      const imglyPublicPath = new URL(
        imglyAssetPath,
        window.location.origin,
      ).toString();
      let cutoutBlob: Blob;

      try {
        cutoutBlob = await removeBackground(file, {
          publicPath: imglyPublicPath,
          device: "cpu",
          model: "isnet_fp16",
          output: {
            format: "image/png",
            quality: 1,
          },
          progress: (_key, current, total) => {
            if (total > 0) {
              const modelProgress = Math.round((current / total) * 72);
              setProgress(Math.min(82, Math.max(12, modelProgress)));
            }
          },
        });
      } catch (primaryModelError) {
        console.warn(
          "Primary model failed, retrying with fallback model.",
          primaryModelError,
        );
        setStatus("Primary model failed. Retrying with fallback model.");
        cutoutBlob = await removeBackground(file, {
          publicPath: imglyPublicPath,
          device: "cpu",
          model: "isnet_quint8",
          output: {
            format: "image/png",
            quality: 1,
          },
          progress: (_key, current, total) => {
            if (total > 0) {
              const modelProgress = Math.round((current / total) * 72);
              setProgress(Math.min(82, Math.max(12, modelProgress)));
            }
          },
        });
      }

      setProgress(92);

      const cutoutObjectUrl = URL.createObjectURL(cutoutBlob);
      const resultObjectUrl = URL.createObjectURL(cutoutBlob);
      setCutoutObjectUrl(cutoutObjectUrl);
      setResultObjectUrl(resultObjectUrl);
      setResultBlob(cutoutBlob);
      setProgress(100);
      setStage("done");
      setStatus(
        `Cutout ready: ${formatBytes(cutoutBlob.size)} PNG working file.`,
      );
    } catch (error) {
      console.error(error);
      setProgress(0);
      setStage("error");
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Processing failed. Try a smaller image or a different file.";
      setStatus(message);
    }
  }

  async function downloadImage() {
    if (!resultBlob || busy) {
      return;
    }

    try {
      setStage("exporting");
      setProgress(88);
      setStatus("Preparing the export.");

      let finalBlob = resultBlob;

      if (optimize || format !== "png") {
        const form = new FormData();
        form.append("image", resultBlob, "pixelclean-edited.png");
        form.append("format", format);
        form.append("quality", String(quality));

        const response = await fetch("/api/optimize", {
          method: "POST",
          body: form,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Optimization failed.");
        }

        finalBlob = await response.blob();
      }

      const downloadUrl = URL.createObjectURL(finalBlob);
      const baseName = file?.name.replace(/\.[^/.]+$/, "") || "image";
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${baseName}-pixelclean.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 500);

      setProgress(100);
      setStage("done");
      setStatus(
        `Downloaded: ${formatBytes(finalBlob.size)} ${format.toUpperCase()} export.`,
      );
    } catch (error) {
      console.error(error);
      setProgress(0);
      setStage("error");
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Export failed. Try PNG or lower the quality setting.";
      setStatus(message);
    }
  }

  function clearImage() {
    setModalOpen(false);
    setFile(null);
    setOriginalObjectUrl(null);
    resetProcessedResult();
    setStage("idle");
    setStatus("Select an image to begin.");
    setProgress(0);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function openResultEditor() {
    if (!resultUrl || busy) {
      return;
    }

    setModalPanel("restore");
    setModalOpen(true);
  }

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

    return {
      x: Math.min(canvas.width, Math.max(0, x)),
      y: Math.min(canvas.height, Math.max(0, y)),
    };
  }

  function paintMask(point: CanvasPoint) {
    const maskCanvas = maskCanvasRef.current;
    const context = maskCanvas?.getContext("2d");

    if (!maskCanvas || !context) {
      return;
    }

    const lastPoint = lastPointRef.current;
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = brushSize;
    context.strokeStyle = "#ffffff";
    context.fillStyle = "#ffffff";
    context.globalCompositeOperation =
      editorTool === "erase" ? "destination-out" : "source-over";

    if (lastPoint) {
      context.beginPath();
      context.moveTo(lastPoint.x, lastPoint.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    } else {
      context.beginPath();
      context.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
    lastPointRef.current = point;

    if (editorTool === "restore") {
      setHasRestoreMask(true);
    }

    renderEditorCanvas();
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isEditorReady) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    paintingRef.current = true;
    lastPointRef.current = null;
    paintMask(getCanvasPoint(event));
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!paintingRef.current || !isEditorReady) {
      return;
    }

    event.preventDefault();
    paintMask(getCanvasPoint(event));
  }

  function finishPainting(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!paintingRef.current) {
      return;
    }

    paintingRef.current = false;
    lastPointRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    void commitEditedCanvas();
  }

  function resetRestoreMask() {
    const maskCanvas = maskCanvasRef.current;
    const context = maskCanvas?.getContext("2d");

    if (!maskCanvas || !context) {
      return;
    }

    context.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setHasRestoreMask(false);
    renderEditorCanvas();
    void commitEditedCanvas();
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft-panel">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.45fr)]">
          <div className="min-w-0 border-b border-border p-4 sm:p-5 xl:border-b-0 xl:border-r">
            <div
              className={cn(
                "relative flex min-h-[230px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                isDragging
                  ? "border-primary bg-emerald-50"
                  : "border-border bg-muted/50 hover:border-primary/70 hover:bg-emerald-50/60",
              )}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                handleFile(event.dataTransfer.files?.[0] ?? null);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              />

              <div className="grid h-14 w-14 place-items-center rounded-lg bg-primary text-primary-foreground">
                <ImagePlus size={26} aria-hidden="true" />
              </div>
              <p className="mt-4 text-lg font-semibold text-foreground">
                Upload image
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {fileSummary}
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Preview title="Original" imageUrl={originalUrl} />
              <Preview
                title="Background removed"
                imageUrl={resultUrl}
                transparent
                actionLabel="Open editor"
                onOpen={openResultEditor}
              />
            </div>
          </div>

          <div className="min-w-0 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge variant={stageTone(stage)}>{stageLabel(stage)}</Badge>
                <h2 className="mt-3 text-2xl font-semibold text-foreground">
                  Export Settings
                </h2>
              </div>
              <Button
                type="button"
                onClick={clearImage}
                disabled={!file || busy}
                variant="outline"
                size="icon"
                aria-label="Reset image"
                title="Reset image"
              >
                <RefreshCcw size={17} aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-6 space-y-5">
              <label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/50 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    Optimize export
                  </span>
                  <span className="block text-xs font-medium text-muted-foreground">
                    Compress output before download
                  </span>
                </span>
                <Switch
                  checked={optimize}
                  disabled={busy}
                  onChange={(event) => setOptimize(event.target.checked)}
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    Export format
                  </p>
                  <SlidersHorizontal
                    size={16}
                    className="text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {formatOptions.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant={format === option.id ? "default" : "outline"}
                      className="h-auto min-h-14 flex-col gap-1 px-2 py-2"
                      disabled={busy}
                      onClick={() => setFormat(option.id)}
                    >
                      <span>{option.label}</span>
                      <span className="text-[11px] font-medium opacity-75">
                        {option.detail}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              <label className="block text-sm font-semibold text-foreground">
                <span className="flex items-center justify-between">
                  <span>Quality</span>
                  <span className="text-muted-foreground">{quality}%</span>
                </span>
                <input
                  type="range"
                  min="80"
                  max="100"
                  value={quality}
                  disabled={busy || (!optimize && format === "png")}
                  onChange={(event) => setQuality(Number(event.target.value))}
                  className="mt-3 w-full accent-primary disabled:opacity-40"
                />
              </label>

              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-semibold text-foreground">Status</span>
                  <span className="font-semibold text-muted-foreground">
                    {busy ? `${progress}%` : stageLabel(stage)}
                  </span>
                </div>
                <Progress value={progress} className="mt-3" />
                <p className="mt-3 min-h-10 text-sm font-medium leading-5 text-muted-foreground">
                  {status}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Button
                  type="button"
                  onClick={processImage}
                  disabled={!file || busy}
                  size="lg"
                >
                  {stage === "removing" ? (
                    <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                  ) : (
                    <Wand2 size={18} aria-hidden="true" />
                  )}
                  {stage === "removing" ? "Processing" : "Remove Background"}
                </Button>

                <Button
                  type="button"
                  onClick={downloadImage}
                  disabled={!canDownload || busy}
                  variant="outline"
                  size="lg"
                >
                  {stage === "exporting" ? (
                    <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                  ) : (
                    <Download size={18} aria-hidden="true" />
                  )}
                  Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-6xl">
          <div className="grid max-h-[calc(100vh-2rem)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_330px]">
            <div className="min-w-0 border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r">
              <DialogHeader className="pr-12">
                <DialogTitle>Result Editor</DialogTitle>
                <DialogDescription>
                  Restore selected background areas, inspect edges, and export
                  the final asset.
                </DialogDescription>
              </DialogHeader>

              <div
                className={cn(
                  "mt-5 grid min-h-[320px] place-items-center rounded-lg border border-border p-3",
                  backdropClass(previewBackdrop),
                )}
              >
                {isEditorReady && canvasSize ? (
                  <div
                    className="relative mx-auto w-full overflow-hidden rounded-md bg-transparent shadow-editor"
                    style={{
                      aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
                      maxWidth: `min(100%, calc(62vh * ${
                        canvasSize.width / canvasSize.height
                      }))`,
                    }}
                  >
                    <canvas
                      ref={editorCanvasRef}
                      width={canvasSize.width}
                      height={canvasSize.height}
                      className={cn(
                        "h-full w-full touch-none",
                        editorTool === "restore"
                          ? "cursor-crosshair"
                          : "cursor-cell",
                      )}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={finishPainting}
                      onPointerCancel={finishPainting}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="animate-spin" size={24} aria-hidden="true" />
                    <span className="text-sm font-semibold">Loading editor</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-2 bg-background">
                  <Eye size={14} aria-hidden="true" />
                  {previewBackdrop}
                </Badge>
                {canvasSize ? (
                  <Badge variant="outline" className="bg-background">
                    {canvasSize.width} x {canvasSize.height}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 p-4 sm:p-5">
              <div className="grid grid-cols-3 gap-2">
                {modalPanels.map((panel) => {
                  const Icon = panel.icon;

                  return (
                    <Button
                      key={panel.id}
                      type="button"
                      variant={modalPanel === panel.id ? "default" : "outline"}
                      className="h-auto min-h-12 flex-col gap-1 px-2 py-2 text-xs"
                      onClick={() => setModalPanel(panel.id)}
                    >
                      <Icon size={16} aria-hidden="true" />
                      {panel.label}
                    </Button>
                  );
                })}
              </div>

              {modalPanel === "restore" ? (
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground">
                      Brush mode
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={editorTool === "restore" ? "default" : "outline"}
                        onClick={() => setEditorTool("restore")}
                      >
                        <Brush size={16} aria-hidden="true" />
                        Restore
                      </Button>
                      <Button
                        type="button"
                        variant={editorTool === "erase" ? "default" : "outline"}
                        onClick={() => setEditorTool("erase")}
                      >
                        <Eraser size={16} aria-hidden="true" />
                        Erase
                      </Button>
                    </div>
                  </div>

                  <label className="block text-sm font-semibold text-foreground">
                    <span className="flex items-center justify-between">
                      <span>Brush size</span>
                      <span className="text-muted-foreground">{brushSize}px</span>
                    </span>
                    <input
                      type="range"
                      min="12"
                      max="160"
                      value={brushSize}
                      onChange={(event) => setBrushSize(Number(event.target.value))}
                      className="mt-3 w-full accent-primary"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!isEditorReady || !hasRestoreMask}
                      onClick={resetRestoreMask}
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                      Reset
                    </Button>
                    <Button
                      type="button"
                      disabled={!isEditorReady}
                      onClick={() => void commitEditedCanvas()}
                    >
                      <Check size={16} aria-hidden="true" />
                      Apply
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
                    Paint over the cutout to bring back the original background in
                    just that selected area.
                  </div>
                </div>
              ) : null}

              {modalPanel === "background" ? (
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground">
                      Preview backdrop
                    </p>
                    <div className="grid gap-2">
                      {backdropOptions.map((option) => (
                        <Button
                          key={option.id}
                          type="button"
                          variant={
                            previewBackdrop === option.id ? "default" : "outline"
                          }
                          className="justify-start"
                          onClick={() => setPreviewBackdrop(option.id)}
                        >
                          <span
                            className={cn(
                              "h-5 w-5 rounded-sm border border-border",
                              option.swatch,
                            )}
                          />
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
                    Backdrops are for edge inspection. JPEG export still flattens
                    the image to a white background.
                  </div>
                </div>
              ) : null}

              {modalPanel === "export" ? (
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground">
                      Format
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {formatOptions.map((option) => (
                        <Button
                          key={option.id}
                          type="button"
                          variant={format === option.id ? "default" : "outline"}
                          className="h-auto min-h-14 flex-col gap-1 px-2 py-2"
                          onClick={() => setFormat(option.id)}
                        >
                          <span>{option.label}</span>
                          <span className="text-[11px] font-medium opacity-75">
                            {option.detail}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/50 px-4 py-3">
                    <span>
                      <span className="block text-sm font-semibold text-foreground">
                        Optimize
                      </span>
                      <span className="block text-xs font-medium text-muted-foreground">
                        Recompress before download
                      </span>
                    </span>
                    <Switch
                      checked={optimize}
                      disabled={busy}
                      onChange={(event) => setOptimize(event.target.checked)}
                    />
                  </label>

                  <label className="block text-sm font-semibold text-foreground">
                    <span className="flex items-center justify-between">
                      <span>Quality</span>
                      <span className="text-muted-foreground">{quality}%</span>
                    </span>
                    <input
                      type="range"
                      min="80"
                      max="100"
                      value={quality}
                      disabled={busy || (!optimize && format === "png")}
                      onChange={(event) => setQuality(Number(event.target.value))}
                      className="mt-3 w-full accent-primary disabled:opacity-40"
                    />
                  </label>

                  <Button
                    type="button"
                    className="w-full"
                    size="lg"
                    disabled={!canDownload || busy}
                    onClick={downloadImage}
                  >
                    {stage === "exporting" ? (
                      <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                    ) : (
                      <Download size={18} aria-hidden="true" />
                    )}
                    Download {format.toUpperCase()}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Preview({
  title,
  imageUrl,
  transparent = false,
  actionLabel,
  onOpen,
}: {
  title: string;
  imageUrl: string | null;
  transparent?: boolean;
  actionLabel?: string;
  onOpen?: () => void;
}) {
  const preview = (
    <div
      className={cn(
        "grid aspect-square min-h-[220px] place-items-center",
        transparent ? "checkerboard" : "bg-muted",
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={title}
          className="h-full w-full object-contain p-3"
        />
      ) : (
        <span className="px-3 text-center text-sm font-semibold text-muted-foreground">
          No image yet
        </span>
      )}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm font-semibold text-foreground">
        <span className="inline-flex items-center gap-2">
          <FileImage size={16} className="text-muted-foreground" aria-hidden="true" />
          {title}
        </span>
        {imageUrl && onOpen ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <Maximize2 size={13} aria-hidden="true" />
            Edit
          </span>
        ) : null}
      </div>

      {imageUrl && onOpen ? (
        <button
          type="button"
          className="group relative block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpen}
          aria-label={actionLabel || `Open ${title}`}
        >
          {preview}
          <span className="pointer-events-none absolute inset-x-3 bottom-3 flex translate-y-1 items-center justify-center gap-2 rounded-md bg-slate-950/90 px-3 py-2 text-sm font-semibold text-white opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
            <Layers3 size={15} aria-hidden="true" />
            {actionLabel || "Open"}
          </span>
        </button>
      ) : (
        preview
      )}
    </div>
  );
}
