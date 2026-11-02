// Static game data: biomes, resources, deposits, ages, culture styles,
// advances and buildings. Pure data — no DOM, no state.

export const RESOURCES = {
  food: { name: 'Food', icon: '🍖', weight: 1 },
  wood: { name: 'Wood', icon: '🪵', weight: 1 },
  stone: { name: 'Stone', icon: '🪨', weight: 1 },
  clothing: { name: 'Clothing', icon: '🧥', weight: 1 },
  iron: { name: 'Iron', icon: '⛏️', weight: 2 },
  gold: { name: 'Gold', icon: '🪙', weight: 4 },
  luxuries: { name: 'Luxuries', icon: '💎', weight: 4 },
  knowledge: { name: 'Knowledge', icon: '📜', weight: 0 },
};
export const RESOURCE_KEYS = Object.keys(RESOURCES);

// Biome ids are small integers so the world can be stored as a Uint8Array.
export const B = {
  OCEAN: 0,
  SEA: 1,
  COAST: 2,
  ICE: 3,
  TUNDRA: 4,
  TAIGA: 5,
  FOREST: 6,
  GRASSLAND: 7,
  STEPPE: 8,
  SAVANNA: 9,
  DESERT: 10,
  JUNGLE: 11,
  HILLS: 12,
  MOUNTAINS: 13,
};

// yields: per-turn output when a settlement works the tile.
// move: travel effort (tiles of effort). hazard: per-tile chance-ish of losing people.
// risk: which resistance reduces the hazard.
export const BIOMES = [
  { id: B.OCEAN, key: 'ocean', name: 'Deep Ocean', water: true, color: '#1f4f7a', yields: { food: 1 }, move: 1, hazard: 0.02, risk: 'sea' },
  { id: B.SEA, key: 'sea', name: 'Open Sea', water: true, color: '#2b6597', yields: { food: 1 }, move: 1, hazard: 0.012, risk: 'sea' },
  { id: B.COAST, key: 'coast', name: 'Coastal Waters', water: true, color: '#3f86b5', yields: { food: 2 }, move: 1, hazard: 0.005, risk: 'sea' },
  { id: B.ICE, key: 'ice', name: 'Ice Sheet', color: '#e9f1f5', yields: {}, move: 3, hazard: 0.06, risk: 'cold' },
  { id: B.TUNDRA, key: 'tundra', name: 'Tundra', color: '#a7a98a', yields: { food: 1, clothing: 1 }, move: 2, hazard: 0.025, risk: 'cold' },
  { id: B.TAIGA, key: 'taiga', name: 'Boreal Forest', color: '#4f6e4a', yields: { food: 1, wood: 2, clothing: 1 }, move: 2, hazard: 0.012, risk: 'cold' },
  { id: B.FOREST, key: 'forest', name: 'Forest', color: '#4f8a3c', yields: { food: 2, wood: 2, clothing: 1 }, move: 2, hazard: 0.004 },
  { id: B.GRASSLAND, key: 'grassland', name: 'Grassland', color: '#8fbf4f', yields: { food: 3 }, move: 1, hazard: 0.002 },
  { id: B.STEPPE, key: 'steppe', name: 'Steppe', color: '#b9b65e', yields: { food: 2, clothing: 1 }, move: 1, hazard: 0.004 },
  { id: B.SAVANNA, key: 'savanna', name: 'Savanna', color: '#c9b04f', yields: { food: 2, clothing: 1 }, move: 1, hazard: 0.006, risk: 'heat' },
  { id: B.DESERT, key: 'desert', name: 'Desert', color: '#e2cd8a', yields: { stone: 1 }, move: 2, hazard: 0.035, risk: 'heat' },
  { id: B.JUNGLE, key: 'jungle', name: 'Jungle', color: '#2f7a3a', yields: { food: 2, wood: 1 }, move: 3, hazard: 0.03, risk: 'jungle' },
  { id: B.HILLS, key: 'hills', name: 'Hills', color: '#9c9a5c', yields: { food: 1, stone: 2 }, move: 2, hazard: 0.006 },
  { id: B.MOUNTAINS, key: 'mountains', name: 'Mountains', color: '#8a8580', yields: { stone: 2 }, move: 4, hazard: 0.03, risk: 'cold' },
];

export function isWaterBiome(b) {
  return b <= B.COAST;
}

