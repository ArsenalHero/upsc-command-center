import { cpSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "..");
if (
  !existsSync(resolve(root, "package.json")) ||
  JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile(resolve(root, "package.json"), "utf8"),
  ).name !== "upsc-command-center-pages"
) {
  throw new Error(
    "Run this publisher from the repository layout with the source project in app/.",
  );
}
for (const file of readdirSync(resolve(app, "dist")))
  cpSync(resolve(app, "dist", file), resolve(root, file), { recursive: true });
writeFileSync(resolve(root, ".nojekyll"), "");
console.log("GitHub Pages files updated at the repository root.");
