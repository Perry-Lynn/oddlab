# Dragon Dispatch artwork

Generated with the built-in image_gen mode on 2026-10-18. The four source PNGs remain in the local Codex generated-image cache and are intentionally not copied into this repository. The terrain layer is decorative only; all roads, rules, and labels are drawn by the application.

| Asset | Public file | Output size | Encoding | Bytes |
|---|---|---:|---|---:|
| hero | /assets/dispatch/hero-v1.webp | 1536 × 768 | `-resize 1536 768 -q 82 -m 6` | 245,998 |
| ember | /assets/dispatch/ember-v1.webp | 512 × 512 | `-resize 512 512 -q 86 -alpha_q 100 -m 6`; transparency confirmed | 53,832 |
| gale | /assets/dispatch/gale-v1.webp | 512 × 512 | `-resize 512 512 -q 86 -alpha_q 100 -m 6`; transparency confirmed | 72,888 |
| terrain | /assets/dispatch/terrain-v1.webp | 1400 × 1000 | `-resize 1400 1000 -q 80 -m 6` | 130,214 |

Total optimized image bytes: **502,932** (budget: 900 KB). Encoding used /opt/homebrew/bin/cwebp 1.6.0 with quality/resize optimization only; portrait alpha was retained. Public URLs are versioned and listed explicitly in dispatch-assets.mjs.

## Source files

- hero: /Users/fupengyu/.codex/generated_images/01a14283-26fb-72b2-917a-c9254f417886/exec-8dd002cc-3b31-4ffe-82b2-f4a0a376372f.png
- ember: /Users/fupengyu/.codex/generated_images/01a14283-26fb-72b2-917a-c9254f417886/exec-a8206f2f-5bf9-4591-8ed4-df4a80d86c74.png
- gale: /Users/fupengyu/.codex/generated_images/01a14283-26fb-72b2-917a-c9254f417886/exec-61026678-7968-4764-af80-42937b0e04f8.png
- terrain: /Users/fupengyu/.codex/generated_images/01a14283-26fb-72b2-917a-c9254f417886/exec-d7d7c59a-4d5d-453a-93a4-217d863be732.png

## Original prompts

### hero

Use case: illustration-story. Asset type: wide hero artwork for OddLab Dragon Dispatch, a thoughtful little browser route puzzle. Create an original warm hand-painted gouache storybook scene in a cozy fantasy parcel kitchen. Two small expressive courier dragons prepare three odd deliveries: Ember is a stocky terracotta red ground dragon with tiny cream horns, sturdy feet and an olive-green courier satchel; Gale is a slender dusty teal blue sky dragon with cream belly, broad small wings and an ochre mail satchel. A lidded pot of gently glowing volcano soup, an icy crystal dream parcel, and a nest-box with three singing eggs sit on the dispatch counter. Both dragons look engaged and capable, slightly comical, with distinct friendly silhouettes. Rich but restrained warm cream paper, sage green, terracotta and soft teal palette, fine ink outlines and visible handmade paint texture. Sophisticated indie-game illustration, whimsical and charming rather than glossy or babyish. Landscape composition about 2:1, scene comfortably framed with clear silhouettes and breathing room; detailed tactile tabletop and distant warm shelves, no interface. No text, no letters, no numbers, no logos, no watermark. Do not draw a route map or imply any puzzle solution.

### ember

Use case: stylized-concept. Asset type: original game character cutout for OddLab Dragon Dispatch. A full-body friendly stocky terracotta red courier dragon, warm cream belly and face, two short cream horns, sturdy ground-walking feet, small folded vestigial wings, olive green canvas courier satchel with brass buckle, subtle darker red scales. Expressive clever dark eyes, one brow slightly raised, determined but endearing smile. Three-quarter view standing ready, one front paw gently holding satchel strap, tail curled into a compact readable silhouette. Hand-painted gouache storybook illustration with delicate sepia ink outlines and textured brushwork, sophisticated cozy indie-game art, warm natural light, matching a terracotta/cream/sage fantasy postal kitchen. Entire character and tail fully visible, generous empty margin, square composition, no props beyond satchel. Genuine transparent background with alpha; no white rectangle, no scene, no lettering, no logo, no watermark.

### gale

Use case: stylized-concept. Asset type: original game character cutout for OddLab Dragon Dispatch. A full-body friendly slender dusty teal blue sky courier dragon, warm cream belly and face, two short cream horns, broad folded blue wings, ochre leather courier satchel with brass buckle, subtle muted blue scales. Expressive clever dark eyes, bright curious smile, more light-footed and elegant than a ground dragon. Three-quarter view standing ready, one front paw lightly resting on satchel strap, tail curled into a compact readable silhouette. Hand-painted gouache storybook illustration with delicate sepia ink outlines and textured brushwork, sophisticated cozy indie-game art, warm natural light, matching a terracotta/cream/sage fantasy postal kitchen. Entire character, wings and tail fully visible, generous empty margin, square composition, no props beyond satchel. Genuine transparent background with alpha; no white rectangle, no scene, no lettering, no logo, no watermark.

### terrain

Use case: illustration-story. Asset type: decorative game-map ground layer behind a functional SVG route puzzle, not a complete map. Create a wide overhead storybook meadow terrain painted on warm cream parchment in pale sage green, muted moss, soft sandy beige and tiny dusty teal marsh accents. About 1.4:1 landscape. Most of the entire central surface must be calm pale grass/paper with very low contrast and broad open negative space so dark UI roads and place labels added in code will remain readable. A few delicate tufts of grass, little pebbles, tiny flowers near the outer edges, and soft watercolor feathering at the boundary only. Fine hand-made gouache texture, cozy whimsical indie-game style. Do NOT include roads, paths, rivers, bridges, buildings, landmarks, dragons, characters, text, letters, numbers, symbols, grid, border, UI or watermark. Do not invent puzzle connectivity. An unobtrusive painted playmat background, not a dramatic full landscape.
