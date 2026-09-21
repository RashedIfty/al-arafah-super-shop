/**
 * Build the stylesheet the browser actually loads.
 *
 * The styles are written as two dozen small files, which is how they
 * should stay: one file per thing, easy to find and to change. But CSS
 * @import is serial — the browser fetches main.css, reads it, and only
 * then starts on the rest, one round trip at a time. On the live site
 * that cost roughly 300ms before a single rule applied.
 *
 * So the source keeps its files and the browser gets one. Run:
 *
 *   node build.js
 *
 * after changing any stylesheet, then commit the result.
 */
const fs = require("fs");
const path = require("path");

const SRC = "src/storefront/styles";
const ENTRY = path.join(SRC, "main.css");
const OUT = path.join(SRC, "bundle.css");

const entry = fs.readFileSync(ENTRY, "utf8");

// Order matters: tokens before the rules that use them, responsive last.
const files = [...entry.matchAll(/@import\s+url\("([^"]+)"\)/g)].map(m => m[1]);

if (!files.length){
  console.error("No @import lines found in", ENTRY);
  process.exit(1);
}

const parts = files.map(rel => {
  const file = path.join(SRC, rel);
  if (!fs.existsSync(file)){
    console.error("Missing:", file);
    process.exit(1);
  }
  return `/* ===== ${rel} ===== */\n${fs.readFileSync(file, "utf8").trim()}\n`;
});

const header = `/* Built by build.js — do not edit.
   Change the files under ${SRC}/ and run: node build.js
   ${files.length} files, in import order. */\n\n`;

fs.writeFileSync(OUT, header + parts.join("\n"));

const before = files.reduce((n, f) => n + fs.statSync(path.join(SRC, f)).size, 0);
const after = fs.statSync(OUT).size;

console.log(`  ${files.length} files -> ${OUT}`);
console.log(`  ${(after / 1024).toFixed(0)} KB in one request instead of ${files.length + 1} requests`);
