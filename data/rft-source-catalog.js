/*
 * Source-verified public product data for the RFT listings.
 *
 * The reseller panel exposes feature blocks and media for these listings. The
 * storefront keeps the feature data concise and factual instead of copying a
 * third-party description or locked setup guide verbatim.
 */
export const rftSourceCatalog = Object.freeze({
  "apex-raiko": {
    features: ["Configurable aimbot", "Player, NPC, loot, interactable and vehicle ESP", "Radar, compass and status overlays", "Triggerbot, full-auto and bunny-hop controls"],
    featureGroups: [
      { title: "Aimbot", items: ["Aim distance, bones, FOV, smoothing and humanizer controls", "Aim-key, visibility, downed-target and target-priority filters", "Triggerbot, full-auto and bunny-hop options"] },
      { title: "ESP", items: ["Players, NPCs, loot, interactables and vehicles", "Chams and adjustable visual styles"] },
      { title: "Overlays", items: ["Radar, compass, crosshair, server information and status bars"] },
    ],
    requirements: ["Windows PC with Apex Legends installed", "Use the delivered Raiko download for this listing", "Review the dedicated guide before launch"],
    media: ["https://i.ibb.co/4g1BQ5Td/image.png"],
  },
  "apex-akuma": {
    features: ["Configurable aimbot", "Triggerbot with multiple activation modes", "Player and bot ESP", "Native controller support", "Spectator and crosshair utilities"],
    featureGroups: [
      { title: "Aim assistance", items: ["FOV, smoothing, prediction, stickiness and bone selection", "Target filtering for visibility, teams, bots and knocked players", "Triggerbot with hold, toggle and always modes"] },
      { title: "Player ESP", items: ["Chams, boxes, skeleton, head circle, health/shield, names, level, legend, team ID and distance", "Snaplines, visibility checks and adjustable ESP size"] },
      { title: "Utilities", items: ["Native controller support, super glide, tap strafe, spectator list and crosshair"] },
    ],
    requirements: ["Windows PC with Apex Legends installed", "Native controller support is listed by the source panel", "Use the delivered Akuma download for this listing"],
    media: ["https://trixxware.com/uploads/monthly_2026_06/image_2026-06-11_21-30-37(1).webp.ed094b2d48fe8a1916b3ad55c85aefc5.webp"],
  },
  "rust-disconnect": {
    features: ["No feature list published in the source panel"],
    featureGroups: [{ title: "Source listing", items: ["The panel provides a separate Disconnect setup document; no feature block was published."] }],
    requirements: ["Windows PC with Rust installed", "Use the delivered Disconnect installer", "Follow the matching setup document before launch"],
  },
  "rust-ancient": {
    features: ["Internal utility", "Aimbot and target filtering", "Player, world, object and raid ESP", "Chams, environment controls and configuration profiles"],
    featureGroups: [
      { title: "Aim and targets", items: ["Silent or memory aim, aim key, hit chance, FOV, smoothing and bone selection", "Filters for enemies, NPCs, teammates, sleepers and friends"] },
      { title: "Visuals", items: ["Player colors and chams, crosshair, target line, prediction dot and adjustable render distance", "Resources, crates, animals, collectables, deployables, traps and transport"] },
      { title: "Raid and utility", items: ["Raid timer and explosive markers, bright-night/environment options, friendship tools and panic button", "Preset and configuration save/load controls"] },
    ],
    requirements: ["Rust on a supported platform", "Internal utility with stream-compatible visuals listed by the source panel", "Use the delivered Ancient download for this listing"],
  },
  "rust-skyra": {
    features: ["Aimbot and recoil assistance", "Combat exploit controls", "Player, NPC and world ESP", "Chams, radar and configuration tools"],
    featureGroups: [
      { title: "Combat", items: ["Memory aim with prediction, visibility, FOV, hitchance and target-line controls", "Recoil/spread compensation, no sway, rapid fire, bow/Eoka and mounted-fire options"] },
      { title: "Visuals", items: ["Player and NPC ESP with skeleton, boxes, names, items, team IDs, snaplines and hotbar details", "Chams for players, weapons and hands, plus crosshair and local feedback"] },
      { title: "World and settings", items: ["Resources, collectables, crates, animals, vehicles, traps, bases, stashes and dropped items", "FOV/zoom, movement utilities, radar and save/load configuration"] },
    ],
    requirements: ["Windows PC with Rust installed", "Use the delivered Skyra download for this listing", "Review the matching setup document before launch"],
    media: ["https://i.ibb.co/W4qhmJDw/image.png"],
    videos: ["https://streamable.com/e/7dseau"],
  },
  "rust-arcane": {
    features: ["Vector or silent aimbot", "Player, inventory, item and object ESP", "Waypoints and team/friend-enemy tools", "Rust utility controls and profiles"],
    featureGroups: [
      { title: "Aimbot and players", items: ["Target, bone, mode, prediction, FOV, hit chance, smoothing and visibility controls", "Player boxes, lines, teams, bots, sleeping players, weapons and distance"] },
      { title: "World awareness", items: ["Inventory, item filters, resources, animals, vehicles, chests, corpses, traps and world objects", "Waypoints, compass and configurable friend/enemy colors"] },
      { title: "Miscellaneous", items: ["Battle mode, recoil/sway/spread controls, movement utilities, fullbright and FOV/zoom options", "Menu, unload and configuration controls"] },
    ],
    requirements: ["Windows PC with Rust installed", "Use one supported overlay option from the dedicated guide", "Use the delivered Arcane download for this listing"],
    media: ["https://i.ibb.co/BHxXCQ62/xjgbj19nvdc02i925ndqd8g86clanybt.jpg"],
  },
  "fortnite-disconnect": {
    features: ["No feature list published in the source panel"],
    featureGroups: [{ title: "Source listing", items: ["The panel provides a separate Disconnect setup document; no feature block was published."] }],
    requirements: ["Windows PC with Fortnite installed", "Use the delivered Disconnect installer", "Follow the matching setup document before launch"],
  },
  "fortnite-akuma": {
    features: ["Aimbot with controller support", "Triggerbot with activation modes", "Player and bot ESP", "Chams and item ESP", "FOV and combat-mode controls"],
    featureGroups: [
      { title: "Aim", items: ["Aimbot FOV, smoothing, speed, stickiness, bones, visibility and target-line controls", "Triggerbot with shotgun-only, hold, toggle and always options"] },
      { title: "Visuals", items: ["Player and bot skeleton, head circle, direction, off-screen arrow, names, rank, distance, platform, team index and weapon", "Chams for players, bots and the local character, plus rarity-filtered item visuals"] },
      { title: "Utilities", items: ["Native controller support, FOV changer and combat mode that hides world visuals"] },
    ],
    requirements: ["Windows PC with Fortnite installed", "Native controller support is listed by the source panel", "Use the delivered Akuma download for this listing"],
    media: ["https://i.ibb.co/7JpLk2r6/image-2026-06-01-23-39-30.png"],
  },
  "pubg-arcane-browser-radar": {
    features: ["No feature list published in the source panel"],
    featureGroups: [{ title: "Source listing", items: ["The listing is identified as a browser radar; the panel did not publish a separate feature block."] }],
    requirements: ["Windows PC with PUBG installed", "Use the delivered Arcane download for this listing", "Review the matching setup document before launch"],
    media: ["https://i.ibb.co/99W0X5VJ/image.png"],
  },
  "pubg-ancient": {
    features: ["Static or curved aimbot", "Player ESP and mini-map radar", "World ESP and categorized loot filters", "Config and FPS controls"],
    featureGroups: [
      { title: "Aim", items: ["FOV, smoothing, prediction, target bones, visibility, lock-target and recoil-control settings"] },
      { title: "Players", items: ["Boxes, skeletons, names, distance, health, knocked/spectator information, team and bot filters", "Mini-map radar and spectator count"] },
      { title: "World and configs", items: ["Airdrops, corpses, vehicles, weapons, armor, healing, boosts, ammo and attachments", "Category filters, per-category distance controls and save/load settings"] },
    ],
    requirements: ["Windows PC with PUBG installed", "Use the delivered Ancient download for this listing", "Select the intended PUBG term before checkout"],
  },
  "pubg-arcane-esp-no-recoil": {
    features: ["Player ESP with adjustable rendering", "Categorized item ESP", "Vehicle, drop and throwable ESP", "No-recoil and crosshair utilities"],
    featureGroups: [
      { title: "Players", items: ["Boxes, fills, health, skeleton, names, weapons, ammo, levels, spectators, kills, team and visibility checks"] },
      { title: "Items and world", items: ["Filtered weapons, armor, medical items, ammo, attachments and other loot", "Vehicles, airdrops, death crates, drop contents and throwable timing/radius details"] },
      { title: "Miscellaneous", items: ["No recoil, crosshair, spectator count, off-screen arrows and battle-mode control"] },
    ],
    requirements: ["Windows PC with PUBG installed", "Use the delivered Arcane download for this listing", "Review the matching setup document before launch"],
  },
  "pubg-arcane-blindspot": {
    features: ["Player ESP", "Adjustable box, fill, line, health and armor styles", "Skeleton, name, distance and render-distance controls", "Configuration and menu controls"],
    featureGroups: [
      { title: "Player visuals", items: ["Boxes, fills, view lines, enemy lines, health/armor bars, skeleton and head-circle options"] },
      { title: "Settings", items: ["Menu and unload keybinds, DPI scale, FPS limit, theme, watermark and language"] },
      { title: "Profiles", items: ["Create, load, rename and delete configuration profiles"] },
    ],
    requirements: ["Windows PC with PUBG installed", "Use the delivered Arcane download for this listing", "Review the matching setup document before launch"],
    media: ["https://i.ibb.co/0VBZLQSF/3y731zzcpbaqpglcd08aqizfqu0aaigw.jpg"],
  },
  "delta-force-toshi": {
    features: ["Advanced aimbot and target priority", "Player ESP and customizable overlays", "Radar, health, threat and crosshair widgets", "Native controller and configuration support"],
    featureGroups: [
      { title: "Aimbot", items: ["Lock-on, bone scan, target priority, prediction, smoothing curves, aim delay and controller support"] },
      { title: "ESP and widgets", items: ["Friendly/enemy/actor filters, snaplines, FOV circle, compass, radar, health, threat and weapon widgets"] },
      { title: "Crosshair and profiles", items: ["Custom crosshair editor with presets, live preview and adjustable geometry", "Save, import, export, rename and share configuration profiles"] },
    ],
    requirements: ["Windows PC with Delta Force installed", "Full controller support is listed by the source panel", "Use the delivered Toshi download for this listing"],
    media: ["https://trixxware.com/uploads/monthly_2026_05/ToshiDeltaForceImage1.png.0a5f4da29aec03a46b760769e52c0bbf.png"],
  },
  "delta-force-akuma": {
    features: ["Aimbot with controller keybinds", "Player and loot ESP", "Customizable chams", "Camera, weapon and combat utilities"],
    featureGroups: [
      { title: "Aim and players", items: ["FOV, smoothing, speed, stickiness, bone filters, visibility and knocked-target controls", "Player boxes, skeletons, names, equipment, health, team, weapons, snaplines and distance"] },
      { title: "Loot and chams", items: ["Loot name, rarity, price, minimum-price and distance filters", "Customizable player, AI, weapon, hands and self chams"] },
      { title: "Miscellaneous", items: ["Instant-hit, camera FOV, third-person, weapon/arm offsets, crosshair and entity-hiding combat mode"] },
    ],
    requirements: ["Windows PC with Delta Force installed", "Native controller keybinds are listed by the source panel", "Use the delivered Akuma download for this listing"],
    media: ["https://i.ibb.co/nMSPjd1p/image-2026-03-09-04-29-14.png"],
  },
  "marvel-rivals-arcane": {
    features: ["Vector, silent or pSilent aimbot", "Player ESP with hero information", "Object tracking", "Profiles and visual settings"],
    featureGroups: [
      { title: "Aim", items: ["Bone and priority selection, prediction, adaptive FOV, smoothing and silent-chance controls"] },
      { title: "Players and objects", items: ["Boxes, fills, lines, health bars, skeletons, hero names, names and distance", "Object distance, health spawner and ultimate-charge indicators"] },
      { title: "Settings", items: ["Menu/unload keybinds, DPI scale, FPS limit, theme, watermark, language and configuration profiles"] },
    ],
    requirements: ["Windows PC with Marvel Rivals installed", "Use the delivered Arcane download for this listing", "Review the matching setup document before launch"],
  },
  "battlefield6-arcane": {
    features: ["Aimbot with selectable target modes", "Player and bot ESP", "Adjustable visibility and render controls", "Crosshair utility"],
    featureGroups: [
      { title: "Aimbot", items: ["Always/on-hold modes, player/bot/team filters, bone selection, visibility check, FOV, smoothing and distance"] },
      { title: "Player visuals", items: ["Boxes, fills, health bars, skeleton, names, distance, enemy lines, view lines and bot/team filters"] },
      { title: "Miscellaneous", items: ["Crosshair and adjustable transparency/render controls"] },
    ],
    requirements: ["Windows PC with Battlefield 6 installed", "Use the delivered Arcane download for this listing", "Review the matching setup document before launch"],
    videos: ["https://streamable.com/e/qljl9v"],
  },
  "eft-ancient-chams": {
    features: ["Color-coded chams for player groups", "Value-based loot and container coloring", "Recoil, sway, visor and stamina utilities", "Preset and configuration support"],
    featureGroups: [
      { title: "Chams", items: ["Separate visible/invisible colors for PMC, team, scav, AI and boss entities"] },
      { title: "Loot", items: ["Value thresholds, container filters and category selection for loot highlighting"] },
      { title: "Utilities", items: ["No recoil, no sway, no visor, instant ADS and infinite stamina", "Load/save presets and configurations"] },
    ],
    requirements: ["Windows PC with Escape from Tarkov installed", "Use the delivered Ancient download for this listing", "Review the matching setup document before launch"],
    videos: ["https://streamable.com/e/z48kdn"],
  },
  "eft-ancient-full": {
    features: ["Aimbot and target-priority controls", "Player, bot, scav, boss and teammate ESP", "Loot, container, corpse and radar systems", "Weapon, movement, inventory and camera utilities", "Configuration import/export"],
    featureGroups: [
      { title: "Aim and visuals", items: ["FOV, target bones, role filters, visibility, prediction, target lock and priority controls", "Boxes, fills, chams, skeletons, names, distance, weapon, quest, health and price overlays"] },
      { title: "World awareness", items: ["Exfils, transitions, quests, radar, OOF arrows, weather and loot coloring/filter presets", "Containers and corpses with category, distance and price controls"] },
      { title: "Utilities", items: ["Stamina, jump, inertia, recoil, sway, reload, inventory reach, thermal/third-person and free-camera tools", "Create, import, load, export, save and delete profiles"] },
    ],
    requirements: ["Windows PC with Escape from Tarkov installed", "Use the delivered Ancient download for this listing", "Review the matching setup document before launch"],
  },
  "cod-bo7-zeroaim": {
    features: ["Configurable aimbot", "Player and loot ESP", "2D radar with team controls", "Weapon-specific aim profiles", "Streamer and performance settings"],
    featureGroups: [
      { title: "Aimbot", items: ["Strength, randomization, bone, FOV, key, priority, range, visibility and downed-target controls"] },
      { title: "Visuals", items: ["Player boxes, skeletons, names, distance, weapons, teams, health, visibility alerts and adjustable styles", "Loot range, fonts and per-category item display"] },
      { title: "Radar and settings", items: ["In-game radar with border, team, height and position controls", "Separate shotgun, pistol/SMG, rifle and sniper profiles plus streamer/VSync/FPS options"] },
    ],
    requirements: ["Windows PC with the supported Call of Duty titles installed", "Use the delivered ZeroAim download for this listing", "Review the product guide before launch"],
    media: ["https://i.ibb.co/s9sN41p0/ingame2-thumb-webp-a5a390e0acc75a4a96072c8c7d28a9db.webp"],
  },
  "cod-bo7-ghost-external": {
    features: ["100% external streamproof overlay", "Aimbot and entity ESP", "Radar and team controls", "Anti-recording and configuration tools"],
    featureGroups: [
      { title: "Compatibility", items: ["Windows 10/11 builds 23H2 and 24H2", "Steam, Battle.net and Game Pass support, AMD/Intel processors and full controller support"] },
      { title: "Aim and ESP", items: ["Lock-on, prediction, target filters, FOV, smoothing, deadzone, bones and custom keys", "Boxes, skeletons, snaplines, health, names, distance, teams and zombie/player/bot tracking"] },
      { title: "Privacy", items: ["External overlay, anti-recording mode, radar, color controls and save/load configuration"] },
    ],
    requirements: ["Windows 10/11 build 23H2 or 24H2", "Steam, Battle.net or Game Pass", "AMD or Intel processor; full controller support is listed by the source panel"],
  },
  "cod-bo7-ghost-internal": {
    features: ["Internal aimbot and ESP", "Radar, compass and lobby warnings", "Controller and Discord overlay support", "Color, thickness and configuration controls"],
    featureGroups: [
      { title: "Compatibility", items: ["Windows 10/11, Steam, Battle.net and Game Pass", "Full controller support and Discord overlay enabled"] },
      { title: "Aim and visuals", items: ["Aim method, bones, visibility, distance, FOV, smoothing and team/downed/vehicle filters", "Boxes, bones, health, snaplines, names, distance, platform, kills, assists, score, damage and ping"] },
      { title: "Radar and warnings", items: ["Radar/compass with lobby list, nearby warnings and enemy aim/look warnings", "Custom colors, thickness, dark mode and configuration support"] },
    ],
    requirements: ["Windows 10/11", "Steam, Battle.net or Game Pass", "Full controller support is listed by the source panel"],
    videos: ["https://streamable.com/e/3wkp8p"],
  },
  "cod-bo7-shield": {
    features: ["100% external overlay", "Double-bind aimbot controls", "Player ESP and radar", "Controller workflow through AntimicroX"],
    featureGroups: [
      { title: "Aim", items: ["Smooth control, FOV, bone selection, enemy scanning, prioritization and distance"] },
      { title: "ESP", items: ["Filled/corner boxes, lines, skeleton, names, distance, radar, health, UAV and visible-only filters"] },
      { title: "Compatibility", items: ["Spoofer is not included", "Controller support is listed with AntimicroX"] },
    ],
    requirements: ["Windows PC with the supported Call of Duty title installed", "Spoofer is not included", "Controller workflow requires AntimicroX according to the source panel"],
    media: ["https://i.ibb.co/8462dzLf/image.png"],
  },
  "cod-bo7-mist": {
    features: ["External cheat with web menu and spoofer", "Shareable radar and world map", "Aimbot modes and player/NPC ESP", "Lobby information and configuration", "Mobile, desktop and console-compatible sharing"],
    featureGroups: [
      { title: "Web access", items: ["Browser-based control panel, real-time updates and shareable radar/world-map links", "Access from mobile, desktop and console browsers"] },
      { title: "Aim and visuals", items: ["Legit, ranked, semi-legit and rage modes with controller, prediction, filters, deadzone and lock-on", "Player/NPC boxes, skeletons, names, health, snaplines, distance, crosshair and FOV"] },
      { title: "Lobby and setup", items: ["Lobby stats, player lists, alive/dead status, kills, rank, ping, teams, bot/difficulty detection and prestige tracking", "Config, keybind, color and distance controls; setup details are shown in the dedicated guide"] },
    ],
    requirements: ["Windows PC with the supported Call of Duty title installed", "External cheat and HWID spoofer are listed as included", "Web radar sharing requires the network setup described in the dedicated guide"],
    media: ["https://i.ibb.co/1GRXvDv7/mist-cheat-image-1.png", "https://i.ibb.co/9Hr5N3vs/image.png"],
  },
  "cod-bo7-zerox": {
    features: ["Internal rage-focused aimbot", "Target filters and AI/team ESP", "Color-customizable overlays", "Third-person and developer-mode utilities", "Multiple config slots"],
    featureGroups: [
      { title: "Aim and targeting", items: ["Aimbot, silent aim, aim/override keys, FOV, smoothing, prediction and humanization", "Sway compensation, no recoil, visibility checks, downed/friendly/AI filters and threat priority"] },
      { title: "ESP", items: ["Boxes, 3D boxes, health, skeleton, names, distance, weapon names, snaplines, compass, AI/team/target display and per-state colors"] },
      { title: "Utilities", items: ["Spoofer is not included; third-person, spin/jitter/pitch and developer-mode options are listed", "Ten save slots are listed by the source panel"] },
    ],
    requirements: ["Windows PC with the supported Call of Duty title installed", "Spoofer is not included; the source listing points to a separate spoofer", "Use the delivered Zerox download for this listing"],
    media: ["https://i.ibb.co/DPLW2XLj/image.png"],
  },
  "cod-bo7-dma-mist": {
    features: ["DMA aimbot and bot aim", "Player and bot ESP", "2D radar and Warzone mode", "Lobby and color controls", "Some profile features are marked coming soon"],
    featureGroups: [
      { title: "Required hardware", items: ["DMA card, fuser, KMBox.net or MACKU and two PCs", "A working DMA setup is required before purchase"] },
      { title: "Aim and visuals", items: ["Aim presets, FOV, smoothing, prediction, locks, filters and bot targeting", "Player/bot boxes, bones, names, health, snaplines, distance, crosshair, FOV and rainbow ESP"] },
      { title: "Radar and profiles", items: ["2D radar, Warzone mode, distance/range and bot display", "Lobby popup, spectator list and compass; profile save/load/keybind features are marked coming soon"] },
    ],
    requirements: ["DMA card", "Fuser", "KMBox.net or MACKU", "Two PCs and an already-working DMA setup"],
    media: ["https://i.ibb.co/398jL9jk/image.png"],
  },
  "cod-bo7-royal": {
    features: ["Preset-based aimbot and triggerbot", "Player, bot and loot ESP", "HUD, radar and browser radar", "Streamer/performance and protection controls", "Per-state color customization"],
    featureGroups: [
      { title: "Aim", items: ["Legit, semi-legit, rage and trigger presets with FOV, bones, priority, prediction, humanization and target delays", "Controller support, custom keybinds and snap/lock indicators"] },
      { title: "Visuals and loot", items: ["Boxes, skeletons, snaplines, health, names, distance, weapons, bots, compass, mini radar and lobby information", "Loot filters for cash, armor, supplies, contracts, ammo, weapons, equipment and killstreaks"] },
      { title: "Utility", items: ["Browser-based radar, streamproof/streamer mode, V-Sync, FPS limiter, hit sound, anti-screenshot and custom themes"] },
    ],
    requirements: ["Windows PC with the supported Call of Duty title installed", "Use the delivered Royal download for this listing", "Review the product guide before launch"],
    media: ["https://i.ibb.co/Xrc95mc1/image.png"],
  },
  "cod-bo7-unlock-all": {
    features: ["Soft unlock-all tool", "TPM and HWID spoofer included", "Camo, operator, calling-card and prestige unlocks"],
    featureGroups: [{ title: "Included", items: ["All Windows versions listed", "Unlocks every item through the tool", "Camos and operators may not persist, according to the source listing"] }],
    requirements: ["Windows PC with the supported Call of Duty title installed", "TPM/HWID spoofer is listed as included", "Use the delivered Ghost download for this listing"],
    videos: ["https://streamable.com/e/zcs2cl"],
  },
  "cod-ldv4": {
    features: ["Mouse or controller aimbot", "Player ESP and radar", "No recoil, no spread, triggerbot and reload utilities", "Mobile shared radar", "Config and account-status panels"],
    featureGroups: [
      { title: "Aim and visuals", items: ["Aim mode, bones, FOV, smoothness, prediction, priority and controller strength", "Boxes, skeletons, names, distance, health and visible/invisible color states"] },
      { title: "Radar and utilities", items: ["Radar scale/opacity, enemy/team display, direction sync and mobile QR sharing", "No recoil, no spread, triggerbot, auto reload, hold-breath assist and FPS display"] },
      { title: "Account and settings", items: ["Config save/load/delete, auto-load, username, subscription, remaining time, HWID and auth-server status", "Menu key, language, theme and opacity controls"] },
    ],
    requirements: ["Windows PC with a supported MW3-BO7 title installed", "Use the delivered LDV4 download for this listing", "Review the product guide before launch"],
    media: ["https://i.ibb.co/TDDDv3YS/image.png"],
  },
  "cod-progress": {
    features: ["Mouse or controller aimbot", "Player ESP and radar", "No recoil, no spread, triggerbot and reload utilities", "Mobile shared radar", "Config and account-status panels"],
    featureGroups: [
      { title: "Aim and visuals", items: ["Aim mode, bones, FOV, smoothness, prediction, priority and controller strength", "Boxes, skeletons, names, distance, health and visible/invisible color states"] },
      { title: "Radar and utilities", items: ["Radar scale/opacity, enemy/team display, direction sync and mobile QR sharing", "No recoil, no spread, triggerbot, auto reload, hold-breath assist and FPS display"] },
      { title: "Account and settings", items: ["Config save/load/delete, auto-load, username, subscription, remaining time, HWID and auth-server status", "Menu key, language, theme and opacity controls"] },
    ],
    requirements: ["Windows PC with a supported MW2-BO7 title installed", "Use the delivered Progress download for this listing", "Review the product guide before launch"],
    media: ["https://i.ibb.co/DHm2Jbs0/image.png"],
  },
  "cod-bo7-thunex": {
    features: ["TPM and ranked spoofer included", "Aimbot and recoil helper", "Player ESP, radar and web radar", "Profile and menu controls", "Cheater-detection notification"],
    featureGroups: [
      { title: "Aim", items: ["Basic and advanced aim controls, priority, 360 mode, recoil helper, bones, visible checks, auto-shoot and filters"] },
      { title: "Visuals", items: ["Boxes, health, names, kill/ping/distance tags, squad IDs, arrows, weapon icons, skeleton, snaplines and UAV display"] },
      { title: "Radar and settings", items: ["Radar distance/type, web sharing, profiles, menu color, unlock control and cheater notifications"] },
    ],
    requirements: ["Windows PC with BO7 installed", "TPM and ranked spoofer are listed as included", "Use the delivered Thunex download and its product guide"],
    media: ["https://i.ibb.co/3y8RF3SH/image.png"],
  },
  "cod-bo6-ghost": {
    features: ["100% external stream-safe overlay", "Aim assistance for zombie/co-op modes", "Entity ESP and mini radar", "Anti-recording, presets and color controls"],
    featureGroups: [
      { title: "Targeting", items: ["Zombie focus, lock-on, movement prediction, team filters, FOV, deadzone, aim bone and custom keys"] },
      { title: "Visuals", items: ["Zombie/player/bot boxes, skeletons, snaplines, health, names, distance and team display", "Mini radar with bot visibility, team and distance options"] },
      { title: "Privacy and profiles", items: ["Anti-recording mode, save/load presets and visible/invisible color customization"] },
    ],
    requirements: ["Windows PC with the supported Call of Duty title installed", "Use the delivered Ghost download for this listing", "Review the product guide before launch"],
  },
  "cod-bo6-unlock-all": {
    features: ["Soft unlock-all tool", "TPM and HWID spoofer included", "Camo, operator, calling-card and prestige unlocks"],
    featureGroups: [{ title: "Included", items: ["All Windows versions listed", "Unlocks every item through the tool", "Camos and operators may not persist, according to the source listing"] }],
    requirements: ["Windows PC with the supported Call of Duty title installed", "TPM/HWID spoofer is listed as included", "Use the delivered Ghost download for this listing"],
  },
  "cod-mw2-zerox": {
    features: ["Internal aimbot and targeting filters", "Player/AI/teammate ESP", "Color-customizable overlays", "Spinbot, jitter and third-person extras", "Developer and multi-slot config controls"],
    featureGroups: [
      { title: "Aim and target selection", items: ["Aimbot, silent aim, auto-shoot, rapid fire, auto-wall, FOV, smoothing, prediction and humanization", "Sway/recoil controls, visibility, knocked/friendly/AI/drone filters, threat priority, bones and distance"] },
      { title: "ESP", items: ["Boxes, health, skeletons, names, distance, weapon/platform, snaplines, compass, warnings and AI/team/target filters"] },
      { title: "Extras", items: ["Anti-flash/stun, no gun motion, bullet tracers, spinbot/jitter, FOV override, third person and save slots"] },
    ],
    requirements: ["Windows PC with MW2/DMZ installed", "Use the delivered Zerox download for this listing", "Review the product guide before launch"],
    media: ["https://i.ibb.co/M5Z703pJ/image.png"],
  },
  "cod-mw2-grey": {
    features: ["Customizable aimbot and targeting", "Enemy, team, bot and world ESP", "Radar, OOF arrows and tracer system", "Weapon, camera and utility controls", "Controller/spoofer and config support"],
    featureGroups: [
      { title: "Aim and targeting", items: ["FOV, distance, activation key, silent aim, auto-fire, sway compensation, bone selection and smart filters"] },
      { title: "Visuals", items: ["Enemy/team/bot boxes, head, health, skeleton, names, distance, weapons, platforms, kills, team IDs, chams and bomb-drone tracking"] },
      { title: "Utilities", items: ["Radar, OOF arrows, bullet tracers, no recoil/stun/flash, custom FOV, spinbot and third-person mode", "Controller support, spoofer support and save/load configurations"] },
    ],
    requirements: ["Windows 10/11 with MW2/DMZ installed", "Steam, Battle.net and Game Pass support are listed", "Use the delivered Grey download for this listing"],
    media: ["https://i.ibb.co/wFSgyGJ3/image.png"],
  },
  "cod-mw3-ghost": {
    features: ["Spoofer included", "Aimbot and player ESP", "Radar, compass and lobby warnings", "Rapid-fire and FOV utilities", "Config and color customization"],
    featureGroups: [
      { title: "Compatibility", items: ["All Windows versions listed", "Multiplayer and Zombies with Battle.net, Steam and Game Pass"] },
      { title: "Aim and visuals", items: ["Silent aim, keybinds, bones, prediction, speed, FOV, humanization and rapid fire", "Names, distance, bones, boxes, health, weapons, FOV and snapline visuals"] },
      { title: "Utilities", items: ["Radar/compass, lobby tools, enemy/nearby warnings, custom exploit input, third person and FPS counter", "Save/load/reset configurations and customize colors"] },
    ],
    requirements: ["Windows PC with MW3 installed", "Battle.net, Steam or Game Pass", "Spoofer is listed as included"],
    videos: ["https://streamable.com/e/fl0b5y"],
  },
  "cod-mw3-asura": {
    features: ["Native controller support and spoofer", "Aimbot, ESP and loot systems", "Radar, compass and warning overlays", "Weapon, movement and account utilities", "Profile import/export"],
    featureGroups: [
      { title: "Aim and ESP", items: ["Normal/silent aim, bones, prediction, smoothing, visibility, target selection and auto-shoot", "Boxes, skeletons, health, snaplines, distance, names, weapons, team IDs, radar and threat warnings"] },
      { title: "Loot and utilities", items: ["Ammo, weapons, money, armor and supply-box loot ESP with filters", "No recoil/spread, reload/swap, FOV, third person, bright/fullbright, unlocks and developer tools"] },
      { title: "Profiles", items: ["Multiple saved configurations, presets, export/import and account-level unlock/revert controls"] },
    ],
    requirements: ["All Windows versions listed", "Full native controller support", "Spoofer is listed as included"],
    videos: ["https://streamable.com/e/47akwd"],
  },
  "cod-mw3-unlock-all": {
    features: ["Spoofer included", "Unlock-all tool for in-game items", "No-server-check unlock flow listed"],
    featureGroups: [{ title: "Included", items: ["The source panel lists a spoofer and an unlock-everything tool"] }],
    requirements: ["Windows PC with MW3 installed", "Spoofer is listed as included", "Use the delivered Ghost download for this listing"],
  },
  "cod-mw19-ghost": {
    features: ["Spoofer and controller support", "Aimbot, anti-aim and targeting filters", "Player ESP and unlock tools", "Gameplay exploits and Battle.net-only Dvars", "Color and configuration controls"],
    featureGroups: [
      { title: "Compatibility", items: ["Windows 10/11, Battle.net, Game Pass and Steam", "Controller support and included spoofer are listed"] },
      { title: "Aim and visuals", items: ["Silent/180-degree aim, prediction, humanization, rapid fire, anti-aim, target filters, no recoil/spread and override bones", "FOV, snaplines, names, distance, bones, boxes, health, weapon and color controls"] },
      { title: "Extras", items: ["Unlocks, reverse camos, movement/server/chat tools, exploit options and Battle.net-only developer variables"] },
    ],
    requirements: ["Windows 10/11", "Battle.net, Game Pass or Steam", "Spoofer is listed as included"],
    media: ["https://i.ibb.co/7dtnYF6X/image.png"],
    videos: ["https://streamable.com/e/y5fx99"],
  },
  "cod-mw19-unlock-all": {
    features: ["Spoofer included", "Unlock-all tool", "Reverse camos included", "F6 activation listed"],
    featureGroups: [{ title: "Included", items: ["Unlock-everything flow with reverse-camo support", "The source panel lists F6 as the in-game activation key"] }],
    requirements: ["Windows PC with MW19 installed", "Spoofer is listed as included", "Use the delivered Ghost download for this listing"],
    media: ["https://i.ibb.co/WWkb1y2X/image.png"],
    videos: ["https://streamable.com/e/frxdch"],
  },
  "cod-ancient": {
    features: ["Controller-supported external cheat", "Spoofer included", "BO6/BO7/Warzone coverage", "Aimbot, player ESP and radar", "Items, arrows and battle-mode controls"],
    featureGroups: [
      { title: "Aim", items: ["FOV, smoothing, prediction, visible-only checks, humanization, bones, target delay and controller support"] },
      { title: "Visuals", items: ["Boxes, names, distance, health, kills/rank/team ID, skeleton, weapon, teammates/downed filters and radar"] },
      { title: "World and utility", items: ["Categorized item filters, distances, off-screen arrows, battle mode and per-state color controls"] },
    ],
    requirements: ["Windows PC with BO6, BO7 or Warzone installed", "Controller support is listed", "Spoofer is listed as included"],
    media: ["https://i.ibb.co/yBnL8hky/image-2025-08-03-21-05-34.png"],
  },
  "cod-fecurity": {
    features: ["Easy and graph-based Pro aimbot modes", "Player ESP, UAV radar and glow", "Loot categories and filters", "No-recoil and clantag utilities"],
    featureGroups: [
      { title: "Aimbot", items: ["Aim-at shoot/scope controls, visibility, target delay, prediction, FOV and gamepad support", "Easy mode sliders and graph-based Pro mode with dynamic FOV/speed"] },
      { title: "ESP", items: ["Boxes, OOF arrows, health, shield, skeleton, thickness, player information, glow and distance controls"] },
      { title: "Loot and misc", items: ["Loot categories, distance filters, names, icons, colors and keybinds", "Custom clantag, no recoil and feet/yards/meters distance units"] },
    ],
    requirements: ["All Windows versions listed", "Spoofer is not included", "Use the delivered Fecurity download for this listing"],
  },
  "cod-noah": {
    features: ["Internal aimbot", "Player, NPC and loot ESP", "Streaming protection and spectator tools", "Loadout/class editor", "Config profiles and global controls"],
    featureGroups: [
      { title: "Compatibility", items: ["MW2, MW3, BO6, BO7 and Warzone compatibility is listed", "Internal product; spoofer is not included"] },
      { title: "Aim and ESP", items: ["Bone, FOV, distance, smoothing, prediction, deadzone, keybind, targeting and downed-player controls", "Boxes, skeletons, health, names, lines, NPC/loot/cash/item, compass and custom color controls"] },
      { title: "Misc and profiles", items: ["Streaming protection, FPS, spectator warnings/count/name, tooltip and feature alerts", "Loadout/class editor, create/duplicate/reset/rename/remove profiles and global mouse/FOV controls"] },
    ],
    requirements: ["Windows PC with MW2, MW3, BO6, BO7 or Warzone installed", "Internal product; spoofer is not included", "Use the delivered Noah download for this listing"],
    media: ["https://cdn.discordapp.com/attachments/1387249841456808056/1443786832222617754/image.png"],
    videos: ["https://streamable.com/e/blcer8"],
  },
});
