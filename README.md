# Coastal Diorama

A living miniature coastal landscape — an interactive browser-based diorama that combines architectural visualization aesthetics with modern low-poly 3D rendering. Watch a beautifully composed coastal scene come alive with gentle animations, flowing water, swaying vegetation, and a full day-night cycle.

## Features

- Complete coastal landscape with beaches, cliffs, forests, river, ocean, islands, and more
- Dynamic water rendering with depth-based color, shoreline foam, waves, and caustics
- Dense vegetation system with natural distribution using instanced rendering
- Full day-night cycle with 5 time presets (morning, noon, afternoon, sunset, night)
- Cinematic camera controls with smooth orbiting, zooming, and panning
- Real-time lighting with soft shadows, atmospheric fog, and post-processing effects
- Ambient animations: birds, fish, floating particles, swaying vegetation, cloud shadows
- Modular audio system architecture ready for ambient sound
- Minimalist UI with time controls, camera reset, fullscreen, and hide UI options

## Tech Stack

- **TypeScript** — Type-safe development
- **Vite** — Fast build tooling
- **React** — UI framework
- **Three.js** — 3D rendering engine
- **React Three Fiber** — React renderer for Three.js
- **Drei** — Useful helpers for R3F
- **Postprocessing** — Post-processing effects (Bloom, Vignette, Tone Mapping)
- **GLSL** — Custom shaders for water rendering

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Build

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Controls

| Action | Control |
|--------|---------|
| Rotate | Left mouse drag |
| Zoom | Scroll wheel |
| Pan | Right mouse drag |
| Reset Camera | ⟳ button in UI |

## Project Structure

```
src/
├── components/
│   ├── scene/          # Main scene composition
│   └── ui/             # UI overlay components
├── systems/
│   ├── terrain/        # Terrain generation, structural elements
│   ├── vegetation/     # Vegetation placement and rendering
│   ├── water/          # Water shaders and geometry
│   ├── lighting/       # Lighting setup, post-processing
│   ├── camera/         # Camera controls
│   ├── time/           # Day-night cycle system
│   ├── animation/      # Birds, fish, particles, cloud shadows
│   └── audio/          # Audio manager architecture
├── shaders/
│   └── water/          # GLSL water vertex/fragment shaders
├── hooks/              # Custom React hooks (useTime, useCamera)
├── utils/              # Noise, math, color utilities
├── types/              # TypeScript type definitions
└── config/             # Constants, color palette
```

## Art Direction

The visual style is a blend of:
- Miniature diorama aesthetics
- Architectural landscape rendering
- Modern stylized low-poly
- Cozy indie game atmosphere

The color palette is intentionally restrained — warm sands, muted greens, turquoise waters, and soft warm grays — creating a calm, peaceful atmosphere.

## Implementation Notes

- **Terrain**: Uses fractal Brownian motion (fbm) noise for natural-looking height fields with a carved river valley and coastal features
- **Water**: Custom GLSL shaders with depth-based color gradients, wave animation, shoreline foam, and caustic light patterns
- **Vegetation**: InstancedMesh for efficient rendering of hundreds of plants, with natural clustering based on height and slope
- **Lighting**: Directional sun light with soft shadows, hemisphere + ambient light, atmospheric fog, and time-of-day color transitions
- **Post-processing**: Subtle bloom for highlights, vignette for depth, and ACES filmic tone mapping for cinematic look

## License

MIT