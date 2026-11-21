import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";

const built = await build({
  stdin: {
    contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { HashRouter } from "react-router-dom";
      import MCQPractice from "./src/pages/PYQs";
      createRoot(document.getElementById("root")).render(<HashRouter><MCQPractice /></HashRouter>);
    `,
    loader: "tsx",
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
  loader: { ".css": "empty" },
  plugins: [{
    name: "collection-initializers",
    setup(build) {
      for (const [file, label] of [["PYQBank", "Civil Services bank"], ["MechanicalPractice", "Mechanical collection"]]) {
        build.onLoad({ filter: new RegExp(`/pages/${file}\\.tsx$`) }, () => ({
          contents: `
            if (globalThis.offlineCivilBank && "${file}" === "PYQBank") throw new Error("Bank unavailable");
            globalThis.openedCollections = [...(globalThis.openedCollections ?? []), "${file}"];
            export default function Fixture({ collectionSwitch }) {
              return <header><h1>${label}</h1>{collectionSwitch}</header>;
            }
          `,
          loader: "tsx", resolveDir: process.cwd(),
        }));
      }
    },
  }],
});

async function waitForHeading(window, label) {
  const heading = () => window.document.querySelector("h1")?.textContent;
  for (let tries = 0; tries < 100 && heading() !== label; tries++) {
    await new Promise(resolve => setTimeout(resolve, 35));
  }
  assert.equal(heading(), label);
}

async function withRoute(path, run, offlineCivilBank = false) {
  const errors = [], console = new VirtualConsole();
  console.on("jsdomError", error => errors.push(String(error)));
  const dom = new JSDOM('<div id="root"></div>', {
    url: `https://example.test/upsc/#${path}`, runScripts: "outside-only",
    pretendToBeVisual: true, virtualConsole: console,
  });
  try {
    dom.window.offlineCivilBank = offlineCivilBank;
    dom.window.eval(built.outputFiles[0].text);
    await run(dom.window);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
}

await withRoute("/pyqs", async window => {
  await waitForHeading(window, "Civil Services bank");
  assert.deepEqual([...window.openedCollections], ["PYQBank"]);
  const links = window.document.querySelectorAll("header a");
  assert.equal(links.length, 1);
  const link = links[0];
  assert.equal(link.textContent.trim(), "Mechanical");
  assert.ok(link.classList.contains("small-btn"));
  assert.match(link.getAttribute("href"), /collection=mechanical$/);
  link.click();
  await waitForHeading(window, "Mechanical collection");
  assert.deepEqual([...window.openedCollections], ["PYQBank", "MechanicalPractice"]);
  const back = window.document.querySelector("header a");
  assert.equal(back.textContent.trim(), "Civil Services");
  back.click();
  await waitForHeading(window, "Civil Services bank");
});

await withRoute("/pyqs?collection=mechanical", async window => {
  await waitForHeading(window, "Mechanical collection");
  assert.deepEqual([...window.openedCollections], ["MechanicalPractice"]);
});

for (const path of ["/pyqs?section=papers", "/pyqs?collection=pyqs"]) {
  await withRoute(path, async window => {
    await waitForHeading(window, "Civil Services bank");
    assert.deepEqual([...window.openedCollections], ["PYQBank"]);
  });
}
await withRoute("/pyqs", async window => {
  for (let tries = 0; tries < 100 && !window.document.querySelector('[role="alert"]'); tries++) {
    await new Promise(resolve => setTimeout(resolve, 35));
  }
  assert.match(window.document.querySelector('[role="alert"]')?.textContent, /could not be opened/);
  window.document.querySelector("header a").click();
  await waitForHeading(window, "Mechanical collection");
  assert.deepEqual([...window.openedCollections], ["MechanicalPractice"]);
}, true);
console.log("MCQ Practice opens Civil Services directly. Its compact switch and existing links open the correct collection.");
