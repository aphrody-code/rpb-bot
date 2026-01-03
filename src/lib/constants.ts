export const Colors = {
  Primary: 0xdc2626,     // RPB Red (from logo)
  Secondary: 0xfbbf24,   // RPB Gold/Yellow (from logo)
  Success: 0x22c55e,     // Green
  Warning: 0xf59e0b,     // Orange
  Error: 0xef4444,       // Red
  Info: 0x3b82f6,        // Blue
  Beyblade: 0x8b5cf6,    // Purple for Beyblade
} as const;

export const Emojis = {
  Success: "✅",
  Error: "❌",
  Warning: "⚠️",
  Loading: "⏳",
  Info: "ℹ️",
  Ping: "🏓",
  User: "👤",
  Server: "📋",
  Bot: "🤖",
  Kick: "👢",
  Ban: "🔨",
  Clear: "🧹",
  Welcome: "👋",
  // Beyblade specific
  Beyblade: "🌀",
  Tournament: "🏆",
  Battle: "⚔️",
  Win: "🥇",
  Lose: "💥",
} as const;

export const RPB = {
  Name: "RPB Bot",
  FullName: "République Populaire du Beyblade",
  Discord: "https://discord.gg/twdVfesrRj",
  Color: 0xdc2626,
  GoldColor: 0xfbbf24,
  // Channel names for auto-detection
  Channels: {
    Welcome: "bienvenue",
    Rules: "règlement",
    Roles: "rôles",
    Announcements: "annonces",
    Tournaments: "annonce-tournois",
    GeneralChat: "chat-general",
    Suggestions: "suggestions",
    Media: "média",
  },
  // Beyblade series
  Series: {
    BakutenShoot: "Bakuten Shoot (2001-2003)",
    MetalFight: "Metal Fight (2008-2012)",
    Burst: "Burst (2016-2022)",
    X: "X (2023+)",
  },
} as const;
