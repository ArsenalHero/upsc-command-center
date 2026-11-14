import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData } from "../src/data/defaults";
import { validateData } from "../src/services/validation";
import { appearancePalettes, defaultAppearance, normalizeAppearance, preparationSettingsKey, selectedLandscape } from "../src/utils/appearance";

test("older backups gain plain appearance without changing preparation data", () => {
  const data = createEmptyData();
  delete data.settings.appearance;
  data.settings.theme = "dark";
  data.settings.dailyHours = 6.5;
  const subjects = JSON.stringify(data.subjects);
  validateData(data);
  assert.deepEqual(data.settings.appearance, defaultAppearance);
  assert.equal(data.settings.theme, "dark");
  assert.equal(data.settings.dailyHours, 6.5);
  assert.equal(JSON.stringify(data.subjects), subjects);
  const imported = validateData(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(imported.settings.appearance, defaultAppearance);
});

test("appearance rejects arbitrary URLs and bounds readability controls", () => {
  assert.deepEqual(normalizeAppearance({ palette: "unknown", wallpaper: 'https://example.test/track.jpg', visibility: 100, blur: -100, custom: true }), { ...defaultAppearance, visibility: 55, blur: 0 });
  assert.deepEqual(normalizeAppearance({ palette: "forest", wallpaper: "daily", visibility: NaN, blur: Infinity }), { ...defaultAppearance, palette: "forest", wallpaper: "daily" });
  assert.equal(normalizeAppearance({ visibility: -1, blur: 99 }).visibility, 10);
  assert.equal(normalizeAppearance({ blur: 99 }).blur, 12);
  assert.deepEqual(normalizeAppearance(null), defaultAppearance);
});

test("daily rotation is stable within a local date and advances across year boundaries", () => {
  const days = ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"];
  assert.equal(new Set(days.map(d => selectedLandscape("daily", d)?.id)).size, 4);
  assert.equal(selectedLandscape("daily", "2026-03-08")?.id, selectedLandscape("daily", "2026-03-08")?.id);
  assert.notEqual(selectedLandscape("daily", "2026-03-08")?.id, selectedLandscape("daily", "2026-03-09")?.id);
  assert.equal(selectedLandscape("forest")?.id, "forest");
  assert.equal(selectedLandscape("none"), undefined);
});

test("appearance autosave stays separate from unsaved preparation targets", () => {
  const settings = createEmptyData().settings;
  assert.equal(preparationSettingsKey(settings), preparationSettingsKey({ ...settings, theme: "dark", appearance: { palette: "rose", wallpaper: "coast", blur: 0, visibility: 55 } }));
  assert.notEqual(preparationSettingsKey(settings), preparationSettingsKey({ ...settings, dailyHours: 7 }));
});

const luminance = (hex: string) => {
  const values = hex.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
};
const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
test("palette text and primary buttons meet normal-text contrast in light and dark modes", () => {
  for (const palette of appearancePalettes) {
    assert.ok(contrast(palette.light[0], "#ffffff") >= 4.5, `${palette.name} light button`);
    assert.ok(contrast(palette.light[0], palette.light[2]) >= 4.5, `${palette.name} light link`);
    assert.ok(contrast(palette.dark[0], palette.dark[2]) >= 4.5, `${palette.name} dark link`);
  }
});
