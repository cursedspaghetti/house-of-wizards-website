import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight, Gamepad2 } from "lucide-react";

import {
  communityGames,
  ctaLabel,
  platformLabel,
  type CommunityGame,
} from "./games";

export const metadata: Metadata = {
  title: "Gaming Hub · House of Wizards",
  description:
    "Every game built in the Runiverse by the Forgotten Runes community, in one place.",
};

type GameCardProps = {
  game: CommunityGame;
};

type GameArtProps = {
  title: string;
  image?: string;
  imageFit?: "cover" | "contain";
  featured: boolean;
};

const GameArt = ({ title, image, imageFit, featured }: GameArtProps) => (
  <div
    className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand-900/60 via-neutral-900 to-neutral-950 ${
      featured ? "aspect-video md:aspect-auto md:h-full" : "aspect-video"
    }`}
  >
    {image ? (
      <Image
        src={image}
        alt={`${title} cover art`}
        fill
        sizes={
          featured
            ? "(min-width: 768px) 700px, 100vw"
            : "(min-width: 768px) 576px, 100vw"
        }
        className={`${imageFit === "contain" ? "object-contain" : "object-cover"} transition-transform duration-500 group-hover:scale-[1.03]`}
        priority={featured}
      />
    ) : (
      <>
        <Gamepad2
          aria-hidden="true"
          className="h-12 w-12 text-brand-500/40 transition-colors group-hover:text-brand-400/70"
        />
        <span className="absolute bottom-3 right-3 rounded border border-neutral-700 bg-neutral-950/80 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          Placeholder art
        </span>
      </>
    )}
  </div>
);

const GameCard = ({ game }: GameCardProps) => {
  const featured = game.featured === true;
  return (
    <a
      href={game.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40 transition-colors hover:border-brand-500/60 hover:bg-neutral-900/70 ${
        featured ? "flex-col md:col-span-2 md:flex-row" : "flex-col"
      }`}
    >
      <div className={featured ? "md:w-3/5" : ""}>
        <GameArt
          title={game.title}
          image={game.image}
          imageFit={game.imageFit}
          featured={featured}
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        {featured && (
          <p className="text-xs uppercase tracking-[0.24em] text-brand-400">
            The main game
          </p>
        )}
        <h2
          className={`font-heading text-neutral-100 transition-colors group-hover:text-brand-300 ${
            featured ? "text-3xl" : "text-2xl"
          }`}
        >
          {game.title}
        </h2>
        <p className="text-sm leading-relaxed text-neutral-400">
          {game.description}
        </p>
        <div className="flex flex-wrap gap-2">
          {[...game.tags, platformLabel(game.platform)].map((tag) => (
            <span
              key={tag}
              className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-neutral-400"
            >
              {tag}
            </span>
          ))}
        </div>
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm uppercase tracking-[0.16em] text-brand-400 transition-colors group-hover:text-brand-300">
          {ctaLabel(game.platform)}
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </a>
  );
};

const GamingHubPage = () => (
  <div className="min-h-screen px-4 py-12 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-16 max-w-3xl">
        <p className="mb-3 text-sm uppercase tracking-[0.24em] text-brand-400">
          Forgotten Runes Wizard&apos;s Cult
        </p>
        <h1 className="font-heading text-4xl text-neutral-100 sm:text-6xl">
          Gaming Hub
        </h1>
        <p className="mt-5 text-base leading-relaxed text-neutral-400 sm:text-lg">
          Every game built in the Runiverse by the community, in one place.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {communityGames.map((game) => (
          <GameCard key={game.href} game={game} />
        ))}
      </div>

      <p className="mt-16 text-center text-sm text-neutral-500">
        Each game belongs to its creators.
        {communityGames.some((game) => !game.image) &&
          " Placeholder images are shown until the teams share their own artwork."}
      </p>
    </div>
  </div>
);

export default GamingHubPage;
