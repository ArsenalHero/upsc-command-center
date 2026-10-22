import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { renderServiceWorker } from "./service-worker.mjs";

// Follow static imports only. PYQs owns the large question/explanation library.
export function coreChunks(manifest) {
  const files = new Set(), visited = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing offline dependency: ${key}`);
    files.add(`./${chunk.file}`);
    for (const file of [...(chunk.css || []), ...(chunk.assets || [])]) files.add(`./${file}`);
    for (const dependency of chunk.imports || []) visit(dependency);
  }
  for (const [key, chunk] of Object.entries(manifest)) {
    if (chunk.isEntry || chunk.isDynamicEntry && ((key.startsWith("src/pages/") || chunk.name === "MockLab") && key !== "src/pages/PYQs.tsx" || key.startsWith("node_modules/"))) visit(key);
  }
  if ([...files].some(file => /\/(?:questions-|question-support-)/.test(file))) throw new Error("A core page eagerly imports the question library.");
  return [...files].sort();
}

export function generateServiceWorker(directory = "dist") {
  const manifest = JSON.parse(readFileSync(`${directory}/build-manifest.json`, "utf8"));
  const assets = readdirSync(`${directory}/assets`).map(file => `./assets/${file}`);
  const figures = existsSync(`${directory}/paper-figures`) ? readdirSync(`${directory}/paper-figures`).filter(file => /\.(png|svg|webp)$/i.test(file)).map(file => `./paper-figures/${file}`) : [];
  const wallpapers = existsSync(`${directory}/wallpapers`) ? readdirSync(`${directory}/wallpapers`).filter(file => /\.webp$/i.test(file)).map(file => `./wallpapers/${file}`) : [];
  for (const file of wallpapers) {
    const bytes = readFileSync(`${directory}/${file.slice(2)}`);
    if (bytes.length < 12 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") throw new Error(`Invalid wallpaper: ${file}`);
  }
  const icons = ["./favicon.svg", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./brand/logo-mark.webp", "./favicon-v2.png", "./apple-touch-icon-v2.png", "./icon-maskable-512-v2.png"];
  const files = ["./", "./index.html", ...icons, ...coreChunks(manifest), ...wallpapers];
  const cacheable = [...new Set([...icons, ...assets, ...figures, ...wallpapers])];
  const digest = createHash("sha256").update("selective-offline-v2");
  let bytes = 0;
  for (const file of files) {
    const content = readFileSync(`${directory}/${file === "./" ? "index.html" : file.slice(2)}`);
    digest.update(file).update(content);
    if (file !== "./") bytes += content.length;
  }
  const cacheName = `upsc-static-${digest.digest("hex").slice(0, 12)}`;
  writeFileSync(`${directory}/sw.js`, renderServiceWorker(cacheName, files, cacheable));
  console.log(`Offline shell generated: ${files.length} precached assets · ${(bytes / 1024 / 1024).toFixed(2)} MiB. Question banks cache on first use.`);
  return { cacheName, files, cacheable, bytes };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) generateServiceWorker();