// Hidden deposits scattered across the map. Discovered by exploring;
// expeditions bring back loot from them, settlements harvest them each turn.
export const DEPOSITS = {
  gold: { name: 'Gold Vein', icon: '🪙', biomes: [B.HILLS, B.MOUNTAINS, B.DESERT, B.JUNGLE], rarity: 0.05, yields: { gold: 2 }, loot: { gold: [6, 16] } },
  iron: { name: 'Iron Ore', icon: '⛏️', biomes: [B.HILLS, B.MOUNTAINS, B.TAIGA, B.TUNDRA], rarity: 0.08, yields: { iron: 2 }, loot: { iron: [5, 12] } },
  gems: { name: 'Gemstones', icon: '💎', biomes: [B.MOUNTAINS, B.JUNGLE, B.SAVANNA], rarity: 0.03, yields: { luxuries: 2 }, loot: { luxuries: [5, 12] } },
  spices: { name: 'Spices', icon: '🌶️', biomes: [B.JUNGLE, B.SAVANNA], rarity: 0.08, yields: { luxuries: 1, food: 1 }, loot: { luxuries: [4, 9] } },
  ivory: { name: 'Ivory', icon: '🦣', biomes: [B.SAVANNA, B.JUNGLE, B.TUNDRA], rarity: 0.04, yields: { luxuries: 1, clothing: 1 }, loot: { luxuries: [3, 8] } },
  silk: { name: 'Silk Moths', icon: '🧵', biomes: [B.FOREST, B.GRASSLAND], rarity: 0.025, yields: { luxuries: 1, clothing: 2 }, loot: { luxuries: [3, 7], clothing: [4, 8] } },
  furs: { name: 'Fur Game', icon: '🦊', biomes: [B.TUNDRA, B.TAIGA, B.FOREST], rarity: 0.08, yields: { clothing: 3 }, loot: { clothing: [8, 16] } },
  horses: { name: 'Wild Horses', icon: '🐎', biomes: [B.STEPPE, B.GRASSLAND, B.SAVANNA], rarity: 0.06, yields: { food: 1 }, loot: { food: [6, 12] } },
  fish: { name: 'Fishing Grounds', icon: '🐟', biomes: [B.COAST], rarity: 0.07, yields: { food: 3 }, loot: { food: [8, 16] } },
  game: { name: 'Herds', icon: '🦌', biomes: [B.GRASSLAND, B.FOREST, B.STEPPE, B.TUNDRA], rarity: 0.07, yields: { food: 2, clothing: 1 }, loot: { food: [8, 14], clothing: [3, 6] } },
  timber: { name: 'Great Timber', icon: '🌲', biomes: [B.FOREST, B.TAIGA, B.JUNGLE], rarity: 0.06, yields: { wood: 3 }, loot: { wood: [8, 16] } },
  quarry: { name: 'Marble Quarry', icon: '🏔️', biomes: [B.HILLS, B.MOUNTAINS, B.DESERT], rarity: 0.05, yields: { stone: 3 }, loot: { stone: [8, 16] } },
  salt: { name: 'Salt Flats', icon: '🧂', biomes: [B.DESERT, B.STEPPE], rarity: 0.04, yields: { gold: 1, food: 1 }, loot: { gold: [3, 8] } },
  ruins: { name: 'Ancient Ruins', icon: '🏚️', biomes: [B.DESERT, B.JUNGLE, B.GRASSLAND, B.HILLS, B.SAVANNA, B.STEPPE, B.FOREST], rarity: 0.012, once: true, yields: {}, loot: { knowledge: [12, 30], gold: [4, 14] } },
  lostcity: { name: 'Lost City of Gold', icon: '🏯', biomes: [B.JUNGLE, B.MOUNTAINS, B.DESERT], rarity: 0.003, once: true, yields: {}, loot: { gold: [40, 80], luxuries: [10, 20], knowledge: [10, 20] } },
};
export const DEPOSIT_KEYS = Object.keys(DEPOSITS);

export const AGES = [
  { id: 0, name: 'Stone Age', short: 'Stone', startYear: -10000, yearsPerTurn: 200, cost: {}, req: {} },
  { id: 1, name: 'Bronze Age', short: 'Bronze', startYear: -3500, yearsPerTurn: 80, cost: { knowledge: 30, food: 60, stone: 25 }, req: { cities: 2 } },
  { id: 2, name: 'Iron Age', short: 'Iron', startYear: -1200, yearsPerTurn: 40, cost: { knowledge: 80, stone: 60, iron: 15, gold: 10 }, req: { cities: 3, explored: 400 } },
  { id: 3, name: 'Medieval Age', short: 'Medieval', startYear: 500, yearsPerTurn: 25, cost: { knowledge: 160, iron: 40, gold: 40, stone: 80 }, req: { cities: 4, explored: 900, contacts: 2 } },
  { id: 4, name: 'Age of Discovery', short: 'Discovery', startYear: 1450, yearsPerTurn: 10, cost: { knowledge: 280, gold: 100, wood: 150, luxuries: 20 }, req: { cities: 5, explored: 1800 } },
  { id: 5, name: 'Industrial Age', short: 'Industrial', startYear: 1760, yearsPerTurn: 5, cost: { knowledge: 450, iron: 150, gold: 200, luxuries: 50 }, req: { cities: 7, explored: 3500 } },
  { id: 6, name: 'Modern Age', short: 'Modern', startYear: 1914, yearsPerTurn: 2, cost: { knowledge: 700, iron: 250, gold: 400, luxuries: 100 }, req: { cities: 9, explored: 6000 } },
];

