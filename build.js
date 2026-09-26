/**
 * Build what the browser actually loads. Run:
 *
 *   npm install      (once, for the tools)
 *   node build.js
 *
 * after changing any stylesheet or script, then commit the result —
 * the source, assets/ and the pages together.
 *
 * The code is written as many small files, which is how it should stay:
 * one file per thing, easy to find and to change. The browser gets few.
 *
 *   Styles   The two dozen stylesheets become one (bundle.css), because
 *            CSS @import is serial and cost ~300ms before a rule applied.
 *
 *   Scripts  The fifty-odd modules, and the Supabase library that came
 *            from esm.sh, become one file for the shop and one for the
 *            owner's panel. Every one of those fifty was a request to
 *            Vercel on every page, even when the browser already had it.
 *
 *   Names    Each file is named after its contents (storefront-3F9A2C.js).
 *            A change is a new name, so vercel.json lets browsers keep
 *            these for a year, and the pages — which are checked every
 *            time — point at the new name the moment it exists. Nobody
 *            gets half an old version and half a new one.
 *
 *   Caching  vercel.json: assets/ and fonts for a year (a change is a new
 *            name), the site's own pictures under images/ for a week. The
 *            pages are checked on every visit. Product photos come from
 *            img.alarafahsupershop.com and /api/shop sets its own caching,
 *            so prices, stock and photos are untouched by any of this.
 *            Replacing a picture under images/ with the same name takes
 *            up to a week to be seen — give the new one a new name.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const esbuild = require("esbuild");

const OUT = "assets";                 // everything the pages load, fingerprinted

/* ------------------------------ styles -------------------------------- */

const SRC = "src/storefront/styles";
const ENTRY = path.join(SRC, "main.css");
const BUNDLE = path.join(SRC, "bundle.css");

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

fs.writeFileSync(BUNDLE, header + parts.join("\n"));
console.log(`  ${files.length} stylesheets -> ${BUNDLE}`);

/* ------------------------------ scripts ------------------------------- */

/* The source still imports these two libraries from their CDNs, so it
   runs unbuilt as well. Here those addresses are pointed at the same
   versions installed by npm, and bundled in. */
const REMOTE = {
  "https://esm.sh/@supabase/supabase-js@2": "@supabase/supabase-js",
  "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/modular/sortable.esm.js":
    "sortablejs/modular/sortable.esm.js",
};

const fromNpm = {
  name: "remote-to-npm",
  setup(build){
    build.onResolve({ filter: /^https:\/\// }, async args => {
      const pkg = REMOTE[args.path];
      if (!pkg) return { errors: [{ text: `Not bundled, add it to REMOTE in build.js: ${args.path}` }] };
      return build.resolve(pkg, { kind: args.kind, resolveDir: __dirname });
    });
  },
};

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });

  /* One file per side, nothing split off. With chunks, every module the
     code loads only when needed (the database library, the owner's
     sorting) became a file of its own, and a page asked for five or six.
     Inlined, a page asks for one. The shop and the panel share some code;
     each simply carries its own copy. */
  const entryOut = {};
  for (const [name, file] of Object.entries({
    storefront: "src/storefront/main.js",
    admin:      "src/admin/main.js",
  })){
    const result = await esbuild.build({
      entryPoints: { [name]: file },
      bundle: true,
      format: "esm",
      target: "es2020",
      minify: true,
      sourcemap: "linked",    // errors still name the original file and line
      outdir: OUT,
      entryNames: "[name]-[hash]",
      metafile: true,
      legalComments: "none",
      plugins: [fromNpm],
      logLevel: "error",      // the i18n files' repeated keys are old and harmless
    });
    const out = Object.keys(result.metafile.outputs).find(f => f.endsWith(".js"));
    entryOut[name] = { file: "/" + out, preload: [] };
  }

  /* ------------------------ fingerprinted css ------------------------- */

  const hashed = (src, name) => {
    const body = fs.readFileSync(src);
    const h = crypto.createHash("sha256").update(body).digest("hex").slice(0, 8).toUpperCase();
    const file = `${OUT}/${name}-${h}.css`;
    fs.writeFileSync(file, body);
    return "/" + file;
  };
  const siteCss  = hashed(BUNDLE, "site");
  const adminCss = hashed("src/admin/styles/admin.css", "admin");

  /* ---------------------------- the pages ----------------------------- */

  const tags = name => {
    const e = entryOut[name];
    return [
      ...e.preload.map(p => `<link rel="modulepreload" href="${p}">`),
      `<script type="module" src="${e.file}"></script>`,
    ].join("\n");
  };

  /* Each page's script tag (and the preloads written with it last time)
     is replaced whole; each stylesheet link, by what it points at. The
     patterns match both the source paths and an earlier build's names,
     so building twice changes nothing but the names. */
  const SCRIPT = /(?:<link rel="modulepreload" href="\/assets\/[^"]+">\n)*<script type="module" src="(?:\/assets\/(storefront|admin)-[A-Z0-9]+\.js|src\/(storefront|admin)\/main\.js)"><\/script>/g;

  const pages = fs.readdirSync(".").filter(f => f.endsWith(".html"));
  let changed = 0;

  for (const page of pages){
    const before = fs.readFileSync(page, "utf8");
    let html = before.replace(SCRIPT, (_, a, b) => tags(a || b));
    html = html
      .replace(/href="(?:src\/storefront\/styles\/(?:bundle|main)\.css|\/assets\/site-[A-Z0-9]+\.css)"/g,
               `href="${siteCss}"`)
      .replace(/href="(?:src\/admin\/styles\/admin\.css|\/assets\/admin-[A-Z0-9]+\.css)"/g,
               `href="${adminCss}"`);
    if (html !== before){ fs.writeFileSync(page, html); changed++; }
  }

  /* -------------------------------------------------------------------- */

  const kb = f => (fs.statSync(f).size / 1024).toFixed(0);
  for (const [name, e] of Object.entries(entryOut))
    console.log(`  ${name} script -> ${e.file} (${kb(e.file.slice(1))} KB, one request)`);
  console.log(`  styles  -> ${siteCss}, ${adminCss}`);
  console.log(`  ${changed} of ${pages.length} pages pointed at the new names`);
})().catch(err => { console.error(err.message || err); process.exit(1); });
