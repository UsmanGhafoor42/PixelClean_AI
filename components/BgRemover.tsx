"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { removeBackground } from "@imgly/background-removal";
import {
  Download,
  FileImage,
  ImagePlus,
  Loader2,
  RefreshCcw,
  Wand2,
} from "lucide-react";

type OutputFormat = "png" | "webp" | "jpeg";
type Stage = "idle" | "ready" | "removing" | "optimizing" | "done" | "error";

const maxFileBytes = 25 * 1024 * 1024;
const acceptedTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function fileExtensionFor(format: OutputFormat, optimize: boolean) {
  return optimize ? format : "png";
}

export default function BgRemover() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const originalUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [format, setFormat] = useState<OutputFormat>("png");
  const [quality, setQuality] = useState(94);
  const [optimize, setOptimize] = useState(true);
  const [stage, setStage] = useState<Stage>("idle");
  const [status, setStatus] = useState("Select an image to begin.");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const busy = stage === "removing" || stage === "optimizing";
  const canDownload = Boolean(resultBlob && resultUrl);
  const exportExtension = fileExtensionFor(format, optimize);

  const fileSummary = useMemo(() => {
    if (!file) {
      return "PNG, JPG, WebP up to 25 MB";
    }

    return `${file.name} • ${formatBytes(file.size)}`;
  }, [file]);

  useEffect(() => {
    return () => {
      if (originalUrlRef.current) {
        URL.revokeObjectURL(originalUrlRef.current);
      }

      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
    };
  }, []);

  function setOriginalObjectUrl(url: string | null) {
    if (originalUrlRef.current) {
      URL.revokeObjectURL(originalUrlRef.current);
    }

    originalUrlRef.current = url;
    setOriginalUrl(url);
  }

  function setResultObjectUrl(url: string | null) {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
    }

    resultUrlRef.current = url;
    setResultUrl(url);
  }

  function resetResult() {
    setResultObjectUrl(null);
    setResultBlob(null);
    setProgress(0);
  }

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

    setFile(selected);
    setOriginalObjectUrl(URL.createObjectURL(selected));
    resetResult();
    setStage("ready");
    setStatus("Ready to remove the background.");
  }

