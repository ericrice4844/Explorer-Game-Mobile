# Ages of Exploration (Explorer-Game-Mobile)

A mobile strategy and resource-gathering exploration game. You lead a people from
**10,000 BCE**, starting at a random place on a real map of Earth, and fill in the
blank map by sending expeditions over land and sea through seven ages, from the
Stone Age to the Modern Age.

The game is an installable web app (PWA) built for phones in portrait mode. It has
no build step and no runtime dependencies, and it works offline once loaded.

## Play it

```bash
npm start            # serves the game at http://localhost:8080
```

Open that address on a phone on the same network (`http://<your-computer-ip>:8080`),
or host the repo on any static host such as GitHub Pages. Then use the browser's
**Add to Home Screen** to install it as an app. The game saves automatically to
the device.

## How it plays

| System | What it does |
| --- | --- |
| 🧭 **Expeditions** | Tap **Explore**, then tap a destination. You choose the settlement it leaves from and the party size (Scouts, Band, Expedition, Grand Expedition). The party costs people plus 🍖 food, 🧥 clothing, 🪵 wood when it travels by boat, and 🪙 gold in later ages. It maps tiles as it travels and brings back loot from resource sites near its route: gold veins, iron, gems, spices, ivory, furs, ruins, and the rare Lost City of Gold. Ice, desert, jungle, mountains and open sea can cost lives. Bigger parties are safer and can carry more. |
| 🏕️ **Settlements** | Found new settlements on land you have explored. Each one works the tiles around it, including any resource sites it has found, and grows when it has spare food. You can rename settlements and add buildings: Granary, Harbor, Library, Market, Smithy, Walls, University, Factory and more. |
| 🛤️ **Trade routes** | Link your settlements to each other or to other peoples to earn gold and goods every turn. |
| 🤝 **Other peoples** | About 34 civilizations are spread across the globe. Each starts as a Band, Tribe, Chiefdom or Kingdom and can grow into an Empire or Nation. You can **gift**, **trade**, **exchange knowledge** (you also get their maps), **demand tribute**, or **conquer** them. Conquest spends population power (people), and the losers' home becomes your settlement. Hostile warlike peoples may raid you. |
| 📜 **Advances** | 24 advances, including Reed Rafts, Fur Clothing, Horse Riding, Galleys, The Wheel, Cartography, the Compass, Caravels, Steamships, Railroads and Aviation. They raise land and sea speed, endurance, how far from shore your boats can go, how much a party can carry, and how wide a strip an expedition maps. |
| 🏛️ **Ages** | Stone → Bronze → Iron → Medieval → Discovery → Industrial → Modern. Each age needs settlements, mapped tiles, contacts and resources. You win by mapping half the world in the Modern Age. |
| 👑 **Customization** | Choose your leader's name, skin, hair, hair style and facial hair, plus your civilization's name, capital name, banner colour and emblem. You can change these later from the leader portrait. |

### Civilization styles

Your **way of life** (Nomadic, Settled or Seafaring) and **temperament** (Warlike,
Peaceful or Mercantile) together pick one of nine culture styles. The style sets
how your settlements, banners, boats, leader headgear and titles look, and that
look changes with every age:

| | Warlike | Peaceful | Mercantile |
| --- | --- | --- | --- |
| **Nomadic** | Steppe Horde: Mongol-style gers, horse-tail banners, a khan's fur-brimmed hat, and titles from Khan to Khagan | Wandering Herders | Caravan Traders: caravanserais and turbans |
| **Settled** | Legion Empire: forts and temples, eagle standards, laurel wreaths | Temple Builders: ziggurats and pyramids, nemes headdress | Merchant Republic: markets and domes, doge's cap |
| **Seafaring** | Sea Raiders: longhouses and longships | Island Voyagers: fale, marae and outrigger canoes | Maritime Traders: harbors, lighthouses and dhows |

Every style also comes with gameplay bonuses. Nomads travel faster, Settled peoples
grow faster, Seafarers sail cheaper, Warlike peoples have more population power,
Peaceful peoples are safer and learn faster, and Mercantile peoples earn more
from trade.

## Project layout

```
index.html, css/style.css     UI shell (mobile-first, AoE-inspired parchment and wood look)
js/main.js                    App controller: screens, HUD, panels, input
js/game/                      Game logic (no DOM; runs under Node for tests)
  data.js                     Biomes, resources, deposits, ages, styles, advances, buildings
  world.js                    Earth land mask → biomes (climate model + mountain ranges)
  path.js                     A* over the east–west wrapped globe
  game.js                     State, economy, settling, buildings, advances, ages, save/load
  expedition.js               Planning, risk, loot and travel of expeditions
  civs.js                     Other peoples: generation, diplomacy, conquest, raids
  turn.js                     End-of-turn processing
js/render/                    Canvas rendering: map, procedural sprites, leader portraits
js/data/earth.js              Generated 240×120 land mask (Natural Earth, public domain)
tools/build-earth.mjs         Regenerates the land mask (dev dependencies only)
tools/serve.mjs, smoke.mjs    Local server and a headless phone-viewport smoke test
test/                         Node test suite, including a bot that plays through all ages
```

## Development

```bash
npm install          # dev tools only (world-atlas, topojson-client, d3-geo)
npm test             # logic tests (world, pathfinding, expeditions, diplomacy, full bot playthroughs)
npm run smoke        # plays the opening on a phone viewport in headless Chromium; screenshots in ./screenshots
npm run build:earth  # regenerate js/data/earth.js (takes a few minutes)
```

### Shipping to the app stores

The game is a self-contained static web app, so you can wrap it as a native
iOS or Android app with [Capacitor](https://capacitorjs.com/):

```bash
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android @capacitor/ios
npx cap init "Ages of Exploration" com.example.explorer --web-dir .
npx cap add android && npx cap add ios
```

Before you do this, point `webDir` at a folder that contains only the game files,
so `node_modules` and `test` are not bundled into the app.
