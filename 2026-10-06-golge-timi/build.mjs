// Gölge Timi — tek dosyalık sürüm üretir.
//   node 2026-10-06-golge-timi/build.mjs                 → dist/golge-timi.html (tam belge)
//   node 2026-10-06-golge-timi/build.mjs --fragment out  → yayın için iskeletsiz sayfa
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "style.css"), "utf8");

const start = html.indexOf("<!--GT-BODY-START-->");
const end = html.indexOf("<!--GT-BODY-END-->");
if (start < 0 || end < 0) throw new Error("index.html gövde işaretleri bulunamadı");
let body = html.slice(start + "<!--GT-BODY-START-->".length, end);

// Yerel betikleri sırasıyla birleştir, CDN betiğini koru
const scripts = [...body.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
const bundle = scripts.map((s) => `// ---- ${s} ----\n` + readFileSync(join(root, s), "utf8")).join("\n");
body = body.replace(/<script src="js\/[^"]+"><\/script>\n?/g, "");
const safeBundle = bundle.replace(/<\/script/gi, "<\\/script");
body = body.replace("<!--GT-BODY-END-->", "") + `<script>\n${safeBundle}\n</script>\n`;

const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&family=Silkscreen:wght@400;700&family=VT323&display=swap">';
const title = "<title>Gölge Timi</title>";

const fragIdx = process.argv.indexOf("--fragment");
if (fragIdx > 0) {
  const out = process.argv[fragIdx + 1];
  writeFileSync(out, `${title}\n<style>\n${css}\n</style>\n${fonts}\n${body}`);
  console.log("yazıldı:", out);
} else {
  mkdirSync(join(root, "dist"), { recursive: true });
  const out = join(root, "dist", "golge-timi.html");
  const head = html.slice(0, html.indexOf("<body>")).replace(/<link rel="stylesheet" href="style.css">/, `<style>\n${css}\n</style>`);
  writeFileSync(out, `${head}<body>\n${body}</body>\n</html>\n`);
  console.log("yazıldı:", out);
}
