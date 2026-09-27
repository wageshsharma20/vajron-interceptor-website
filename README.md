# VAJRON Flight Demonstrator

Product website for the VAJRON high-speed autonomous flight demonstrator
(R&D prototype, interceptor-variant testbed program), built for iPad
presentation at exhibitions.

- Content comes only from the VAJRON flight demonstrator spec sheet.
  Roadmap items are presented as design targets, not current capabilities.
- The hero and overview images are photographs of the aircraft.
- The film, loops, stills and drawings are rendered from a procedural 3D model
  of the aircraft (`js/icpt.js`, three.js). The same model runs live in the
  "Explore the aircraft" viewer. Terrain and route overlays are illustrative.

## Re-rendering media
1. Serve the folder: `python3 -m http.server 4194`
2. Frames and stills: `node tools/capture.mjs <jobs.json>` (headless Chrome over CDP, no npm packages)
3. Shots and camera paths live in `tools/render.html`.
4. Layout check at iPad sizes: `node tools/audit.mjs http://127.0.0.1:4194/`

`tools/` is excluded from deployment (`.vercelignore`).
