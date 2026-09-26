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
 *            the host on every page, even when the browser already had it.
 *
 *   Names    Each file is named after its contents (storefront-3F9A2C.js).
 *            A change is a new name, so _headers lets browsers keep
 *            these for a year, and the pages — which are checked every
 *            time — point at the new name the moment it exists. Nobody
 *            gets half an old version and half a new one.
 *
 *   Caching  _headers: assets/ and fonts for a year (a change is a new
 *            name), the site's own pictures under images/ for a week. The
 *            pages are checked on every visit. Product photos come from
 *            img.alarafahsupershop.com and /api/shop sets its own caching,
 *            so prices, stock and photos are untouched by any of this.
 *            Replacing a picture under images/ with the same name takes
 *            up to a week to be seen — give the new one a new name.
 *
 *   Security _headers also carries the Content-Security-Policy. Its
 *            list of allowed hosts is kept below; the hash of every
 *            inline <script> in the pages is worked out on each build
 *            and written in, so a change to one is never blocked.
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
      /* Maps are written next to each bundle (assets/*.map) so an error
         can still be traced to the original file and line here, but the
         bundle does not point at them and .assetsignore keeps them off
         the site: the published code stays minified, and nobody is
         handed the readable source of the owner's panel for free. */
      sourcemap: "external",
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

  /* ---------------------- content security policy --------------------- */

  /* The policy the browser enforces on every page, sent from _headers.
     Only what the site really loads is allowed, so an injected script or
     a stolen-data beacon to some other host is refused by the browser.

     The pages keep a few small inline <script> blocks (the early shop
     fetch, the splash skip, the owner's two listeners). Rather than allow
     inline script in general, each block is allowed by the SHA-256 of its
     exact text, worked out below from the pages as built. Change a block
     and the next build writes the new hash, so the two cannot drift
     apart; a block not listed here simply does not run.

     Inline event attributes (onclick="...") are never allowed. Use
     addEventListener in the modules instead. */
  const inlineHashes = new Set();
  for (const page of pages){
    const html = fs.readFileSync(page, "utf8");
    for (const [, attrs = "", body] of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
      if (/\ssrc\s*=/i.test(attrs)) continue;
      // The HTML parser turns CR LF into LF before the browser hashes it.
      const text = body.replace(/\r\n?/g, "\n");
      inlineHashes.add(`'sha256-${crypto.createHash("sha256").update(text, "utf8").digest("base64")}'`);
    }
  }

  const SUPABASE = "fkftvudfngcmrtylevnl.supabase.co";
  const CSP = {
    "default-src": ["'self'"],
    // The bundles, the inline blocks above, and Cloudflare Web Analytics,
    // which Cloudflare adds to every page it serves.
    "script-src":  ["'self'", ...[...inlineHashes].sort(), "https://static.cloudflareinsights.com"],
    // Inline style is left allowed: the modules set style="..." on
    // elements throughout, and styles cannot run code.
    "style-src":   ["'self'", "'unsafe-inline'"],
    // Product photos (R2 and older ones in Supabase storage), plus the
    // data: and blob: pictures the photo tools make in the browser.
    "img-src":     ["'self'", "data:", "blob:", "https://img.alarafahsupershop.com", `https://${SUPABASE}`],
    "font-src":    ["'self'"],
    // The database and its live updates, the photo upload Worker, and
    // Web Analytics' report. data: because the owner's panel turns a
    // photo held as text back into a file with fetch() before upload.
    "connect-src": ["'self'", "data:", `https://${SUPABASE}`, `wss://${SUPABASE}`,
                    "https://alarafah-photos.alarafah.workers.dev", "https://cloudflareinsights.com"],
    // The Google map on the contact and home pages.
    "frame-src":   ["https://www.google.com", "https://maps.google.com"],
    "frame-ancestors": ["'none'"],
    "base-uri":    ["'self'"],
    "form-action": ["'self'"],
    "object-src":  ["'none'"],
  };
  const policy = Object.entries(CSP).map(([k, v]) => `${k} ${v.join(" ")}`).join("; ");
  // Cloudflare silently skips a _headers line over 2,000 characters,
  // which would leave the site with no policy at all. Stop instead.
  if (policy.length > 1900){
    console.error(`Content-Security-Policy is ${policy.length} characters; Cloudflare's limit is 2000 per line`);
    process.exit(1);
  }

  /* Written into _headers between the two marker lines, replacing
     whatever the last build put there. Everything else in _headers is
     edited by hand. */
  const START = "  # >>> Content-Security-Policy: written by build.js, do not edit here";
  const END   = "  # <<< end of build.js section";
  const headersFile = "_headers";
  const headersBefore = fs.readFileSync(headersFile, "utf8");
  const a = headersBefore.indexOf(START), b = headersBefore.indexOf(END);
  if (a < 0 || b < a){
    console.error(`${headersFile}: the Content-Security-Policy markers are missing`);
    process.exit(1);
  }
  const headersAfter = headersBefore.slice(0, a) +
    `${START}\n  Content-Security-Policy: ${policy}\n` + headersBefore.slice(b);
  if (headersAfter !== headersBefore) fs.writeFileSync(headersFile, headersAfter);

  /* -------------------------------------------------------------------- */

  const kb = f => (fs.statSync(f).size / 1024).toFixed(0);
  for (const [name, e] of Object.entries(entryOut))
    console.log(`  ${name} script -> ${e.file} (${kb(e.file.slice(1))} KB, one request)`);
  console.log(`  styles  -> ${siteCss}, ${adminCss}`);
  console.log(`  ${changed} of ${pages.length} pages pointed at the new names`);
  console.log(`  ${inlineHashes.size} inline scripts allowed by hash -> _headers`);
})().catch(err => { console.error(err.message || err); process.exit(1); });
