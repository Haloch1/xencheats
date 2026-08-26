/*
 * Public, source-backed metadata for the dedicated setup pages.
 *
 * Keep this separate from products.js so the instructions page can render
 * product-specific entries without importing private supplier mappings.
 */
const dedicatedRftGuidesCatalog = [
  { slug: "apex-raiko", name: "Raiko: Apex Legends Internal Cheat", category: "Apex Legends", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://mega.nz/folder/fkZk2Yhb#34ZBBv2afccYgncfY0qpYw" },
  { slug: "apex-akuma", name: "Akuma: Apex Legends Internal Cheat", category: "Apex Legends", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://mega.nz/folder/ftADHAyb#yPaukCM0LP5zYL1wR46t4Q" },
  { slug: "rust-disconnect", name: "Disconnect - Rust", category: "Rust", status: "Testing", terms: ["1 Day", "3 Days", "1 Week", "1 Month", "Lifetime"], download: "https://lewislitt.life/Store/install.html", docs: "https://lewislitt.life/Store/Instructions.pdf" },
  { slug: "rust-ancient", name: "Ancient: Rust Cheat", category: "Rust", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://gofile.io/d/7t9T2w" },
  { slug: "rust-skyra", name: "Skyra: Rust Cheat", category: "Rust", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://flosense.xyz/", docs: "https://gofile.io/d/6jeeGa" },
  { slug: "rust-arcane", name: "Arcane: Rust Cheat", category: "Rust", status: "Undetected", terms: ["1 Day", "3 Days", "1 Week", "1 Month"], download: "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw", docs: "https://docs.google.com/document/d/1G0FXceLJ1RvIxUX8--tll-667gaILzkKG97ftfRtgtc/edit?tab=t.0#heading=h.7vk902ha5an" },
  { slug: "fortnite-disconnect", name: "Disconnect - Fortnite", category: "Fortnite", status: "Testing", terms: ["1 Day", "3 Days", "1 Week", "1 Month"], download: "https://cheezit.life/", docs: "https://lewislitt.life/Store/Instructions.pdf" },
  { slug: "fortnite-akuma", name: "Akuma: Fortnite Internal Cheat", category: "Fortnite", status: "Use at own risk", terms: ["1 Day", "1 Week", "1 Month"], download: "https://gofile.io/d/ALawtb", docs: "https://unnamed-tech.gitbook.io/unnamedtech/tutorial-error-fix/fortnite-internal" },
  { slug: "pubg-arcane-browser-radar", name: "Arcane: PUBG Browser Radar", category: "PUBG", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw", docs: "https://docs.google.com/document/d/1mdHKIddTJ1DcCcoxO4e1ai_J0bUho-Q0VFg9hQ09HAs/edit?tab=t.0#heading=h.7vk902ha5an" },
  { slug: "pubg-ancient", name: "Ancient: PUBG Cheat", category: "PUBG", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://mega.nz/folder/esIEhJgZ#vDIjzvsbDVzmtmRKdwaJ4g" },
  { slug: "pubg-arcane-esp-no-recoil", name: "Arcane: PUBG ESP + No Recoil Cheat", category: "PUBG", status: "Undetected", terms: ["3 Days", "15 Days", "1 Month"], download: "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw", docs: "https://docs.google.com/document/d/1kkKRjp9WLb52-RVty3PVmXOmmV87uJu_nYbbCkqtXfY/edit?tab=t.0#heading=h.7vk902ha5an" },
  { slug: "pubg-arcane-blindspot", name: "Arcane: PUBG Blindspot Cheat", category: "PUBG", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw", docs: "https://docs.google.com/document/d/1mdHKIddTJ1DcCcoxO4e1ai_J0bUho-Q0VFg9hQ09HAs/edit?tab=t.0#heading=h.7vk902ha5an" },
  { slug: "delta-force-toshi", name: "Toshi: Delta Force Internal Cheat", category: "Delta Force", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://mega.nz/folder/fkZk2Yhb#34ZBBv2afccYgncfY0qpYw" },
  { slug: "delta-force-akuma", name: "Akuma: Delta Force Internal Cheat", category: "Delta Force", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://mega.nz/folder/ftADHAyb#yPaukCM0LP5zYL1wR46t4Q" },
  { slug: "marvel-rivals-arcane", name: "Arcane: Marvel Rivals Cheat", category: "Marvel Rivals", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw", docs: "https://docs.google.com/document/d/1mdHKIddTJ1DcCcoxO4e1ai_J0bUho-Q0VFg9hQ09HAs/edit?tab=t.0#heading=h.7vk902ha5an" },
  { slug: "battlefield6-arcane", name: "Arcane: Battlefield 6 Cheat", category: "Battlefield", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw", docs: "https://docs.google.com/document/d/1mdHKIddTJ1DcCcoxO4e1ai_J0bUho-Q0VFg9hQ09HAs/edit?tab=t.0#heading=h.7vk902ha5an" },
  { slug: "eft-ancient-chams", name: "Ancient: EFT Chams", category: "Escape from Tarkov", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://gofile.io/d/7t9T2w", docs: "https://gofile.io/d/7t9T2w" },
  { slug: "eft-ancient-full", name: "Ancient: EFT Full External", category: "Escape from Tarkov", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://gofile.io/d/7t9T2w", docs: "https://gofile.io/d/7t9T2w" },
  {
    slug: "cod-bo7-zeroaim",
    name: "BO7/WZ - ZeroAim External",
    category: "Call of Duty",
    status: "Undetected",
    terms: ["1 Day", "1 Week", "1 Month"],
    download: "https://gofile.io/d/Wz94CQ",
    setup: {
      title: "ZeroAim delivery and setup",
      intro: "The current supplier delivery for this listing is a single executable named zeroaim.exe. The supplier listing does not publish a separate instruction document for ZeroAim.",
      steps: [
        "Open the delivery link below after your purchase and download the ZeroAim file.",
        "Use the delivered zeroaim.exe file only with your BO7/WZ - ZeroAim External order.",
        "The supplier listing does not specify a password, license-key field, launch order, or menu hotkey for this product. Do not guess or use those details from another listing.",
        "If zeroaim.exe does not provide its own activation and launch prompts, stop and contact support before launching it.",
      ],
      note: "Verified supplier data: the RFT listing currently shows “No instructions available” for ZeroAim. The delivery link below is the only source-backed file link for this listing.",
    },
  },
  { slug: "cod-bo7-ghost-external", name: "BO7 - Ghost External + Spoofer", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month", "Lifetime"], download: "https://gofile.io/d/eyuWQh" },
  { slug: "cod-bo7-ghost-internal", name: "BO7 - Ghost Internal + Spoofer", category: "Call of Duty", status: "Testing", terms: ["1 Day", "1 Week", "1 Month", "Lifetime"], download: "https://gofile.io/d/eyuWQh" },
  { slug: "cod-bo7-shield", name: "Shield: BO7 External Cheat", category: "Call of Duty", status: "Undetected", terms: ["3 Days", "1 Week", "1 Month"], download: "https://panelloader.com/Shield/" },
  { slug: "cod-bo7-mist", name: "Mist: BO7 External Cheat + Spoofer", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month", "Lifetime"], download: "https://gofile.io/d/DswZJa" },
  { slug: "cod-bo7-zerox", name: "BO7: Zerox Internal Cheat (RAGE)", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://gofile.io/d/PWxsxX" },
  { slug: "cod-bo7-dma-mist", name: "Mist: BO7/WZ DMA Cheat", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month", "3 Months", "Lifetime"], download: "https://gofile.io/d/DswZJa" },
  { slug: "cod-bo7-royal", name: "BO7: Royal External Cheat", category: "Call of Duty", status: "Updating", terms: ["1 Day", "1 Week", "1 Month"], download: "https://gofile.io/d/qHBeJU" },
  { slug: "cod-bo7-unlock-all", name: "BO7/WZ - Unlock All + Spoofer", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month", "Lifetime"], download: "https://gofile.io/d/eyuWQh" },
  { slug: "cod-ldv4", name: "COD: LDV4 External (MW3-BO7)", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://mega.nz/file/j1hkmbZI#KV5lGwHv0wYwyID_2P2f6p3yIHnZPyRij4pw70d9rm8" },
  { slug: "cod-progress", name: "COD: Progress External (MW2-BO7)", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://gofile.io/d/14XWib" },
  { slug: "cod-bo7-thunex", name: "Thunex: BO7 External Cheat", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://mega.nz/folder/r89TgQLb#lwDeuDq6RSJPBm5RPMXq3g", docs: "https://docs.signcod.com/call-of-duty-section/thunex-section/thunex-external/how-to-install-thunex#step-2-enter-license-key" },
  { slug: "cod-bo6-ghost", name: "BO6 - Ghost External + Spoofer", category: "Call of Duty", status: "Online", terms: ["1 Day", "1 Week", "1 Month", "Lifetime"], download: "https://gofile.io/d/eyuWQh" },
  { slug: "cod-bo6-unlock-all", name: "BO6 - Unlock All + Spoofer", category: "Call of Duty", status: "Online", terms: ["1 Day", "1 Week", "1 Month", "Lifetime"], download: "https://gofile.io/d/eyuWQh" },
  { slug: "cod-mw2-zerox", name: "MW2/DMZ: Zerox Internal (RAGE)", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://gofile.io/d/PWxsxX" },
  { slug: "cod-mw2-grey", name: "MW2/DMZ: Grey Internal", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://gofile.io/d/IeY7OO" },
  { slug: "cod-mw3-ghost", name: "MW3 - Ghost Internal + Spoofer", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month", "Lifetime"], download: "https://gofile.io/d/eyuWQh" },
  { slug: "cod-mw3-asura", name: "MW3 Asura Internal", category: "Call of Duty", status: "Offline", terms: ["1 Day", "1 Week", "1 Month"], download: "https://gitbm3guglhontpdg0vt.com/" },
  { slug: "cod-mw3-unlock-all", name: "MW3 - Unlock All + Spoofer", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month", "Lifetime"], download: "https://gofile.io/d/eyuWQh" },
  { slug: "cod-mw19-ghost", name: "MW19 - Ghost Internal + Spoofer", category: "Call of Duty", status: "Buggy", terms: ["1 Day", "1 Week", "1 Month", "Lifetime"], download: "https://gofile.io/d/eyuWQh" },
  { slug: "cod-mw19-unlock-all", name: "MW19 - Unlock All + Spoofer", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month", "Lifetime"], download: "https://gofile.io/d/eyuWQh" },
  { slug: "cod-ancient", name: "Ancient: COD External Cheat", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "3 Days", "1 Week", "1 Month", "3 Months"], download: "https://gofile.io/d/7t9T2w", docs: "https://gofile.io/d/7t9T2w" },
  { slug: "cod-fecurity", name: "Fecurity - COD", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://mega.nz/folder/ORsFGQDT#nOKWTNSs97e42MbQhuIoSg" },
  { slug: "cod-noah", name: "COD: Noah Internal Cheat", category: "Call of Duty", status: "Undetected", terms: ["1 Day", "1 Week", "1 Month"], download: "https://evolve.sx/" },
];

/* Keep the instruction sidebar aligned with the public storefront scope. */
export const dedicatedRftGuides = Object.freeze(dedicatedRftGuidesCatalog.filter((guide) => {
  if (/fragpunk|overwatch/i.test(`${guide.category} ${guide.name} ${guide.slug}`)) return false;
  return guide.category !== "Call of Duty" || /^cod-bo7-/i.test(guide.slug);
}));

export const dedicatedRftGuideSlugs = new Set(dedicatedRftGuides.map((guide) => guide.slug));
