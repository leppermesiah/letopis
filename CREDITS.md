# Credits and licenses

Everything Letopis takes from outside is listed here: what it is, where it comes from, who made it and under which license.
Only CC0, CC-BY and MIT/BSD/ISC/Apache-style licenses are used. No CC-NC and nothing with an unclear license.
Every new borrowed resource gets a row here in the same commit.

## Graphics

### Sprites (terrain, trees, nature, camps, villages, people, clan symbols, animals)

| What | Source | Author | Rights |
|---|---|---|---|
| 118 sprite sheets in `art/sheets/` (A–L terrain, nature, settlements, people; N–Q animals; R secrets; S–V elders; W–Z growing trees; AA–AF stumps, work, night, storytellers, growing villages; AG–AL Bronze Age crafts, towns, artisans, travellers and roads; AM–AP camp ground, guards and sleepers; AQ–AR 100 clan symbols; AS–AX Iron Age crafts, towns, workers, travellers and guard; AY–BD Middle Ages crafts, castle, town, workers, travellers and guard; BE–BK Early Modern crafts, palace, town, ships and colonies, workers, travellers and guard; BL–BR Industrial crafts, factory and station, town, trains and steamers, workers, travellers and watchman; BS–CD everyday clothes of each age; CE–CK Information age crafts, skyscraper and airport, town, cars and planes, workers, travellers and patrol officer; CL–CR Space age crafts, green tower and spaceport, town, maglev and flying cars, workers, travellers and ranger; CS–CX canoes, fishing with rods and nets, fish carried home in every age, rowing boat and motorboat; CY–DC Mars: colonists in space suits, domes, rocks and machines, rockets landing and lifting off, work on Mars; DD–DI town walls of every age; DJ the 100 fairy tale heroes of the secrets; DK–DP wild animals walking and running), cut into `art/cut/` and packed into `public/sprites/atlas*.webp` | Generated with ChatGPT image generation (OpenAI), November 2026 | leppermesiah, with ChatGPT | Under OpenAI's terms of use, the rights to generated output belong to the user who generated it. Used by the project with his permission. |
| App icon: `public/icon-*.png`, `public/favicon-32.png`, `art/social-preview.png` | Generated with ChatGPT image generation (OpenAI), November 2026 | leppermesiah, with ChatGPT | As above |

Notes:
- The prompts do not name specific games, artists or protected characters; they only describe a style ("cozy painterly isometric pixel art").
- AI-generated content may not be protected by copyright in some countries, so nothing more than the above is claimed.
- Cutting, halo cleanup and atlas packing are done by the project's own scripts `tools/slice_sprites.py` and `tools/build_atlas.py`.

### Everything else

| What | How | Author | License |
|---|---|---|---|
| Seasonal snow, fog over unexplored land, night, firelight, trodden ground in camps | Drawn by code in `src/client/render.ts` | the project | own code |
| Water shader | Own GLSL in `src/client/render.ts` (`WATER_FRAG`) | the project | own code |
| Simplex noise | Own implementation of Ken Perlin's published algorithm (`src/shared/noise.ts`) | the project | own code |
| sfc32 random number generator | Own implementation of Chris Doty-Humphrey's public algorithm (PractRand), `src/shared/rng.ts` | the project | own code |
| Fonts | System fonts of the device, nothing is downloaded | – | – |

## Sounds

All sounds are public domain (CC0 1.0), cut into short loops, loudness-matched and re-encoded as Opus in `public/sounds/`.