async function processImage() {
    if (!file || busy) {
      return;
    }

    try {
      setStage("removing");
      setProgress(8);
      setStatus("Preparing the background removal model.");

      let cutoutBlob: Blob;

      try {
        cutoutBlob = await removeBackground(file, {
          model: "isnet_fp16",
          output: {
            format: "image/png",
            quality: 1,
          },
          progress: (_key, current, total) => {
            if (total > 0) {
              const modelProgress = Math.round((current / total) * 55);
              setProgress(Math.min(65, Math.max(12, modelProgress)));
            }
          },
        });
      } catch (primaryModelError) {
        console.warn("Primary model failed, retrying with fallback model.", primaryModelError);
        setStatus("Primary model failed. Retrying with fallback model...");
        cutoutBlob = await removeBackground(file, {
          model: "isnet_quint8",
          output: {
            format: "image/png",
            quality: 1,
          },
          progress: (_key, current, total) => {
            if (total > 0) {
              const modelProgress = Math.round((current / total) * 55);
              setProgress(Math.min(65, Math.max(12, modelProgress)));
            }
          },
        });
      }

      let finalBlob = cutoutBlob;

      if (optimize) {
        setStage("optimizing");
        setProgress(78);
        setStatus("Optimizing the export.");

        const form = new FormData();
        form.append("image", cutoutBlob, "pixelclean-cutout.png");
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

      const url = URL.createObjectURL(finalBlob);
      setResultBlob(finalBlob);
      setResultObjectUrl(url);
      setProgress(100);
      setStage("done");
      setStatus(`Ready: ${formatBytes(finalBlob.size)} ${exportExtension.toUpperCase()} export.`);
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

  function downloadImage() {
    if (!resultBlob || !resultUrl) {
      return;
    }

    const baseName = file?.name.replace(/\.[^/.]+$/, "") || "image";
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `${baseName}-pixelclean.${exportExtension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function clearImage() {
    setFile(null);
    setOriginalObjectUrl(null);
    resetResult();
    setStage("idle");
    setStatus("Select an image to begin.");
    setProgress(0);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft-panel">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.48fr)]">
        <div className="min-w-0 border-b border-slate-200 p-4 sm:p-5 xl:border-b-0 xl:border-r">
          <div
            className={`relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${
              isDragging
                ? "border-teal-500 bg-teal-50"
                : "border-slate-300 bg-slate-50 hover:border-teal-500 hover:bg-teal-50/60"
            }`}
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

            <div className="grid h-14 w-14 place-items-center rounded-lg bg-slate-950 text-white">
              <ImagePlus size={26} aria-hidden="true" />
            </div>
            <p className="mt-4 text-lg font-black tracking-tight">
              Drop image here or click to upload
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {fileSummary}
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Preview title="Original" imageUrl={originalUrl} />
            <Preview title="Transparent result" imageUrl={resultUrl} transparent />
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-teal-700">
                Image Studio
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Export Settings
              </h2>
            </div>
            <button
              type="button"
              onClick={clearImage}
              disabled={!file || busy}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Reset image"
              title="Reset image"
            >
              <RefreshCcw size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-6 space-y-5">
            <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <span>
                <span className="block text-sm font-black text-slate-950">
                  Optimize export
                </span>
                <span className="block text-xs font-medium text-slate-500">
                  Recompress after background removal
                </span>
              </span>
              <input
                type="checkbox"
                checked={optimize}
                disabled={busy}
                onChange={(event) => setOptimize(event.target.checked)}
                className="h-5 w-5 accent-teal-700"
              />
            </label>

            <label className="block text-sm font-black text-slate-950">
              Export format
              <select
                value={format}
                disabled={!optimize || busy}
                onChange={(event) => setFormat(event.target.value as OutputFormat)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 transition focus:border-teal-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="png">PNG - transparent</option>
                <option value="webp">WebP - compact</option>
                <option value="jpeg">JPEG - white background</option>
              </select>
            </label>

            <label className="block text-sm font-black text-slate-950">
              Quality: {quality}%
              <input
                type="range"
                min="80"
                max="100"
                value={quality}
                disabled={!optimize || busy}
                onChange={(event) => setQuality(Number(event.target.value))}
                className="mt-3 w-full accent-teal-700 disabled:opacity-40"
              />
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-black text-slate-950">Status</span>
                <span className="font-semibold text-slate-500">
                  {busy ? `${progress}%` : stage === "done" ? "Complete" : "Idle"}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-teal-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 min-h-10 text-sm font-medium leading-5 text-slate-600">
                {status}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <button
                type="button"
                onClick={processImage}
                disabled={!file || busy}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? (
                  <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                ) : (
                  <Wand2 size={18} aria-hidden="true" />
                )}
                {busy ? "Processing" : "Remove Background"}
              </button>

              <button
                type="button"
                onClick={downloadImage}
                disabled={!canDownload || busy}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Download size={18} aria-hidden="true" />
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Preview({
  title,
  imageUrl,
  transparent = false,
}: {
  title: string;
  imageUrl: string | null;
  transparent?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm font-black text-slate-900">
        <FileImage size={16} className="text-slate-500" aria-hidden="true" />
        {title}
      </div>
      <div
        className={`grid aspect-square min-h-[220px] place-items-center ${
          transparent
            ? "bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:22px_22px] bg-[position:0_0,0_11px,11px_-11px,-11px_0]"
            : "bg-slate-100"
        }`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <span className="px-3 text-center text-sm font-semibold text-slate-400">
            No image yet
          </span>
        )}
      </div>
    </div>
  );
}