export const VICTORY_EXPLORED_FRACTION = 0.5;

// Game modes. Quick Play compresses the whole journey into a 10–15 minute game;
// Epic Journey is the full-length game, and the world keeps turning while you are away.
export const MODES = {
  quick: {
    id: 'quick', name: 'Quick Play', icon: '⚡', blurb: '10–15 minutes',
    desc: 'A compressed race through the ages. Everything is cheaper and faster. Map 15% of the world in the Modern Age within 120 turns.',
    costMult: 0.45, ageReqMult: 0.35, cityReqMult: 0.6, yieldMult: 1.4, growthMult: 0.6,
    endurance: 2, speed: 1, reveal: 1, civs: 26, victory: 0.15, turnLimit: 120,
    startRes: { food: 120, wood: 80, stone: 40, clothing: 40 },
    yearsPerTurnMult: 3,
  },
  epic: {
    id: 'epic', name: 'Epic Journey', icon: '🌍', blurb: 'Many sessions',
    desc: 'The full journey from 10,000 BCE. Map half the world in the Modern Age. Your world keeps turning while you are away: one season passes every 20 minutes (up to 36).',
    costMult: 1, ageReqMult: 1, cityReqMult: 1, yieldMult: 1, growthMult: 1,
    endurance: 0, speed: 0, reveal: 0, civs: 34, victory: VICTORY_EXPLORED_FRACTION, turnLimit: 0,
    startRes: { food: 60, wood: 30, stone: 10, clothing: 15 },
    yearsPerTurnMult: 1,
    idleMinutesPerTurn: 20, idleMaxTurns: 36,
  },
};

export const LIFESTYLES = {
  nomadic: { name: 'Nomadic', icon: '🐎', desc: 'Expeditions travel faster and eat less. Settlements yield a little less.' },
  settled: { name: 'Settled', icon: '🌾', desc: 'Settlements grow faster and cost less to found.' },
  seafaring: { name: 'Seafaring', icon: '⛵', desc: 'Start on a coast with rafts. Sea voyages are faster and cheaper.' },
};

export const TEMPERAMENTS = {
  warlike: { name: 'Warlike', icon: '⚔️', desc: 'Population power +50%. Conquest costs fewer lives, but strangers are wary.' },
  peaceful: { name: 'Peaceful', icon: '🕊️', desc: 'Strangers are friendlier. Knowledge +25% and expeditions are safer.' },
  mercantile: { name: 'Mercantile', icon: '⚖️', desc: 'Trade routes yield +50% and cost less. Gifts go further.' },
};

