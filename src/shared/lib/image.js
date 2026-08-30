/**
 * Shrink a photo before it is uploaded.
 *
 * A picture straight off a phone is 3-5 MB and around 4000px wide. The
 * shop never shows one larger than a few hundred pixels, so almost all
 * of that weight is thrown away by the browser on every page load. We
 * resize and re-encode first: the storage lasts far longer and the shop
 * loads much faster on mobile data.
 *
 * Everything happens in the owner's browser. Nothing extra is sent.
 */
import { stamp } from "../ui/watermark.js";

/** Longest edge we keep. Product cards show well under this. */
const MAX_EDGE = 1000;

/** What we aim for. Quality drops until the file fits, within reason. */
const TARGET_BYTES = 100 * 1024;

/** Below this the picture starts to look poor; we stop rather than go on. */
const MIN_QUALITY = 0.45;

/** Quality to start from, and how much to drop per attempt. */
const START_QUALITY = 0.82;
const QUALITY_STEP = 0.1;

/**
 * True when the file is something we should not touch.
 *
 * SVG is already tiny and would be rasterised — turning a sharp logo
 * into a blurry bitmap. GIF may be animated, and drawing it to a canvas
 * keeps only the first frame.
 */
function leaveAlone(file){
  return file.type === "image/svg+xml" || file.type === "image/gif";
}

/** Scaled size that fits inside `edge`, keeping the shape. */
function fitted(w, h, edge = MAX_EDGE){
  const longest = Math.max(w, h);
  if (longest <= edge) return { w, h };
  const scale = edge / longest;
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

/** Decode a file into something we can draw. */
async function decode(file){
  // createImageBitmap is faster and handles EXIF rotation, but is missing
  // on older Safari, so fall back to an <img> and an object URL.
  if (typeof createImageBitmap === "function"){
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch { /* fall through to the <img> path */ }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read that image"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Canvas to Blob as a promise, since the callback form is awkward here. */
function toBlob(canvas, type, quality){
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

/**
 * Resize and re-encode, returning a File ready to upload.
 *
 * Falls back to the original whenever anything is off — an unusual
 * format, a decode failure, or a result that came out no smaller.
 * A slightly heavy photo is a much better outcome than a failed upload.
 */
export async function shrinkImage(file){
  if (!file || !file.type?.startsWith("image/")) return file;
  if (leaveAlone(file)) return file;

  let source;
  try {
    source = await decode(file);
  } catch {
    return file;
  }

  const sw = source.width, sh = source.height;
  if (!sw || !sh) return file;

  // Try at full size first. A busy picture — dense detail, or a
  // screenshot full of text — can stay over target even at low quality,
  // so if lowering quality is not enough we step the size down and try
  // again. 100KB is a tight target, so there are three rungs.
  let out = null;

  for (const edge of [MAX_EDGE, 820, 640]){
    const { w, h } = fitted(sw, sh, edge);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // A white bed under the photo: a transparent PNG would otherwise turn
    // black once it is flattened into a JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, w, h);

    // The shop's mark, while the photo is already on a canvas.
    await stamp(canvas);

    // Step the quality down until it fits. Most photos land on the first
    // try; the loop is for the occasional dense one.
    for (let q = START_QUALITY; q >= MIN_QUALITY - 0.001; q -= QUALITY_STEP){
      const blob = await toBlob(canvas, "image/jpeg", q);
      if (!blob) break;
      out = blob;
      if (blob.size <= TARGET_BYTES) break;
    }

    if (out && out.size <= TARGET_BYTES) break;
  }

  source.close?.();                     // release the bitmap where supported

  // Nothing gained: a small picture re-encoded can come out larger.
  if (!out || out.size >= file.size) return file;

  const base = (file.name || "photo").replace(/\.[^.]+$/, "");
  return new File([out], `${base}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/** "2.4 MB" — for telling the owner what happened. */
export function fileSize(bytes){
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
