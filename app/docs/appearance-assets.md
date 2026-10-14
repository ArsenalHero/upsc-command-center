# Themes and natural landscape wallpapers

Five colour palettes work with light, dark and device-following modes. Use the palette icon in the top bar, or open Settings → Themes & wallpapers. Appearance saves through the existing workspace repository and is included in exports; guest settings remain on the device. Preparation targets still have their own Save settings action. Wallpapers have fixed, bundled identifiers; arbitrary remote URLs are not accepted.

The built-in image-generation tool created these original landscapes. These are AI-generated scenes, rather than photographs of identified places. Only WebP encoding and thumbnail resizing were applied to the generated outputs; no visual editing was performed. The images and thumbnails are bundled for offline use. The plain background is the default; selecting a landscape is optional.

| Wallpaper | Source asset | Thumbnail |
| --- | --- | --- |
| Mountain dawn | `app/public/wallpapers/mountain-dawn.webp` | `app/public/wallpapers/mountain-dawn-thumb.webp` |
| Forest lake | `app/public/wallpapers/forest-lake.webp` | `app/public/wallpapers/forest-lake-thumb.webp` |
| Coastal sunset | `app/public/wallpapers/coastal-sunset.webp` | `app/public/wallpapers/coastal-sunset-thumb.webp` |
| Green meadows | `app/public/wallpapers/green-meadows.webp` | `app/public/wallpapers/green-meadows-thumb.webp` |
| Woodland waterfall | `app/public/wallpapers/woodland-waterfall.webp` | `app/public/wallpapers/woodland-waterfall-thumb.webp` |
| Desert dawn | `app/public/wallpapers/desert-dawn.webp` | `app/public/wallpapers/desert-dawn-thumb.webp` |

## Generation prompts

Shared specification: photorealistic-natural; finished landscape wallpaper for a focused study dashboard; realistic landscape photography, natural textures, understated colours and a calm atmosphere; wide 16:9 composition usable full-screen and in a centred phone crop; simple horizon and calm areas; one continuous scene; no collage, lettering, frame, people, buildings, logo, watermark or UI. Requested 2048 × 1152 where supported; delivered 1672 × 941.

- Mountain dawn: Snowy mountain peaks above a calm alpine lake at early morning, layered blue ridges, subtle golden sunlight and realistic reflections.
- Forest lake: A serene forest lake with lush green trees, faint morning mist over still water, distant pine-covered hills and soft diffuse daylight.
- Coastal sunset: A tranquil natural coastline with pale sand, turquoise water and distant rugged cliffs, gentle waves and a clear horizon at soft sunset.
- Green meadows: Rolling emerald meadows and soft distant hills, a few wildflowers at the lower edge, wide open sky and soft morning light.

The two additional scenes used this full prompt, substituting the scene below:

> Use case: photorealistic-natural. Asset type: original natural landscape wallpaper for a focused study dashboard. Scene: [scene]. Style: highly realistic landscape photography, calm atmosphere, understated natural colours and textures. Composition: one wide 16:9 continuous scene, request 2048 by 1152 if supported; usable full-screen and as a centred phone crop. Constraints: no people, buildings, lettering, logo, frame, collage, watermark or UI.

- Woodland waterfall scene: A lush woodland waterfall falling into a turquoise pool, natural rocks, light mist and soft daylight through green trees.
- Desert dawn scene: Golden dune ridgelines at dawn under a pale blue sky, fine sand textures and gentle light along the crests.

Original generated outputs: `generated_images/exec-6d4cdd5a-59a3-4b4d-82d0-4d4d0a0699d9.png` (waterfall) and `generated_images/exec-98ab82b3-4bc8-41ab-919b-fd8e1ff4c8d6.png` (dunes). The four delivered WebP files are listed above. Full images use quality 82; thumbnails are 320 × 180 at quality 76.

Daily landscape rotates once per local calendar date, including after returning to a tab left open overnight. When favourites are saved, only those scenes rotate; otherwise all six scenes rotate. Full previews and downloads are available for each scene. Pausing a wallpaper keeps its selection and tuning. Readability presets and left/centre/right crop focus save with the workspace. Visibility is limited to 10–55% and blur to 0–12px; study content keeps a tinted backing and opaque cards. Reset appearance restores the original blue/light/plain look without changing preparation records or targets.

Validation: production TypeScript/build, legacy backup normalization, palette contrast, deterministic daily rotation and browser-DOM workflows. Browser screenshot QA is unavailable in this environment.