// Culture styles are derived from lifestyle + temperament and drive the
// look of cities, units, leader dress and titles as the ages progress.
// Houses/landmarks are sprite primitive names drawn by render/sprites.js.
export const STYLES = {
  steppe_horde: {
    name: 'Steppe Horde', lifestyle: 'nomadic', temperament: 'warlike',
    inspiration: 'Mongol & Turkic horse lords',
    palette: { wall: '#e8dcc0', roof: '#c7b48a', trim: '#7a3b2a' },
    houses: ['hidetent', 'yurt', 'yurt', 'yurt', 'yurt', 'tenement', 'tower'],
    landmarks: ['hidetent', 'bigyurt', 'bigyurt', 'bigyurt', 'citadel', 'factory', 'skyscraper'],
    headgear: ['furhood', 'khanhat', 'khanhat', 'khanhat', 'khanhat', 'khanhat', 'cap'],
    titles: ['Clan Chief', 'Khan', 'Khan', 'Great Khan', 'Khagan', 'Khagan', 'Premier'],
    banner: 'horsetail', boat: 'galley', mounted: true,
    citySyllables: ['Kara', 'kor', 'um', 'Altan', 'Tem', 'ur', 'Bayan', 'Oyun', 'tai', 'Sar', 'khan', 'Bor', 'gol'],
  },
  wandering_herders: {
    name: 'Wandering Herders', lifestyle: 'nomadic', temperament: 'peaceful',
    inspiration: 'Sámi, Maasai & Bedouin herders',
    palette: { wall: '#d9c7a3', roof: '#8b6b4a', trim: '#2f6b8a' },
    houses: ['hidetent', 'hidetent', 'tent', 'tent', 'house', 'tenement', 'tower'],
    landmarks: ['hidetent', 'tent', 'standingstones', 'standingstones', 'dome', 'factory', 'skyscraper'],
    headgear: ['furhood', 'hood', 'hood', 'hood', 'hood', 'none', 'none'],
    titles: ['Elder', 'Elder', 'High Elder', 'Herd Lord', 'Herd Lord', 'Chancellor', 'President'],
    banner: 'pennant', boat: 'galley', mounted: true,
    citySyllables: ['Lá', 'vu', 'Ena', 'ro', 'Sii', 'da', 'Mor', 'ani', 'Kel', 'ta', 'Ova', 'jo'],
  },
  caravan_traders: {
    name: 'Caravan Traders', lifestyle: 'nomadic', temperament: 'mercantile',
    inspiration: 'Silk Road & Sahara caravan peoples',
    palette: { wall: '#ead2a4', roof: '#c06a3a', trim: '#3a5d9c' },
    houses: ['hidetent', 'tent', 'mudhouse', 'mudhouse', 'mudhouse', 'tenement', 'tower'],
    landmarks: ['tent', 'tent', 'caravanserai', 'caravanserai', 'dome', 'factory', 'skyscraper'],
    headgear: ['furhood', 'turban', 'turban', 'turban', 'turban', 'turban', 'none'],
    titles: ['Guide', 'Caravan Master', 'Caravan Master', 'Sultan', 'Sultan', 'Grand Vizier', 'President'],
    banner: 'pennant', boat: 'dhow', mounted: true,
    citySyllables: ['Sam', 'ar', 'kand', 'Bu', 'khar', 'Mer', 'v', 'Tad', 'mor', 'Ka', 'shan', 'Zar'],
  },
  legion_empire: {
    name: 'Legion Empire', lifestyle: 'settled', temperament: 'warlike',
    inspiration: 'Roman & Assyrian legions',
    palette: { wall: '#efe6d2', roof: '#b5523b', trim: '#8a1f1f' },
    houses: ['hut', 'mudhouse', 'house', 'house', 'house', 'tenement', 'skyscraper'],
    landmarks: ['hut', 'fort', 'temple', 'castle', 'castle', 'factory', 'skyscraper'],
    headgear: ['furhood', 'circlet', 'laurel', 'crown', 'crown', 'none', 'none'],
    titles: ['Warlord', 'King', 'Consul', 'Emperor', 'Emperor', 'Kaiser', 'Chancellor'],
    banner: 'eagle', boat: 'galley', mounted: false,
    citySyllables: ['Aur', 'elia', 'Val', 'entia', 'Cast', 'ra', 'Nov', 'um', 'Flav', 'ia', 'Port', 'us'],
  },
  temple_builders: {
    name: 'Temple Builders', lifestyle: 'settled', temperament: 'peaceful',
    inspiration: 'Egyptian, Maya & Khmer builders',
    palette: { wall: '#f1e2b8', roof: '#d4a24c', trim: '#2a7a6a' },
    houses: ['hut', 'mudhouse', 'mudhouse', 'house', 'house', 'tenement', 'skyscraper'],
    landmarks: ['standingstones', 'ziggurat', 'pyramid', 'pyramid', 'temple', 'factory', 'skyscraper'],
    headgear: ['none', 'nemes', 'nemes', 'nemes', 'crown', 'none', 'none'],
    titles: ['Shaman', 'Priest-King', 'Pharaoh', 'Pharaoh', 'Sovereign', 'Prime Minister', 'President'],
    banner: 'sun', boat: 'galley', mounted: false,
    citySyllables: ['Ta', 'neb', 'Itz', 'ama', 'Kem', 'et', 'Ank', 'or', 'Mer', 'u', 'Xel', 'ha'],
  },
  merchant_republic: {
    name: 'Merchant Republic', lifestyle: 'settled', temperament: 'mercantile',
    inspiration: 'Venetian, Hanseatic & Swahili traders',
    palette: { wall: '#f3e1c6', roof: '#c96f4a', trim: '#2a4a8a' },
    houses: ['hut', 'mudhouse', 'house', 'house', 'house', 'tenement', 'skyscraper'],
    landmarks: ['hut', 'market', 'market', 'dome', 'dome', 'factory', 'skyscraper'],
    headgear: ['none', 'cap', 'cap', 'dogecap', 'dogecap', 'tophat', 'none'],
    titles: ['Headman', 'Elder', 'Archon', 'Doge', 'Doge', 'Chancellor', 'President'],
    banner: 'square', boat: 'galley', mounted: false,
    citySyllables: ['Ven', 'ara', 'Lub', 'eck', 'Mom', 'basa', 'Gen', 'ova', 'Kil', 'wa', 'Bre', 'men'],
  },
  sea_raiders: {
    name: 'Sea Raiders', lifestyle: 'seafaring', temperament: 'warlike',
    inspiration: 'Norse & Wokou sea raiders',
    palette: { wall: '#b98a5a', roof: '#6a4a2a', trim: '#2a3a5a' },
    houses: ['hut', 'longhouse', 'longhouse', 'longhouse', 'house', 'tenement', 'skyscraper'],
    landmarks: ['hut', 'longhouse', 'hall', 'hall', 'castle', 'factory', 'skyscraper'],
    headgear: ['furhood', 'helm', 'helm', 'helm', 'crown', 'none', 'none'],
    titles: ['Chieftain', 'Jarl', 'Jarl', 'Sea King', 'King', 'Admiral', 'Premier'],
    banner: 'raven', boat: 'longship', mounted: false,
    citySyllables: ['Skar', 'vik', 'Hal', 'ford', 'Thor', 'sby', 'Ul', 'heim', 'Bjor', 'nes', 'Ryk', 'dal'],
  },
  island_voyagers: {
    name: 'Island Voyagers', lifestyle: 'seafaring', temperament: 'peaceful',
    inspiration: 'Polynesian & Austronesian wayfinders',
    palette: { wall: '#d9b878', roof: '#8a6a32', trim: '#1f8a8a' },
    houses: ['hut', 'fale', 'fale', 'fale', 'house', 'tenement', 'skyscraper'],
    landmarks: ['hut', 'fale', 'marae', 'marae', 'lighthouse', 'factory', 'skyscraper'],
    headgear: ['flowers', 'feathers', 'feathers', 'feathers', 'feathers', 'none', 'none'],
    titles: ['Navigator', 'Ariki', 'Ariki', 'High Ariki', 'Paramount Chief', 'Premier', 'President'],
    banner: 'wave', boat: 'outrigger', mounted: false,
    citySyllables: ['Mo', 'ana', 'Tai', 'ra', 'Hiva', 'Ko', 'lani', 'Rangi', 'Pua', 'Ata', 'nui'],
  },
  maritime_traders: {
    name: 'Maritime Traders', lifestyle: 'seafaring', temperament: 'mercantile',
    inspiration: 'Phoenician & Malay merchant fleets',
    palette: { wall: '#efdcb8', roof: '#7a3a7a', trim: '#7a2a6a' },
    houses: ['hut', 'mudhouse', 'house', 'house', 'house', 'tenement', 'skyscraper'],
    landmarks: ['hut', 'harbor', 'harbor', 'lighthouse', 'lighthouse', 'factory', 'skyscraper'],
    headgear: ['none', 'cap', 'cap', 'turban', 'turban', 'tophat', 'none'],
    titles: ['Headman', 'Merchant Prince', 'Suffete', 'Sultan', 'Sultan', 'Governor', 'President'],
    banner: 'square', boat: 'dhow', mounted: false,
    citySyllables: ['Tyr', 'os', 'Sid', 'on', 'Mal', 'aka', 'Gad', 'ir', 'Byb', 'los', 'Sri', 'pura'],
  },
};

