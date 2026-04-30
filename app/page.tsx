import BgRemover from "@/components/BgRemover";
import {
  BadgeCheck,
  Download,
  Image as ImageIcon,
  Lock,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

const workflowItems = [
  {
    icon: ImageIcon,
    title: "Upload",
    text: "Drop a product, portrait, or social image into the studio.",
  },
  {
    icon: Sparkles,
    title: "Remove",
    text: "Run browser-based background removal and preview the transparent cutout.",
  },
  {
    icon: SlidersHorizontal,
    title: "Optimize",
    text: "Choose PNG, WebP, or JPEG and tune the export quality.",
  },
  {
    icon: Download,
    title: "Export",
    text: "Download a clean file ready for listings, posts, or documents.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/88 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-950 text-white">
              <ImageIcon size={21} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black tracking-tight">
                PixelClean AI
              </p>
              <p className="truncate text-xs font-medium text-slate-500">
                Background remover and image optimizer
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm sm:flex">
            <Lock size={16} className="text-teal-700" aria-hidden="true" />
            Browser-first processing
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.42fr)_minmax(320px,0.58fr)] lg:px-8 lg:py-10">
        <div className="min-w-0">
          <div className="mb-6 max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-900">
              <BadgeCheck size={16} aria-hidden="true" />
              Professional image cleanup
            </div>
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Remove backgrounds and export cleaner images.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Upload an image, create a transparent cutout, optimize the final
              file, and download it in the format that fits your work.
            </p>
          </div>

          <BgRemover />
        </div>

        <aside className="space-y-4 lg:pt-[8.65rem]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft-panel">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-lg font-black tracking-tight">
                Production Flow
              </h2>
              <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-amber-900">
                Studio
              </span>
            </div>

            <div className="space-y-4">
              {workflowItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    className="grid grid-cols-[2.5rem_1fr] gap-3"
                    key={item.title}
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-800">
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {item.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-[#10201d] p-5 text-white shadow-soft-panel">
            <h2 className="text-lg font-black tracking-tight">
              Export Guidance
            </h2>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-200">
              <p>
                PNG keeps transparency and works best for logos, product photos,
                and overlays.
              </p>
              <p>
                WebP gives smaller files with strong visual quality for modern
                websites.
              </p>
              <p>
                JPEG flattens transparency to white for platforms that do not
                accept alpha channels.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
