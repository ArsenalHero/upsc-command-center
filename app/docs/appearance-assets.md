# Themes and natural landscape wallpapers

Five colour palettes work with light, dark and device-following modes. Use the palette icon in the top bar, or open Settings → Themes & wallpapers. Appearance saves through the existing workspace repository and is included in exports; guest settings remain on the device. Preparation targets still have their own Save settings action. Wallpapers have fixed, bundled identifiers; arbitrary remote URLs are not accepted.

The built-in image-generation tool created these original landscapes. These are AI-generated scenes, rather than photographs of identified places. Only WebP encoding and thumbnail resizing were applied to the generated outputs; no visual editing was performed. The images and thumbnails are bundled for offline use. The plain background is the default; selecting a landscape is optional.

| Wallpaper | Source asset | Thumbnail |
| --- | --- | --- |
| Mountain dawn | `app/public/wallpapers/mountain-dawn.webp` | `app/public/wallpapers/mountain-dawn-thumb.webp` |
| Forest lake | `app/public/wallpapers/forest-lake.webp` | `app/public/wallpapers/forest-lake-thumb.webp` |
| Coastal sunset | `app/public/wallpapers/coastal-sunset.webp` | `app/public/wallpapers/coastal-sunset-thumb.webp` |
| Green meadows | `app/public/wallpapers/green-meadows.webp` | `app/public/wallpapers/green-meadows-thumb.webp` |

## Generation prompts

Shared specification: photorealistic-natural; finished landscape wallpaper for a focused study dashboard; realistic landscape photography, natural textures, understated colours and a calm atmosphere; wide 16:9 composition usable full-screen and in a centred phone crop; simple horizon and calm areas; one continuous scene; no collage, lettering, frame, people, buildings, logo, watermark or UI. Requested 2048 × 1152 where supported; delivered 1672 × 941.

- Mountain dawn: Snowy mountain peaks above a calm alpine lake at early morning, layered blue ridges, subtle golden sunlight and realistic reflections.
- Forest lake: A serene forest lake with lush green trees, faint morning mist over still water, distant pine-covered hills and soft diffuse daylight.
- Coastal sunset: A tranquil natural coastline with pale sand, turquoise water and distant rugged cliffs, gentle waves and a clear horizon at soft sunset.
- Green meadows: Rolling emerald meadows and soft distant hills, a few wildflowers at the lower edge, wide open sky and soft morning light.

Daily landscape rotates once per local calendar date, including after returning to a tab left open overnight. Visibility is limited to 10–55% and blur to 0–12px; study content keeps a tinted backing and opaque cards. Reset appearance restores the original blue/light/plain look without changing preparation records or targets.

Validation: production TypeScript/build, legacy backup normalization, palette contrast, deterministic daily rotation and browser-DOM workflows. Browser screenshot QA is unavailable in this environment.