export function styleFor(lifestyle, temperament) {
  for (const [key, s] of Object.entries(STYLES)) {
    if (s.lifestyle === lifestyle && s.temperament === temperament) return key;
  }
  return 'temple_builders';
}

// Generic fallback housing per age (used for buildings without a style override).
export const GENERIC_HOUSES = ['hut', 'mudhouse', 'house', 'house', 'house', 'tenement', 'skyscraper'];

// Exploration and civic advances. `effects` adjust the capability table in game.js.
export const ADVANCES = [
  { id: 'rafts', name: 'Reed Rafts', age: 0, icon: '🛶', cost: { wood: 20, knowledge: 8 }, desc: 'Paddle along coasts and across narrow straits (2 tiles from shore).', effects: { seaLevel: 1, seaSpeed: 2 } },
  { id: 'furs', name: 'Fur Clothing', age: 0, icon: '🧥', cost: { clothing: 15, knowledge: 6 }, desc: 'Halves the dangers of cold lands.', effects: { coldResist: 0.5 } },
  { id: 'waterskins', name: 'Waterskins', age: 0, icon: '💧', cost: { clothing: 10, food: 15, knowledge: 8 }, desc: 'Halves the dangers of deserts and savanna.', effects: { heatResist: 0.5 } },
  { id: 'foraging', name: 'Foraging Lore', age: 0, icon: '🍄', cost: { food: 25, knowledge: 10 }, desc: 'Expeditions can stay out 1 more turn and forage more.', effects: { endurance: 1, forage: 0.5 } },
  { id: 'horses', name: 'Horse Riding', age: 1, icon: '🐎', cost: { food: 40, knowledge: 25 }, needsDeposit: 'horses', desc: 'Doubles land speed. Requires discovered wild horses.', effects: { landSpeed: 2 } },
  { id: 'galleys', name: 'Oared Galleys', age: 1, icon: '🚣', cost: { wood: 50, knowledge: 25 }, needs: 'rafts', desc: 'Voyage up to 4 tiles from shore, twice as fast.', effects: { seaLevel: 2, seaSpeed: 2 } },
  { id: 'wheel', name: 'The Wheel', age: 1, icon: '🛞', cost: { wood: 40, knowledge: 20 }, desc: 'Carts carry 50% more loot. Settle and trade farther.', effects: { carry: 0.5, settleRange: 3, tradeRange: 4 } },
  { id: 'starcharts', name: 'Star Charts', age: 1, icon: '✨', cost: { stone: 15, knowledge: 30 }, desc: 'Expeditions map 1 extra tile around their path.', effects: { reveal: 1 } },
  { id: 'roads', name: 'Paved Roads', age: 2, icon: '🛣️', cost: { stone: 80, knowledge: 40 }, desc: 'Faster land travel; longer trade and settling range.', effects: { landSpeed: 1, tradeRange: 6, settleRange: 3 } },
  { id: 'medicine', name: 'Herbal Medicine', age: 2, icon: '🌿', cost: { luxuries: 5, knowledge: 40 }, desc: 'Halves jungle dangers; all hazards -15%.', effects: { jungleResist: 0.5, hazardMult: -0.15 } },
  { id: 'cartography', name: 'Cartography', age: 2, icon: '🗺️', cost: { clothing: 10, knowledge: 50 }, desc: 'Map 1 more tile around paths; +1 endurance.', effects: { reveal: 1, endurance: 1 } },
  { id: 'camels', name: 'Camel Caravans', age: 2, icon: '🐪', cost: { food: 50, knowledge: 30 }, desc: 'Deserts become far safer; carry 25% more.', effects: { heatResist: 0.3, carry: 0.25 } },
  { id: 'cogs', name: 'Deep-Hull Cogs', age: 3, icon: '⛵', cost: { wood: 80, iron: 15, knowledge: 60 }, needs: 'galleys', desc: 'Sail up to 7 tiles from shore and carry more.', effects: { seaLevel: 3, seaSpeed: 1, carry: 0.25 } },
  { id: 'compass', name: 'Magnetic Compass', age: 3, icon: '🧭', cost: { iron: 20, knowledge: 70 }, desc: 'Halves sea dangers; +1 endurance.', effects: { seaResist: 0.5, endurance: 1 } },
  { id: 'printing', name: 'Printing Press', age: 3, icon: '📖', cost: { wood: 40, knowledge: 90 }, desc: 'Knowledge +25%.', effects: { knowledgeMult: 0.25 } },
  { id: 'steel', name: 'Steel Weapons', age: 3, icon: '🗡️', cost: { iron: 50, knowledge: 60 }, desc: 'Population power +30%.', effects: { strengthMult: 0.3 } },
  { id: 'caravels', name: 'Caravels', age: 4, icon: '🚢', cost: { wood: 120, iron: 30, knowledge: 100 }, needs: 'cogs', desc: 'Cross the open ocean.', effects: { seaLevel: 4, seaSpeed: 2 } },
  { id: 'telescope', name: 'Telescope', age: 4, icon: '🔭', cost: { gold: 40, knowledge: 110 }, desc: 'Map 1 more tile around paths.', effects: { reveal: 1 } },
  { id: 'quinine', name: 'Quinine', age: 4, icon: '💊', cost: { luxuries: 15, knowledge: 90 }, desc: 'Jungles lose most of their danger; +1 endurance.', effects: { jungleResist: 0.4, endurance: 1 } },
  { id: 'steamships', name: 'Steamships', age: 5, icon: '🛳️', cost: { iron: 120, wood: 100, knowledge: 200 }, needs: 'caravels', desc: 'Sea speed doubled and storms matter less.', effects: { seaSpeed: 7, seaResist: 0.2 } },
  { id: 'railroads', name: 'Railroads', age: 5, icon: '🚂', cost: { iron: 150, stone: 100, knowledge: 200 }, desc: 'Huge land speed; trade far and wide.', effects: { landSpeed: 6, tradeRange: 10, settleRange: 6 } },
  { id: 'canning', name: 'Canned Food', age: 5, icon: '🥫', cost: { iron: 40, food: 150, knowledge: 150 }, desc: '+3 endurance; expeditions eat 40% less.', effects: { endurance: 3, foodMult: -0.4 } },
  { id: 'aviation', name: 'Aviation', age: 6, icon: '✈️', cost: { iron: 200, gold: 200, knowledge: 350 }, desc: 'Fly anywhere, ignoring terrain. Map 2 more tiles.', effects: { air: 1, reveal: 2 } },
  { id: 'radio', name: 'Radio', age: 6, icon: '📻', cost: { gold: 150, knowledge: 300 }, desc: '+2 simultaneous expeditions; hazards halved.', effects: { maxExpeditions: 2, hazardMult: -0.5 } },
];