| File | Recording | Author | License |
|---|---|---|---|
| `river.ogg` | [Relaxing River Sound](https://freesound.org/s/722875/) | IceVFX | CC0 1.0 |
| `sea.ogg` | [Crashing Waves - Pacific Ocean](https://freesound.org/s/817075/) | SecureSubset | CC0 1.0 |
| `birds.ogg` | [Forest quiet atmosphere with some birds](https://freesound.org/s/414098/) | felix.blume | CC0 1.0 |
| `crickets.ogg` | [Crickets (close recording)](https://freesound.org/s/476672/) | felix.blume | CC0 1.0 |
| `fire.ogg` | [Fireplace sound loop](https://opengameart.org/content/fireplace-sound-loop) | PagDev | CC0 1.0 |
| `hammer1.ogg` … `hammer4.ogg` | Wood and metal sound effects, rubberduck's CC0 packs on OpenGameArt ([copy in Free-SFX](https://github.com/EternityForest/Free-SFX/tree/main/rubberduck/WoodMetal)) | rubberduck | CC0 1.0 |
| `owl.ogg` | [Owl hoot](https://freesound.org/s/465697/) | breviceps | CC0 1.0 |
| `growl.ogg` | [Lion growl](https://freesound.org/s/516829/) | matrixxx | CC0 1.0 |
| `cow.ogg` | [Cow moo](https://freesound.org/s/59245/) | Zozzy | CC0 1.0 |
| `sheep.ogg` | [Sheep](https://freesound.org/s/710300/) | michaelperfect | CC0 1.0 |
| `goat.ogg` | [Goat](https://freesound.org/s/581240/) | Kinoton | CC0 1.0 |
| `dog.ogg` | [Dog barking](https://freesound.org/s/386766/) | ken788 | CC0 1.0 |
| `wolf.ogg` | [Wolf howl](https://freesound.org/s/398430/) | NaturesTemper | CC0 1.0 |
| `horse.ogg` | [Horse neigh](https://freesound.org/s/521246/) | poodaddy69 | CC0 1.0 |
| `donkey.ogg` | [Donkey bray](https://freesound.org/s/675411/) | craigsmith | CC0 1.0 |
| `pig.ogg` | [Pig grunts](https://freesound.org/s/233183/) | JarredGibb | CC0 1.0 |
| `hen.ogg` | [Hen clucking](https://freesound.org/s/456803/) | Breviceps | CC0 1.0 |
| `cat.ogg` | [Cat meow](https://freesound.org/s/110011/) | tuberatanka | CC0 1.0 |
| `crow.ogg` | [Crow caw](https://freesound.org/s/536732/) | egomassive | CC0 1.0 |
| `duck.ogg` | [Duck quacks](https://freesound.org/s/607226/) | D4XX | CC0 1.0 |
| `elephant.ogg` | [Elephant trumpet](https://freesound.org/s/527845/) | D.jones | CC0 1.0 |
| `crowd.ogg` | [CROWD village square](https://freesound.org/s/648483/) | nicoproson | CC0 1.0 |

The loops were found through the CC0 collections [funcoder/omarchy-ambient](https://github.com/funcoder/omarchy-ambient) and [EternityForest/Free-SFX](https://github.com/EternityForest/Free-SFX).

## Music

| What | How | Author | License |
|---|---|---|---|
| Background music of each age and of Mars, `public/music/*.ogg` (cut into seamless loops and re-encoded as Opus) | Generated with Suno, November 2026 | leppermesiah, with Suno | Generated by leppermesiah with Suno and used by the project with his permission, under Suno's terms of service. |

## Names and translations

Bulgarian personal names, nicknames, settlement roots and clan totems are common words and names, collected by hand in
`src/server/sim/names.ts`. The English translations and the transliteration (Bulgarian streamlined system) are in
`src/shared/i18n.ts`. Fairy tale heroes named by the secrets are public domain folk and literary characters.

## Software libraries

In the image or in the browser:

| Package | Version | License | Source | Used for |
|---|---|---|---|---|
| pixi.js | 8.13.2 | MIT | https://github.com/pixijs/pixijs | rendering in the browser (WebGL) |
| @pixi/colord | 2.9.6 | MIT | https://github.com/pixijs/colord | dependency of pixi.js |
| @xmldom/xmldom | 0.8.15 | MIT | https://github.com/xmldom/xmldom | dependency of pixi.js |
| earcut | 3.2.4 | ISC | https://github.com/mapbox/earcut | dependency of pixi.js |
| eventemitter3 | 5.0.4 | MIT | https://github.com/primus/eventemitter3 | dependency of pixi.js |
| gifuct-js | 2.1.2 | MIT | https://github.com/matt-way/gifuct-js | dependency of pixi.js |
| ismobilejs | 1.1.1 | MIT | https://github.com/kaimallea/isMobile | dependency of pixi.js |
| parse-svg-path | 0.1.2 | MIT | https://github.com/jkroso/parse-svg-path | dependency of pixi.js |
| tiny-lru | 11.4.7 | BSD-3-Clause | https://github.com/avoidwork/tiny-lru | dependency of pixi.js |
| ws | 8.18.3 | MIT | https://github.com/websockets/ws | WebSocket server |
| Node.js | 22.20.0 | MIT (+ licenses of bundled parts) | https://nodejs.org | server runtime, built-in `node:sqlite` |

Build only (not in the image):

| Package | Version | License | Source |
|---|---|---|---|
| typescript | 5.9.3 | Apache-2.0 | https://github.com/microsoft/TypeScript |
| esbuild | 0.25.10 | MIT | https://github.com/evanw/esbuild |
| @types/node, @types/ws | 22.18.8, 8.18.1 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |

Sprite preparation only (the Python scripts in `tools/`, not in the image):

| Package | Version | License | Source |
|---|---|---|---|
| Pillow | 12.3.0 | MIT-CMU | https://github.com/python-pillow/Pillow |
| NumPy | 2.5.3 | BSD-3-Clause (+ 0BSD, MIT, Zlib, CC0-1.0 for bundled parts) | https://github.com/numpy/numpy |

## Inspiration

Ideas for the future (generation ships, terraforming, colonies) come from common themes of classic science fiction.
No plots, characters, names or texts are copied from specific books.
