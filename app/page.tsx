import BgRemover from "@/components/BgRemover";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BadgeCheck,
  Brush,
  Download,
  Image as ImageIcon,
  Layers3,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const studioItems = [
  {
    icon: Sparkles,
    title: "AI Cutout",
    text: "Transparent results with export-ready PNG, WebP, or JPEG output.",
  },
  {
    icon: Brush,
    title: "Area Restore",
    text: "Brush original background details back into selected parts of the image.",
  },
  {
    icon: Layers3,
    title: "Preview Backdrops",
    text: "Inspect edges on checker, light, dark, and brand-color surfaces.",
  },
  {
    icon: Download,
    title: "Optimized Export",
    text: "Tune quality and compression before downloading the finished file.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ImageIcon size={21} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">PixelClean AI</p>
              <p className="truncate text-xs font-medium text-muted-foreground">
                Background remover and production editor
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground shadow-sm sm:flex">
            <Lock size={16} className="text-primary" aria-hidden="true" />
            Browser-first processing
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.44fr)_minmax(310px,0.56fr)] lg:px-8 lg:py-8">
        <div className="min-w-0">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <Badge variant="success" className="mb-3 gap-2">
                <BadgeCheck size={14} aria-hidden="true" />
                Production studio
              </Badge>
              <h1 className="text-4xl font-semibold leading-tight text-foreground">
                Remove backgrounds, restore edges, export polished images.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                A focused editing workspace for product shots, portraits, social
                posts, and listing assets.
              </p>
            </div>

            <Badge variant="outline" className="w-fit gap-2 bg-card">
              <ShieldCheck size={14} aria-hidden="true" />
              Private by default
            </Badge>
          </div>

          <BgRemover />
        </div>

        <aside className="space-y-4 lg:pt-[7.4rem]">
          <Card>
            <CardHeader>
              <CardTitle>Studio Controls</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {studioItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    className="grid grid-cols-[2.5rem_1fr] gap-3"
                    key={item.title}
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-secondary-foreground">
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">
                        {item.title}
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-black/20 bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-white">Export Notes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6">
              <p>
                PNG preserves transparent pixels for overlays and product shots.
              </p>
              <p>WebP keeps file size low for modern web surfaces.</p>
              <p>
                JPEG flattens transparency to white for stricter upload portals.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}