export const BUILDINGS = [
  { id: 'granary', name: 'Granary', icon: '🌾', age: 0, cost: { wood: 25, stone: 10 }, desc: '+2 food, +3 housing.', yields: { food: 2 }, housing: 3 },
  { id: 'lumber', name: 'Lumber Camp', icon: '🪓', age: 0, cost: { food: 20, wood: 10 }, desc: '+2 wood.', yields: { wood: 2 } },
  { id: 'tannery', name: 'Tannery', icon: '🧥', age: 0, cost: { wood: 20, food: 15 }, desc: '+2 clothing.', yields: { clothing: 2 } },
  { id: 'quarry', name: 'Stoneworks', icon: '🪨', age: 0, cost: { wood: 20, food: 20 }, desc: '+2 stone.', yields: { stone: 2 } },
  { id: 'barracks', name: 'Barracks', icon: '🛡️', age: 1, cost: { wood: 30, stone: 30 }, desc: 'Population power +20% and safer from raids.', strength: 0.2 },
  { id: 'harbor', name: 'Harbor', icon: '⚓', age: 1, coastal: true, cost: { wood: 50, stone: 20 }, desc: '+2 food; sea expeditions from here use 30% less wood.', yields: { food: 2 } },
  { id: 'library', name: 'Library', icon: '📚', age: 1, cost: { wood: 30, stone: 40 }, desc: '+2 knowledge.', yields: { knowledge: 2 } },
  { id: 'market', name: 'Market', icon: '⚖️', age: 2, cost: { wood: 40, stone: 40, gold: 10 }, desc: '+2 gold, +1 trade route slot.', yields: { gold: 2 }, tradeSlots: 1 },
  { id: 'smithy', name: 'Smithy', icon: '⚒️', age: 1, cost: { wood: 40, stone: 50 }, desc: '+2 iron.', yields: { iron: 2 } },
  { id: 'walls', name: 'Walls', icon: '🧱', age: 2, cost: { stone: 80 }, desc: 'Doubles defense against raids.', defense: 1 },
  { id: 'university', name: 'University', icon: '🎓', age: 4, cost: { stone: 80, gold: 60 }, desc: '+5 knowledge.', yields: { knowledge: 5 } },
  { id: 'factory', name: 'Factory', icon: '🏭', age: 5, cost: { iron: 80, stone: 80, gold: 50 }, desc: '+3 wood, +3 iron, +3 clothing.', yields: { wood: 3, iron: 3, clothing: 3 } },
];

