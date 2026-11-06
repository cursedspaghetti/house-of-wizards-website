export type GamePlatform =
  | { kind: "browser" }
  | { kind: "steam"; status: "coming-soon" | "released" };

export type CommunityGame = {
  title: string;
  href: string;
  description: string;
  tags: string[];
  platform: GamePlatform;
  featured?: boolean;
};

// Community games set in the Runiverse, in display order.
// To add a game, append an entry here.
export const communityGames: CommunityGame[] = [
  {
    title: "Forgotten Runiverse",
    href: "https://game.runiverse.world/",
    description:
      "The main game: a free-to-play pixel-art fantasy MMO set in the world of the Forgotten Runes Wizard's Cult. Adventure, fight and craft across the Runiverse.",
    tags: ["MMO", "RPG"],
    platform: { kind: "browser" },
    featured: true,
  },
  {
    title: "Runes TCG",
    href: "https://www.runes-tcg.com/",
    description:
      "A strategic 1v1 trading card game set in the Runiverse: collect cards and outplay opponents on a tactical grid.",
    tags: ["Card Game", "PvP"],
    platform: { kind: "browser" },
  },
  {
    title: "Breadventure",
    href: "https://store.steampowered.com/app/3941330/Breadventure/",
    description:
      "A party-based RPG by Feckless: you are a loaf of bread on the way to becoming a legend. Recruit companions, fight, cook and schmooze your way to the top.",
    tags: ["RPG"],
    platform: { kind: "steam", status: "coming-soon" },
  },
  {
    title: "Forgotten Runes: Demiurge",
    href: "https://demiurge-demo-production.up.railway.app/",
    description:
      "A story builder and adventure in the Runiverse: shape your own tale and set out on it.",
    tags: ["Story Builder", "Adventure"],
    platform: { kind: "browser" },
  },
  {
    title: "Rebel Shadows",
    href: "https://www.rebel-shadows.xyz/",
    description:
      "A pixel-art action roguelite: play your wizard, charge the Shadows Heart with elemental magic, survive the waves and take down the bosses.",
    tags: ["Action", "Roguelite"],
    platform: { kind: "browser" },
  },
  {
    title: "Ichor & Ashes",
    href: "https://ichor-and-ashes.vercel.app/",
    description:
      "A community-made action roguelite in the Runiverse, playable in the browser.",
    tags: ["Action", "Roguelite"],
    platform: { kind: "browser" },
  },
];

export const platformLabel = (platform: GamePlatform): string => {
  switch (platform.kind) {
    case "browser":
      return "Browser";
    case "steam":
      return platform.status === "coming-soon"
        ? "PC · Steam · Coming soon"
        : "PC · Steam";
    default: {
      const exhaustive: never = platform;
      return exhaustive;
    }
  }
};

export const ctaLabel = (platform: GamePlatform): string =>
  platform.kind === "steam" ? "View on Steam" : "Play";
