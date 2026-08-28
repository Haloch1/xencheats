/*
 * Public supplier product identifiers and reseller prices captured from the official
 * authenticated product catalog. Runtime stock is never taken from this file;
 * server.js verifies product presence and each variant quantity through the supplier API
 * piggyback/setup and piggyback/stock before exposing availability.
 */
export const rftApiCatalog = Object.freeze({
  "Ghost: Perm Spoofer": {
    "productId": "2",
    "variants": [
      {
        "id": "1D",
        "name": "One-Time Use",
        "price": 16
      },
      {
        "id": "100D",
        "name": "Lifetime",
        "price": 40
      }
    ]
  },
  "BO6 - Ghost External + Spoofer": {
    "productId": "3",
    "variants": [
      {
        "id": "1D",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "1W",
        "name": "1 Week",
        "price": 12
      },
      {
        "id": "1M",
        "name": "1 Month",
        "price": 24
      },
      {
        "id": "variant_3",
        "name": "Lifetime",
        "price": 120
      }
    ]
  },
  "Disconnect - Fortnite": {
    "productId": "disconnectfortnite",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 10
      },
      {
        "id": "3day",
        "name": "3 Days",
        "price": 16
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 32
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 54
      }
    ]
  },
  "Disconnect - Rust": {
    "productId": "disconnectrust",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 8
      },
      {
        "id": "3days",
        "name": "3 Days",
        "price": 16
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 28
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 50
      },
      {
        "id": "lifetime",
        "name": "LIFETIME",
        "price": 300
      }
    ]
  },
  "Crusader - R6 External Cheat": {
    "productId": "crusaderr6",
    "variants": [
      {
        "id": "1",
        "name": "1 Day",
        "price": 7
      },
      {
        "id": "7",
        "name": "7 Day",
        "price": 32
      },
      {
        "id": "30",
        "name": "30 Day",
        "price": 64
      }
    ]
  },
  "Valorant Trigger Bot": {
    "productId": "valoranttriggerbot",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 5
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 12
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 24
      }
    ]
  },
  "Valorant ESP": {
    "productId": "valorantesp",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 9
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 28
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 60
      }
    ]
  },
  "Fecurity - COD": {
    "productId": "fecuritycod",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 7
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 18
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "Fresh Steams": {
    "productId": "freshsteams",
    "variants": [
      {
        "id": "steam",
        "name": "Steam",
        "price": 1
      }
    ]
  },
  "Roblox - DX9WARE": {
    "productId": "robloxdx9ware",
    "variants": [
      {
        "id": "1week",
        "name": "Lifetime",
        "price": 20
      }
    ]
  },
  "MW19 - Ghost Internal + Spoofer": {
    "productId": "mw19ghostinternal",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 1.5
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 4
      },
      {
        "id": "1-",
        "name": "1 Month",
        "price": 12
      },
      {
        "id": "lifetime",
        "name": "Lifetime",
        "price": 30
      }
    ]
  },
  "MW3 - Ghost Internal + Spoofer": {
    "productId": "mw3ghostinternal",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 1.2
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 3.5
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 10
      },
      {
        "id": "lifetime",
        "name": "Lifetime",
        "price": 24
      }
    ]
  },
  "Ancient: Fortnite Cheat": {
    "productId": "ancientfortnitecheat",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 22
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "GTA V - Lexis Mod Menu": {
    "productId": "gtavlexismodmenu",
    "variants": [
      {
        "id": "lifetime",
        "name": "1 Month",
        "price": 54
      }
    ]
  },
  "Predator: Marvel Rivals": {
    "productId": "predatormarvelrivals",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 12
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 26
      }
    ]
  },
  "Predator: CS2": {
    "productId": "predatorcs2",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 2
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 5
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 8
      }
    ]
  },
  "Phantom: Palworld Internal Cheat": {
    "productId": "palworldcheat",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 2
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 6
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 12
      },
      {
        "id": "variant_3",
        "name": "Lifetime",
        "price": 40
      }
    ]
  },
  "BO7/WZ - ZeroAim External": {
    "productId": "bo7zeroaim",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 12
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 24
      }
    ]
  },
  "Diddy Temp Spoofer": {
    "productId": "temphwidtpmspoofer",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 3
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 12
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 25
      },
      {
        "id": "lifetime",
        "name": "Lifetime",
        "price": 90
      }
    ]
  },
  "Ancient: Battlefield 6": {
    "productId": "ancientbattlefield6",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 4.39
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 22
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "Ancient: Delta Force Cheat": {
    "productId": "deltaforceancient",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 22
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "Ancient: Apex Legends Cheat": {
    "productId": "apexlegendsancient",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 3.3
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 16.5
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 33
      }
    ]
  },
  "MW3 Asura Internal": {
    "productId": "asura",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 14
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 28
      }
    ]
  },
  "Ancient: PUBG Cheat": {
    "productId": "ancientpubg",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 22
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "Ancient: Rust Cheat": {
    "productId": "ancientrust",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 5.5
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 27.5
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 55
      }
    ]
  },
  "Arcane: Sea Of Thieves Cheat": {
    "productId": "seaofthieves",
    "variants": [
      {
        "id": "1d",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 13.2
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 24.2
      }
    ]
  },
  "Arcane: Active Matter Cheat": {
    "productId": "arcaneactivemattercheat",
    "variants": [
      {
        "id": "1-",
        "name": "1 Day",
        "price": 5.5
      },
      {
        "id": "1-1-",
        "name": "1 Week",
        "price": 24.2
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "Arcane: ARK Ascended Cheat": {
    "productId": "arcane-ark",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 6.6
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 24.2
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 52.8
      }
    ]
  },
  "Arcane: Battlefield 6 Cheat": {
    "productId": "arcanebattlefield6external",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 5.5
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 24.2
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "Arcane: CS2 Cheat": {
    "productId": "arcanecs2cheat",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 1.66
      },
      {
        "id": "1week",
        "name": "1 Month",
        "price": 4.96
      },
      {
        "id": "6months",
        "name": "3 Months",
        "price": 13.2
      }
    ]
  },
  "Arcane: Dark & Darker Cheat": {
    "productId": "arcanedarkdarker",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 3.3
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 6.6
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 13.2
      }
    ]
  },
  "Arcane: DayZ Cheat": {
    "productId": "arcane-dayz",
    "variants": [
      {
        "id": "1-",
        "name": "1 Day",
        "price": 3.3
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 14.3
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 28.6
      }
    ]
  },
  "Arcane: Dead By Daylight Cheat": {
    "productId": "arcanedeadbydaylightcheat",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 16.5
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 33
      }
    ]
  },
  "Arcane: Deadside Cheat": {
    "productId": "arcanedeadside",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 13.2
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 24.2
      }
    ]
  },
  "Arcane: Dune Awakening Cheat": {
    "productId": "arcaneduneawakeningcheat",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 5.5
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 16.5
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 33
      }
    ]
  },
  "Arcane: Farlight 84 Cheat": {
    "productId": "arcanefarlight84",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 3.3
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 6.6
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 13.2
      }
    ]
  },
  "Arcane: Fortnite Cheat": {
    "productId": "arcanefortnitecheat",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 7.7
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 38.5
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 66
      }
    ]
  },
  "Arcane: Hell Let Loose Cheat": {
    "productId": "arcanehellletloose",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 16.5
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 33
      }
    ]
  },
  "Arcane: Hunt Showdown Cheat": {
    "productId": "arcanehuntshowdowncheat",
    "variants": [
      {
        "id": "1",
        "name": "1 Day",
        "price": 3.3
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 11
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 22
      }
    ]
  },
  "Arcane: Marvel Rivals Cheat": {
    "productId": "arcanemarvelrivalscheat",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 16.5
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 33
      }
    ]
  },
  "Arcane: Off The Grid Cheat": {
    "productId": "arcaneoffthegridcheat",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 3.3
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 11
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 22
      }
    ]
  },
  "Arcane: PUBG ESP + No Recoil Cheat": {
    "productId": "arcanepubgespnorecoilcheat",
    "variants": [
      {
        "id": "1-",
        "name": "3 Days",
        "price": 5.5
      },
      {
        "id": "1-1-",
        "name": "15 Days",
        "price": 19.8
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 38.5
      }
    ]
  },
  "Arcane: PUBG Full Cheat": {
    "productId": "arcanepubg",
    "variants": [
      {
        "id": "1",
        "name": "1 Day",
        "price": 5.5
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 24.2
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "Arcane: SCUM Cheat": {
    "productId": "arcanescumcheat",
    "variants": [
      {
        "id": "1-",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 16.5
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 33
      }
    ]
  },
  "Arcane: Squad Cheat": {
    "productId": "arcanesquadcheat",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 3.3
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 13.2
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 24.2
      },
      {
        "id": "variant_3",
        "name": "3 Months",
        "price": 66
      }
    ]
  },
  "Arcane: War Thunder Cheat": {
    "productId": "arcanewarthunder",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 5.5
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 19.8
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 38.5
      }
    ]
  },
  "Ghost: Temp Spoofer (COD Ready)": {
    "productId": "temphwidtpmspoofer2",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 3
      },
      {
        "id": "1-",
        "name": "1 Week",
        "price": 10
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 20
      },
      {
        "id": "lifetime",
        "name": "Lifetime",
        "price": 50
      }
    ]
  },
  "BO7/WZ - Unlock All + Spoofer": {
    "productId": "bo7unlockall",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 1
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 5
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 10
      },
      {
        "id": "lifetime",
        "name": "Lifetime",
        "price": 20
      }
    ]
  },
  "BO7 - Ghost External + Spoofer": {
    "productId": "bo7ghostexternal",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 3
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 10
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 20
      },
      {
        "id": "lifetime",
        "name": "Lifetime",
        "price": 80
      }
    ]
  },
  "Arcane: The Finals Cheat": {
    "productId": "arcaneFinals",
    "variants": [
      {
        "id": "day",
        "name": "1 Day",
        "price": 5.5
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 24.2
      },
      {
        "id": "1month",
        "name": "1 Month ",
        "price": 44
      }
    ]
  },
  "Arcane: ARC Raiders Cheat": {
    "productId": "arcaneark",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 5.5
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 24.2
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "BO6 - Unlock All + Spoofer": {
    "productId": "bo6wzunlockalltool",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 1
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 5
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 10
      },
      {
        "id": "lifetime",
        "name": "Lifetime",
        "price": 20
      }
    ]
  },
  "Arena Breakout Infinite: Dullwave External": {
    "productId": "abidullwave",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 11.2
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 32
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 58
      }
    ]
  },
  "BO7 - Ghost Internal + Spoofer": {
    "productId": "bo7ghostinternal",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 3
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 10
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 20
      },
      {
        "id": "lifetime",
        "name": "Lifetime",
        "price": 80
      }
    ]
  },
  "Akuma - Arena Breakout Cheat (Full)": {
    "productId": "akumaarenabreakoutcheatfull",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 10
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 30
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 60
      }
    ]
  },
  "Akuma - Valorant Cheat (Full)": {
    "productId": "akumavalorantcheatfull",
    "variants": [
      {
        "id": "1day",
        "name": "1 Day",
        "price": 8
      },
      {
        "id": "1week",
        "name": "1 Week",
        "price": 30
      },
      {
        "id": "1month",
        "name": "1 Month",
        "price": 60
      }
    ]
  },
  "COD: Noah Internal Cheat": {
    "productId": "0b59e0c2-d036-4166-a1cd-c5c59a30838a",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 5
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 17
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 40
      }
    ]
  },
  "Ancient: ARC Raiders Cheat": {
    "productId": "7f397a3d-92eb-442b-9d33-86bf918be3e0",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 5
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 20
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 40
      }
    ]
  },
  "Minecraft: Melonity Cheat": {
    "productId": "2d7c06b7-dc7b-4c27-b63c-722cda2a1d35",
    "variants": [
      {
        "id": "example",
        "name": "1 Month",
        "price": 10
      }
    ]
  },
  "Minecraft - Drip Web Client": {
    "productId": "ed19cfb8-8dc9-404d-aa5f-821a899c2ad1",
    "variants": [
      {
        "id": "example",
        "name": "1 Week",
        "price": 17
      },
      {
        "id": "variant_1",
        "name": "1 Month",
        "price": 35
      }
    ]
  },
  "Ancient: EFT Chams ": {
    "productId": "c3eb337b-f600-4e3e-a8cd-60a5e87b11e2",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 3.3
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 7.7
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 16.5
      }
    ]
  },
  "Spectre: ARC Raiders Internal Cheat": {
    "productId": "32844f13-c424-43e5-ad2d-27e747222c54",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 6
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 24
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 50
      }
    ]
  },
  "The Division 2 - Lexis Internal Cheat": {
    "productId": "f00099b0-a9b2-4d36-bb2c-5ac390972bfc",
    "variants": [
      {
        "id": "example",
        "name": "1 Week",
        "price": 48
      },
      {
        "id": "variant_1",
        "name": "1 Month",
        "price": 84
      },
      {
        "id": "variant_2",
        "name": "3 Months",
        "price": 180
      }
    ]
  },
  "Arcane: Apex Legends Cheat": {
    "productId": "8113d604-672e-4452-b9e4-4cae477d388f",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 5.5
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 22
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "Arcane: PIONER Cheat": {
    "productId": "7901e84d-a4a1-4d8a-b18c-6620ef18acc6",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 3.3
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 13.2
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 24.2
      },
      {
        "id": "variant_3",
        "name": "3 Months",
        "price": 66
      }
    ]
  },
  "Arcane: The Midnight Walkers Cheat": {
    "productId": "ad91d1b3-939f-41f6-8345-154ff9c48122",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 13.2
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 24.2
      }
    ]
  },
  "Ancient: R6S Cheat": {
    "productId": "977b4cd3-07dc-4df3-8477-ce54fbb236a5",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 15
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 30
      }
    ]
  },
  "Arcane: ARMA Reforger Cheat": {
    "productId": "a6a4c6bb-139e-437d-a74e-b3bd53a68154",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 5.5
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 24.2
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "Arcane: PUBG Blindspot Cheat": {
    "productId": "968b811d-f15c-4622-97fa-d815f55ff945",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 16.5
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 33
      }
    ]
  },
  " Arcane: HumanitZ Cheat": {
    "productId": "8b827f59-b938-497e-b780-dfb82104d67b",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 13.2
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 24.2
      }
    ]
  },
  "Arcane: The First Descendant Cheat": {
    "productId": "beb0f3cf-362c-43cf-a207-491eefe01a9f",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 13.2
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 24.2
      }
    ]
  },
  "Yami: ARC Raiders External + Spoofer": {
    "productId": "ab866ec4-382a-4472-b1c5-90b0f3b59bde",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 3
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 14
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 28
      },
      {
        "id": "variant_3",
        "name": "Lifetime",
        "price": 100
      }
    ]
  },
  "Discord: Status Rotator App": {
    "productId": "7c76842a-8162-4fd4-b486-747d4c3e306c",
    "variants": [
      {
        "id": "example",
        "name": "Lifetime",
        "price": 14
      }
    ]
  },
  "Discord: Status Rotator Bot": {
    "productId": "6fa14925-a61a-4274-a888-1a7aff486ac1",
    "variants": [
      {
        "id": "example",
        "name": "1 Month",
        "price": 4.6
      },
      {
        "id": "variant_1",
        "name": "1 Year",
        "price": 28
      }
    ]
  },
  "COD: LDV4 External (MW3-BO7)": {
    "productId": "22329749-2fb0-4ba7-b3d1-3566ec2dc6c4",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 7
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 24
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "COD: Progress External (MW2-BO7)": {
    "productId": "4f343c1a-24ba-4a61-a211-99c5c5ffde55",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 7
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 24
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "Ancient: EFT Full External": {
    "productId": "230894af-5e7f-4001-b8f1-4fef1fa0fd4b",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 5.5
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 27.5
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 55
      }
    ]
  },
  "Torix: Temp Spoofer": {
    "productId": "cc42d7fb-4f0f-45fe-81f2-e4e96e3e7470",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 3
      },
      {
        "id": "variant_1",
        "name": "3 Days",
        "price": 6
      },
      {
        "id": "variant_2",
        "name": "1 Week",
        "price": 14
      },
      {
        "id": "variant_3",
        "name": "1 Month",
        "price": 30
      },
      {
        "id": "variant_4",
        "name": "Lifetime",
        "price": 100
      }
    ]
  },
  "MW19 - Unlock All + Spoofer": {
    "productId": "71e2deb4-b11f-4fb9-b466-aa82fbb98c8a",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 0.5
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 2
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 4
      },
      {
        "id": "variant_3",
        "name": "Lifetime",
        "price": 8
      }
    ]
  },
  "MW3 - Unlock All + Spoofer": {
    "productId": "231f5381-45a1-4162-b7d1-6298a79b1cd0",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 0.5
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 2
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 4
      },
      {
        "id": "variant_3",
        "name": "Lifetime",
        "price": 8
      }
    ]
  },
  "Ambani: FiveM Cheat": {
    "productId": "109781fe-7617-45f7-9185-a5a6ff39a69e",
    "variants": [
      {
        "id": "example",
        "name": "1 Week",
        "price": 15
      },
      {
        "id": "variant_1",
        "name": "1 Month",
        "price": 22.5
      },
      {
        "id": "variant_2",
        "name": "Lifetime",
        "price": 55
      }
    ]
  },
  "MW2/DMZ: Grey Internal": {
    "productId": "fa805aeb-0b2e-4371-a912-5571066c9aed",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 15
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 25
      }
    ]
  },
  "Skyra: ARC Raiders Cheat": {
    "productId": "ad32ff91-220f-48fb-be7b-3ab450fdeeb8",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 20
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 40
      }
    ]
  },
  "SMS Linked Acti Steam Accounts": {
    "productId": "75f17ffa-24c8-45bc-ba83-fb137ddc3d7a",
    "variants": [
      {
        "id": "example",
        "name": "x1 Account",
        "price": 0.8
      }
    ]
  },
  "Skyra: Rust Cheat": {
    "productId": "f0f2f968-dc49-4483-8c43-f86a446d29de",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 20
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 40
      }
    ]
  },
  "Arcane: Rust Cheat": {
    "productId": "b9251edd-009f-4edd-b595-e7883e2b508a",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 6.6
      },
      {
        "id": "variant_1",
        "name": "3 Days",
        "price": 16.5
      },
      {
        "id": "variant_2",
        "name": "1 Week",
        "price": 33
      },
      {
        "id": "variant_3",
        "name": "1 Month",
        "price": 66
      }
    ]
  },
  "AimKing: 8 Ball Pool Cheat (Android)": {
    "productId": "bf1aafd0-bbd9-4ee7-9ade-429b29d076a5",
    "variants": [
      {
        "id": "example",
        "name": "3 Days",
        "price": 12
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 24
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 48
      }
    ]
  },
  "Fluorite: Free Fire Mobile Cheat (iOS)": {
    "productId": "703fb66c-02ed-461b-8a8f-0d8829328303",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 7
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 28
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 48
      }
    ]
  },
  "Fluorite: 8 Ball Pool Cheat (iOS)": {
    "productId": "69cdc5c0-c551-456b-9a7e-604425753d37",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 9
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 26
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 46
      }
    ]
  },
  "Pulse: Osu! External Cheat": {
    "productId": "c2b53f85-8102-4653-bf12-34954603e8ee",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 2
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 6
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 20
      }
    ]
  },
  "Polar: The Division 2 Internal": {
    "productId": "625d712d-14b1-4703-bd67-5511db465bf4",
    "variants": [
      {
        "id": "example",
        "name": "1 Week",
        "price": 32
      },
      {
        "id": "variant_1",
        "name": "1 Month",
        "price": 70
      }
    ]
  },
  "Polar: The Division 1 Internal": {
    "productId": "3d322b0a-e17f-42ff-807b-24fd2e4fa708",
    "variants": [
      {
        "id": "example",
        "name": "1 Week",
        "price": 32
      },
      {
        "id": "variant_1",
        "name": "1 Month",
        "price": 70
      }
    ]
  },
  "Thunex: BO7 External Cheat": {
    "productId": "b472801b-d823-4a0d-9916-b0b68ef1c0b7",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 7
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 24
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "Ancient: ABI Radar Cheat": {
    "productId": "a4d65b9e-87da-40ee-ac50-e3cc3bb1f4bf",
    "variants": [
      {
        "id": "example",
        "name": "1 Day ",
        "price": 4.4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 22
      },
      {
        "id": "variant_2",
        "name": "1 Month ",
        "price": 44
      }
    ]
  },
  "Shield: BO7 External Cheat": {
    "productId": "d35cb0e4-af39-40c7-8391-dfda5820ea5b",
    "variants": [
      {
        "id": "example",
        "name": "3 Days",
        "price": 6
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 12
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 24
      }
    ]
  },
  "Shield: Valorant External Cheat": {
    "productId": "c1c744ee-dbe3-4c9f-8ffd-6d3c35c4e8e4",
    "variants": [
      {
        "id": "example",
        "name": "3 Days",
        "price": 9.6
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 16
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 30.4
      }
    ]
  },
  "Mist: BO7 External Cheat + Spoofer": {
    "productId": "a5cacf08-54d0-451f-9fea-33bfdc3ab25f",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 12
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 24
      },
      {
        "id": "variant_3",
        "name": "Lifetime",
        "price": 100
      }
    ]
  },
  "Toshi: Delta Force Internal Cheat": {
    "productId": "6daa2215-5df5-4d3b-9cd4-7048d762525a",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 20
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 40
      }
    ]
  },
  "Raiko - Dead by Daylight Internal Cheat": {
    "productId": "3ef7e819-4b12-4412-8361-d48841ff1ed9",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 3.6
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 14
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 24
      }
    ]
  },
  "Arcane: ARC Raiders Browser Radar": {
    "productId": "efc2f2fb-8780-4be5-a953-fbad442bb88d",
    "variants": [
      {
        "id": "example",
        "name": "3 Days",
        "price": 5
      },
      {
        "id": "variant_1",
        "name": "15 Days",
        "price": 20
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 40
      }
    ]
  },
  "Arcane: PUBG Browser Radar": {
    "productId": "2ffa0bee-e670-402d-bcf8-49d31254c4f4",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 3.3
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 17
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 34
      }
    ]
  },
  "BO7: Zerox Internal Cheat (RAGE)": {
    "productId": "8eb78a8f-42fe-4107-a201-c1f34e53f489",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 5
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 12
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 24
      }
    ]
  },
  "Predator: Deadlock Cheat": {
    "productId": "724b88b4-1a64-4dee-bc9c-179925d26a67",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 12
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 26
      }
    ]
  },
  "Predator: Left 4 Dead 2 Cheat": {
    "productId": "c8c331fa-25aa-4121-8294-9bc73ff04cf8",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 2
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 5
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 8
      }
    ]
  },
  "Arcane: Conan Exiles Cheat": {
    "productId": "5b83ea34-2ad2-4149-a83d-e7a718fcc493",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 16.5
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 33
      }
    ]
  },
  "Mist: BO7/WZ DMA Cheat": {
    "productId": "dfdb9a9b-41c4-47be-82b1-3aa1c72e083c",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 3
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 9
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 18
      },
      {
        "id": "variant_3",
        "name": "3 Months",
        "price": 40
      },
      {
        "id": "variant_4",
        "name": "Lifetime",
        "price": 80
      }
    ]
  },
  "Ancient: COD External Cheat": {
    "productId": "0eb4f441-2706-4a9d-9de9-7c28c74562f5",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "variant_1",
        "name": "3 Days",
        "price": 8.8
      },
      {
        "id": "variant_2",
        "name": "1 Week",
        "price": 14.3
      },
      {
        "id": "variant_3",
        "name": "1 Month",
        "price": 34
      },
      {
        "id": "variant_4",
        "name": "3 Months",
        "price": 68
      }
    ]
  },
  "Akuma: Fortnite Internal Cheat": {
    "productId": "e5860eed-31b6-47ab-aa35-68cc71bb73ff",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 8
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 20
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 50
      }
    ]
  },
  "MW2/DMZ: Zerox Internal (RAGE)": {
    "productId": "ba994f9f-8cbe-43f5-99d1-20d0526d4baf",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 3
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 8
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 15
      }
    ]
  },
  "Forza Horizon 6: Engine Cheat": {
    "productId": "9eaa8cee-9e6b-4f6a-9ba9-36d5e170b419",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 1
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 3
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 10
      },
      {
        "id": "variant_3",
        "name": "Lifetime",
        "price": 20
      }
    ]
  },
  "Akuma: Apex Legends Internal Cheat": {
    "productId": "54e10be7-efb2-4f4d-9dab-7ba1f5eb0fbe",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 6
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 15
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 45
      }
    ]
  },
  "Arcane: GTA V Cheat": {
    "productId": "511aad80-012f-497e-a182-ebb9982bfc3c",
    "variants": [
      {
        "id": "example",
        "name": "7 Days",
        "price": 5.5
      },
      {
        "id": "variant_1",
        "name": "30 Days",
        "price": 16.5
      },
      {
        "id": "variant_2",
        "name": "90 Days",
        "price": 33
      }
    ]
  },
  "Akuma: Delta Force Internal Cheat": {
    "productId": "6a00fdc4-38a8-49b6-99ac-cea081cca085",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 7
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 20
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 50
      }
    ]
  },
  "Mimicry: Meccha Chameleon Internal Cheat": {
    "productId": "4fcf1406-19a5-4019-bb1e-7f6abf4e76b9",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 2
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 4
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 7
      },
      {
        "id": "variant_3",
        "name": "Lifetime",
        "price": 10
      }
    ]
  },
  "Eclipse: Among Us Internal Cheat": {
    "productId": "a3c90838-4641-4589-b032-0ce1671e2f89",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 2
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 4
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 7
      },
      {
        "id": "variant_3",
        "name": "Lifetime",
        "price": 10
      }
    ]
  },
  "Raiko: Apex Legends Internal Cheat": {
    "productId": "5e5b3421-cf94-4f23-be7d-4b75a075cd6e",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 6
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 20
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 40
      }
    ]
  },
  "BO7: Royal External Cheat": {
    "productId": "16e1511a-b18f-4bd4-aab7-03f138e3459d",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 5
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 10
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 24
      }
    ]
  },
  "Lucent: R.E.P.O Internal Cheat": {
    "productId": "c4da34ed-e29f-464e-89b1-e5d18395f35f",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 2
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 4
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 7
      },
      {
        "id": "variant_3",
        "name": "Lifetime",
        "price": 10
      }
    ]
  },
  "Krush: Meccha Chameleon Internal Cheat": {
    "productId": "b6d2ce45-cfab-4129-a706-7192e4a79983",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 8
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 15
      }
    ]
  },
  "Akuma: ARC Raiders Internal Cheat": {
    "productId": "5da82257-b97f-49a0-a51d-57226129830b",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 6
      },
      {
        "id": "variant_1",
        "name": "1 Week ",
        "price": 15
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 45
      }
    ]
  },
  "Shield: Valorant Browser Radar": {
    "productId": "de505036-8291-444f-816f-1bb305968f4e",
    "variants": [
      {
        "id": "example",
        "name": "3 Days",
        "price": 8
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 14
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 28
      }
    ]
  },
  "Meccha Chameleon Auto Painter Cheat": {
    "productId": "ebe3eeb0-bf99-4ef9-b64b-293ad266a81f",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 2
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 4
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 7
      },
      {
        "id": "variant_3",
        "name": "Lifetime",
        "price": 10
      }
    ]
  },
  "Chester: Rocket League Internal Cheat": {
    "productId": "7128a92e-1dcf-44e1-8eae-76a9f34ad3f9",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4
      },
      {
        "id": "variant_1",
        "name": "1 Month",
        "price": 20
      }
    ]
  },
  "Akuma: NBA 2K26 Internal Cheat": {
    "productId": "6403f86a-a229-4c46-ae5d-2d5d058a1ae5",
    "variants": [
      {
        "id": "example",
        "name": "1 Week",
        "price": 30
      },
      {
        "id": "variant_1",
        "name": "1 Month",
        "price": 80
      }
    ]
  },
  "Arcane: Palworld Cheat": {
    "productId": "580b3093-a12e-4770-b2e4-1e623d724880",
    "variants": [
      {
        "id": "example",
        "name": "1 Week",
        "price": 5.5
      },
      {
        "id": "variant_1",
        "name": "1 Month",
        "price": 16.5
      },
      {
        "id": "variant_2",
        "name": "3 Month",
        "price": 38.5
      }
    ]
  },
  "OmniControl Pro": {
    "productId": "31e43c51-3a2e-416c-9590-e10e5c45e4bd",
    "variants": [
      {
        "id": "variant_1",
        "name": "1 Month",
        "price": 7
      },
      {
        "id": "example",
        "name": "Lifetime",
        "price": 30
      }
    ]
  },
  "Arcane: Mistfall Hunter Cheat": {
    "productId": "56d98c32-1ff3-4efc-977f-36d604da799d",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 5.5
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 24.2
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 44
      }
    ]
  },
  "Sapphire: R6S Unlock All": {
    "productId": "27ea17e9-2723-49d3-b06c-060c2c8b24c7",
    "variants": [
      {
        "id": "example",
        "name": "3 Days",
        "price": 8.4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 20
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 40
      }
    ]
  },
  "Ancient: Wardogs Cheat": {
    "productId": "c9bc15f6-f7ac-44c4-80c4-5c3aaa72caa8",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 3
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 15
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 30
      }
    ]
  },
  "Arcane: Wardogs Cheat": {
    "productId": "4808296e-33a1-4c39-a6c9-94e0a0407eb1",
    "variants": [
      {
        "id": "example",
        "name": "1 Day",
        "price": 4.4
      },
      {
        "id": "variant_1",
        "name": "1 Week",
        "price": 16.5
      },
      {
        "id": "variant_2",
        "name": "1 Month",
        "price": 33
      }
    ]
  }
});