export const PARTY_SIZES = [
  { id: 'scouts', name: 'Scouts', size: 2, minAge: 0 },
  { id: 'band', name: 'Band', size: 5, minAge: 0 },
  { id: 'expedition', name: 'Expedition', size: 10, minAge: 1 },
  { id: 'grand', name: 'Grand Expedition', size: 20, minAge: 3 },
];

export const CIV_LEVELS = ['Band', 'Tribe', 'Chiefdom', 'Kingdom', 'Empire', 'Nation'];

// Invented name syllables per world region for other peoples.
export const REGION_SYLLABLES = {
  europe: ['Al', 'bri', 'Gal', 'ten', 'Vor', 'is', 'Lu', 'sa', 'Kel', 'Dan', 'mar', 'Ost', 'ri', 'Pel', 'go'],
  africa: ['Ka', 'zi', 'Mba', 'lo', 'Ny', 'ama', 'Sa', 'hel', 'Twa', 'Ko', 'ngo', 'Zu', 'ri', 'Oyo', 'Ba'],
  mideast: ['Ash', 'ur', 'Ela', 'm', 'Sab', 'a', 'Nab', 'at', 'Uru', 'k', 'Mit', 'ani', 'Kas', 'Dil'],
  southasia: ['Mag', 'ad', 'Sin', 'dh', 'Kal', 'inga', 'Vija', 'ya', 'Tam', 'ra', 'Chol', 'Pan', 'dya'],
  eastasia: ['Shu', 'Han', 'go', 'Jo', 'mon', 'Ryu', 'Bai', 'yue', 'Kor', 'ye', 'Xia', 'Lan', 'Tai'],
  siberia: ['Yak', 'ut', 'Evo', 'n', 'Chuk', 'chi', 'Nen', 'ets', 'Ket', 'Ula', 'Tun', 'gus'],
  northamerica: ['Ana', 'sa', 'zi', 'Hoh', 'ok', 'Mis', 'sip', 'Que', 'ta', 'Cho', 'naw', 'Ish', 'ka'],
  mesoamerica: ['Olm', 'ec', 'Tol', 'tec', 'Zap', 'o', 'Mix', 'te', 'Cha', 'ac', 'Tzu', 'Kab', 'ah'],
  southamerica: ['Nor', 'te', 'Chi', 'mu', 'Ay', 'mara', 'Mo', 'che', 'Tup', 'i', 'Wari', 'Gua', 'rani'],
  oceania: ['Ma', 'ori', 'Rapa', 'Ton', 'ga', 'Yol', 'ngu', 'Ara', 'nda', 'Kana', 'ka', 'Pal', 'au'],
};

