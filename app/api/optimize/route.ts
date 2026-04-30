import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

const allowedFormats = new Set(["png", "webp", "jpeg"]);
// This limit applies to the cutout blob posted from the client after background removal.
// A small source image can still produce a much larger transparent PNG.
const maxUploadBytes = 120 * 1024 * 1024;

function clampQuality(value: number) {
  if (!Number.isFinite(value)) {
    return 92;
  }

  return Math.min(100, Math.max(80, Math.round(value)));
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    const requestedFormat = String(formData.get("format") || "png").toLowerCase();
    const format = allowedFormats.has(requestedFormat) ? requestedFormat : "png";
    const quality = clampQuality(Number(formData.get("quality") || 92));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image uploads are supported." },
        { status: 415 },
      );
    }

    if (file.size > maxUploadBytes) {
      return NextResponse.json(
        { error: "Processed image is too large for optimization (max 120 MB)." },
        { status: 413 },
      );
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const image = sharp(inputBuffer, { failOn: "none" }).rotate();

    let output: Buffer;
    let contentType = "image/png";

    if (format === "webp") {
      output = await image.webp({ quality, effort: 6 }).toBuffer();
      contentType = "image/webp";
    } else if (format === "jpeg") {
      output = await image
        .flatten({ background: "#ffffff" })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      contentType = "image/jpeg";
    } else {
      output = await image
        .png({ compressionLevel: 9, adaptiveFiltering: true, quality })
        .toBuffer();
    }

    return new NextResponse(new Uint8Array(output), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Image optimization failed." },
      { status: 500 },
    );
  }
}
