import { useId, useState, type CSSProperties } from "react";
import { Check, Download, Expand, Heart, Image, Monitor, Moon, Palette, Pause, Play, RotateCcw, Shuffle, Sun } from "lucide-react";
import { useData } from "../hooks/useData";
import { useAppearance } from "../hooks/useAppearance";
import { appearancePalettes, defaultAppearance, landscapeWallpapers } from "../utils/appearance";
import type { AppearanceSettings as AppearanceType, Settings } from "../types";
import { Modal } from "./ui";

export function AppearanceSettings({ compact = false }: { compact?: boolean }) {
  const { data, updateAppearance } = useData();
  const { appearance, wallpaper, resolvedTheme } = useAppearance(data.settings);
  const [status, setStatus] = useState("");
  const [gallery, setGallery] = useState<"all" | "favourites">("all");
  const [preview, setPreview] = useState<(typeof landscapeWallpapers)[number]>();
  const favourites = appearance.favourites || [];
  const scenes = landscapeWallpapers.filter(w => gallery === "all" || favourites.includes(w.id));
  const id = useId();
  const apply = (patch: Partial<AppearanceType>, mode?: Settings["theme"]) => {
    setStatus(updateAppearance(patch, mode) ? "Appearance saved." : "Could not save. Please try again.");
  };
  const palette = appearancePalettes.find(p => p.id === appearance.palette)!;
  const dark = resolvedTheme === "dark";
  const colours = dark ? palette.dark : palette.light;
  const previewStyle = {
    "--preview-accent": colours[0], "--preview-soft": colours[1], "--preview-bg": colours[2],
    "--preview-image": wallpaper && !appearance.paused ? `url("${wallpaper.thumbnail}")` : "none",
    "--preview-visibility": appearance.visibility / 100, "--preview-blur": `${Math.min(appearance.blur, 6)}px`,
    "--preview-position": appearance.position || "center",
  } as CSSProperties;
  return <section className={`appearance-settings ${compact ? "appearance-compact" : "card"}`} aria-labelledby={`${id}-title`}>
    <div className="appearance-heading"><div><span className="eyebrow"><Palette size={14} />MAKE IT YOURS</span><h2 id={`${id}-title`}>Themes & wallpapers</h2><p>A calmer space for your preparation. Changes apply and save immediately.</p></div>
      <button type="button" className="text-btn appearance-reset" onClick={() => apply(defaultAppearance, "light")}><RotateCcw size={14} />Reset appearance</button>
    </div>
    <fieldset className="appearance-fieldset"><legend>Display mode</legend><div className="theme-options">
      {(["light", "dark", "system"] as const).map((mode, index) => { const Icon = [Sun, Moon, Monitor][index]; return <label key={mode} className={data.settings.theme === mode ? "selected" : ""}>
        <input type="radio" name={`theme-${id}`} value={mode} checked={data.settings.theme === mode} onChange={() => apply({}, mode)} /><Icon size={18} />{mode === "system" ? "Follow device" : mode === "light" ? "Light" : "Dark"}
      </label>; })}
    </div></fieldset>
    <fieldset className="appearance-fieldset"><legend>Colour theme</legend><div className="appearance-palettes">
      {appearancePalettes.map(p => <button type="button" key={p.id} aria-label={`${p.name} theme`} aria-pressed={appearance.palette === p.id} className={`appearance-palette ${appearance.palette === p.id ? "selected" : ""}`} onClick={() => apply({ palette: p.id })}>
        <span className="palette-swatch" style={{ background: p.light[2], borderColor: p.light[0] }}><i style={{ background: p.light[0] }} /><i style={{ background: p.dark[0] }} /><i style={{ background: p.light[1] }} /></span><strong>{p.name}</strong><small>{p.description}</small>{appearance.palette === p.id && <Check size={14} className="appearance-check" />}
      </button>)}
    </div></fieldset>
    <div className={`appearance-preview ${dark ? "dark" : ""}`} style={previewStyle} aria-label={`Preview: ${palette.name}, ${dark ? "dark" : "light"} mode, ${wallpaper?.name || "plain background"}`}>
      <div className="appearance-preview-landscape" /><div className="appearance-preview-content"><span className="appearance-preview-kicker">YOUR STUDY SPACE</span><strong>Make room for focus.</strong><span>{wallpaper?.name || "A clean, quiet background"}</span><div className="preview-mini-cards" aria-hidden="true"><span><i />Today's plan<b /></span><span><i />Your progress<b /></span><span><i />Next revision<b /></span></div></div>
    </div>
    <fieldset className="appearance-fieldset"><legend>Natural landscape wallpapers</legend><div className="wallpaper-gallery-toolbar"><p className="appearance-note">Preview a scene, save your favourites, or let them rotate daily.</p><div className="learning-segments" aria-label="Wallpaper gallery filter"><button type="button" aria-pressed={gallery === "all"} onClick={() => setGallery("all")}>All landscapes</button><button type="button" aria-pressed={gallery === "favourites"} onClick={() => setGallery("favourites")}><Heart size={14} />Favourites ({favourites.length})</button></div></div><div className="appearance-wallpapers">
      <button type="button" className={`wallpaper-choice ${appearance.wallpaper === "none" ? "selected" : ""}`} aria-pressed={appearance.wallpaper === "none"} aria-label="Plain background" onClick={() => apply({ wallpaper: "none" })}><span className="wallpaper-art wallpaper-plain"><Image size={25} /><span>Keep it simple</span></span><span className="wallpaper-caption"><strong>Plain background</strong><small>Just your colour theme</small></span>{appearance.wallpaper === "none" && <Check size={17} className="appearance-check" />}</button>
      <button type="button" className={`wallpaper-choice ${appearance.wallpaper === "daily" ? "selected" : ""}`} aria-pressed={appearance.wallpaper === "daily"} aria-label="Rotate landscape daily" onClick={() => apply({ wallpaper: "daily", paused: false })}><span className="wallpaper-art wallpaper-daily"><img src={(wallpaper || landscapeWallpapers[3]).thumbnail} alt="" loading="lazy" width="320" height="180" /><span><Shuffle size={22} />A fresh view daily</span></span><span className="wallpaper-caption"><strong>Daily landscape</strong><small>{favourites.length ? `Rotates ${favourites.length} favourite${favourites.length === 1 ? "" : "s"}` : `Rotates all ${landscapeWallpapers.length} landscapes`}</small></span>{appearance.wallpaper === "daily" && <Check size={17} className="appearance-check" />}</button>
      {scenes.map(w => <div key={w.id} className={`wallpaper-choice wallpaper-scene ${appearance.wallpaper === w.id ? "selected" : ""}`}><button type="button" className="wallpaper-select" aria-label={`${w.name} wallpaper`} aria-pressed={appearance.wallpaper === w.id} onClick={() => apply({ wallpaper: w.id, paused: false })}><span className="wallpaper-art"><img src={w.thumbnail} alt="" loading="lazy" width="320" height="180" /></span><span className="wallpaper-caption"><strong>{w.name}</strong><small>{w.description}</small></span>{appearance.wallpaper === w.id && <Check size={17} className="appearance-check" />}</button><div className="wallpaper-scene-actions"><button type="button" className="wallpaper-favourite" aria-label={`Favourite ${w.name}`} aria-pressed={favourites.includes(w.id)} onClick={() => apply({ favourites: favourites.includes(w.id) ? favourites.filter(id => id !== w.id) : [...favourites, w.id] })}><Heart size={16} fill={favourites.includes(w.id) ? "currentColor" : "none"} /></button><button type="button" className="text-btn" aria-label={`Preview ${w.name}`} onClick={() => setPreview(w)}><Expand size={14} />Preview</button></div></div>)}
    </div>{gallery === "favourites" && !favourites.length && <p className="wallpaper-empty">Tap a heart in All landscapes to build your favourites. Daily rotation uses your favourites automatically.</p>}</fieldset>
    {wallpaper && <div className="wallpaper-quick-controls"><div><strong>{appearance.paused ? "Wallpaper paused" : wallpaper.name}</strong><small>{appearance.wallpaper === "daily" ? "Today's landscape · changes with your local date" : "Your chosen landscape"}</small></div><button type="button" className="btn secondary small-btn" onClick={() => apply({ paused: !appearance.paused })}>{appearance.paused ? <Play size={15} /> : <Pause size={15} />}{appearance.paused ? "Resume wallpaper" : "Pause wallpaper"}</button></div>}
    {wallpaper && <div className="wallpaper-presets"><span>Readability</span><div className="learning-segments">{[{ name: "Calm", visibility: 25, blur: 4 }, { name: "Balanced", visibility: 40, blur: 2 }, { name: "Clear", visibility: 55, blur: 0 }].map(p => <button type="button" key={p.name} aria-label={`${p.name} wallpaper preset`} aria-pressed={appearance.visibility === p.visibility && appearance.blur === p.blur} onClick={() => apply({ visibility: p.visibility, blur: p.blur })}>{p.name}</button>)}</div><label>Crop focus<select aria-label="Wallpaper crop focus" value={appearance.position || "center"} onChange={e => apply({ position: e.target.value as AppearanceType["position"] })}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label></div>}
    {wallpaper && <div className="appearance-tuning"><div className="appearance-sliders"><label htmlFor={`${id}-visibility`}><span>Wallpaper visibility<output>{appearance.visibility}%</output></span><input id={`${id}-visibility`} aria-label="Wallpaper visibility" type="range" min="10" max="55" step="5" value={appearance.visibility} onChange={e => apply({ visibility: Number(e.target.value) })} /><small>Subtle background · stronger landscape</small></label>
      <label htmlFor={`${id}-blur`}><span>Wallpaper blur<output>{appearance.blur === 0 ? "Sharp" : `${appearance.blur}px`}</output></span><input id={`${id}-blur`} aria-label="Wallpaper blur" type="range" min="0" max="12" step="1" value={appearance.blur} onChange={e => apply({ blur: Number(e.target.value) })} /><small>Clear details · softer backdrop</small></label></div><a className="btn secondary small-btn" href={wallpaper.src} download={`${wallpaper.id}-landscape.webp`}><Download size={15} />Download wallpaper</a></div>}
    <div className="appearance-footer"><span className="appearance-save-status" role="status"><Check size={14} />{status || "Saved with your workspace. No extra Save step."}</span><small>AI-generated landscapes · available offline</small></div>
    {preview && <Modal title={preview.name} onClose={() => setPreview(undefined)} wide className="landscape-preview-modal" closeLabel="Close wallpaper preview"><div className="modal-body"><img className="landscape-full-preview" src={preview.src} alt={preview.description} width="1672" height="941" /><p className="small muted">{preview.description}. An original AI-generated landscape, available offline.</p></div><div className="modal-foot"><a className="btn secondary" href={preview.src} download={`${preview.id}-landscape.webp`}><Download size={15} />Download</a><button type="button" className="btn primary" onClick={() => { apply({ wallpaper: preview.id, paused: false }); setPreview(undefined); }}><Check size={16} />Apply wallpaper</button></div></Modal>}
  </section>;
}