// Rough lat/lon boxes for desert, steppe, savanna, jungle and mountain belts.
// [latMin, latMax, lonMin, lonMax]
export const CLIMATE_BOXES = {
  desert: [
    [15, 32, -17, 34], [13, 32, 34, 60], [24, 37, 50, 72], [37, 46, 76, 108], [-32, -19, 116, 142],
    [-29, -17, 12, 22], [-27, -14, -72, -68], [25, 37, -118, -103], [-48, -38, -71, -65], [23, 30, 68, 73],
  ],
  steppe: [
    [43, 54, 30, 90], [44, 52, 90, 120], [32, 50, -106, -96], [-38, -29, -64, -57], [33, 42, 34, 60],
    [11, 16, -17, 38], [-35, -26, 135, 150], [-35, -30, 115, 125],
  ],
  savanna: [
    [-18, 11, 10, 42], [-26, -12, 22, 36], [-22, -6, -60, -40], [-20, -12, 125, 145], [6, 11, -16, 10],
    [10, 25, 73, 85], [-26, -14, -64, -56],
  ],
  jungle: [
    [-12, 6, -78, -48], [-5, 6, 9, 30], [-10, 20, 95, 155], [7, 20, -92, -76], [6, 10, -13, 0],
    [-10, -5, 140, 150],
  ],
};

// Mountain ranges as polylines of [lat, lon] with a half-width in tiles.
export const MOUNTAIN_RANGES = [
  { pts: [[36, 71], [34, 77], [30, 81], [28, 86], [27, 92], [29, 96]], w: 1.4 }, // Himalaya
  { pts: [[40, 70], [42, 77], [43, 84], [44, 90]], w: 1.1 }, // Tian Shan
  { pts: [[38, 70], [37, 74], [36, 78]], w: 1 }, // Pamir/Karakoram
  { pts: [[10, -73], [2, -77], [-8, -78], [-16, -71], [-25, -68], [-35, -70], [-45, -72], [-52, -73]], w: 1 }, // Andes
  { pts: [[60, -140], [55, -128], [49, -116], [43, -110], [37, -107], [31, -108]], w: 1.2 }, // Rockies
  { pts: [[38, -122], [44, -122], [48, -121]], w: 0.7 }, // Cascades/Sierra
  { pts: [[45.5, 6.5], [46.5, 9], [47, 12.5]], w: 0.8 }, // Alps
  { pts: [[68, 65], [62, 60], [55, 59], [51, 58]], w: 0.8 }, // Urals
  { pts: [[43, 40], [42.5, 44], [41.5, 48]], w: 0.8 }, // Caucasus
  { pts: [[38, 47], [34, 49], [30, 52], [28, 56]], w: 1 }, // Zagros
  { pts: [[31, -8], [33, -3], [35, 3], [36, 8]], w: 0.8 }, // Atlas
  { pts: [[12, 38], [8, 38], [3, 37], [-3, 36], [-9, 34]], w: 0.9 }, // East African highlands
  { pts: [[-16, 145], [-24, 150], [-32, 151], [-37, 148]], w: 0.6 }, // Great Dividing Range
  { pts: [[34, -84], [38, -80], [42, -76], [45, -71]], w: 0.6 }, // Appalachians
  { pts: [[62, 7], [66, 14], [69, 19]], w: 0.7 }, // Scandinavian
  { pts: [[30, 100], [27, 100], [22, 102]], w: 0.8 }, // Hengduan
  { pts: [[52, 100], [50, 110], [52, 120]], w: 0.6 }, // Sayan
  { pts: [[60, 140], [64, 150], [67, 165]], w: 0.8 }, // Verkhoyansk/Chersky
  { pts: [[42.8, 0], [42.6, 2]], w: 0.5 }, // Pyrenees
  { pts: [[-2, 138], [-4, 142]], w: 0.6 }, // New Guinea highlands
  { pts: [[36, 138], [38, 140]], w: 0.5 }, // Japanese Alps
];
