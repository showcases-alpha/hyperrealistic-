# Aurelia — Hyper-Realistic Island Environment

Aurelia is a finite, procedurally generated 3D island rendered in the browser with WebGL 2 and served by a zero-dependency Python backend. It combines multi-scale geological terrain, biome-aware instancing, dynamic physically based sunlight, animated ocean and freshwater shaders, atmospheric perspective, clouds, and first-person exploration.

## Run

```bash
python main.py
```

Open `http://<IP>:<PORT>`. The server binds to `0.0.0.0`; its port is read from [`port.txt`](port.txt) (default: `8000`). Python 3.10+ is recommended. There are no pip dependencies.

## Controls

| Input | Action |
|---|---|
| Click | Capture mouse / begin exploring |
| Mouse | Look |
| W A S D | Move |
| Shift | Sprint |
| F | Toggle flight |
| Space / Ctrl | Ascend / descend while flying |
| P | Toggle photo mode |
| Escape | Release mouse |

The bottom timeline can move continuously from dawn through night.

## Rendering features

- Finite 1.4 km terrain mesh with an irregular erosion-inspired coastline
- Six-octave terrain synthesis combining continental masks, ridges, micro-noise, valleys, cliffs, and a formed lake basin
- Height-, slope-, moisture-, and shoreline-aware material coloring
- PBR terrain, rock, bark, foliage, sand, grass, and driftwood responses
- 20,000+ batched ecosystem elements using GPU instancing
- Forest clearings, grassland, upland heath, freshwater reeds, coastal debris, and rock fields
- Animated multi-frequency ocean with Fresnel response, depth color, sun glint, and procedural shore foam
- Irregular freshwater lake with shallow/deep color and concentric wind ripples
- Full dynamic solar cycle affecting the sky, fog, exposure, shadows, ocean, and cloud lighting
- Soft shadow maps, ACES filmic tone mapping, horizon haze, volumetric-style cloud clusters, vignette, and film grain
- First-person terrain following and unrestricted fly mode

## Structure

- `main.py` — threaded Python static/config server
- `port.txt` — server port
- `static/js/app.js` — procedural world synthesis and renderer
- `static/css/style.css` — responsive expedition interface
- `static/vendor/three.module.min.js` — vendored Three.js runtime (works offline)

For performance, renderer pixel density is capped, flora use instanced meshes, distant atmosphere hides the finite boundary, and terrain/ocean geometry use fixed finite bounds rather than an infinite-world system.
