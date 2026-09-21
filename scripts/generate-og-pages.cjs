const fs = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "..", "dist");
const BASE_URL = "https://medicetamol.github.io";
const IMAGE = `${BASE_URL}/og-image.jpg`;

const PAGES = [
  {
    route: "custom/module",
    title: "mediCetamol",
    description:
      "Solve this shared Custom PYQ module on mediceTaMol. Let's do it together.",
  },
];

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const source = path.join(DIST, "index.html");
if (!fs.existsSync(source)) {
  console.error("generate-og-pages: dist/index.html not found. Run the build first.");
  process.exit(1);
}
const template = fs.readFileSync(source, "utf8");

// Swap the content="" of an existing tag, matched by its name/property attribute.
function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`);
  if (!re.test(html)) {
    console.warn(`generate-og-pages: <meta ${attr}="${key}"> not found in index.html`);
    return html;
  }
  return html.replace(re, `$1${esc(value)}$2`);
}

for (const page of PAGES) {
  const url = `${BASE_URL}/${page.route}`;
  let html = template;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`);
  html = setMeta(html, "name", "description", page.description);
  html = setMeta(html, "property", "og:title", page.title);
  html = setMeta(html, "property", "og:description", page.description);
  html = setMeta(html, "property", "og:url", url);
  html = setMeta(html, "property", "og:image", IMAGE);
  html = setMeta(html, "name", "twitter:title", page.title);
  html = setMeta(html, "name", "twitter:description", page.description);
  html = setMeta(html, "name", "twitter:image", IMAGE);

  const outDir = path.join(DIST, page.route);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  console.log(`generate-og-pages: wrote dist/${page.route}/index.html`);
}
