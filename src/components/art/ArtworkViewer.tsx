"use client";
/* Pre-sized WebP files are generated at import; signed URLs are served directly. */
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Heart,
} from "lucide-react";
import type { ArtArtist, Artwork } from "@/types/art";
import { ZoomableArtwork } from "./ZoomableArtwork";

export const ArtworkViewer = ({
  artwork,
  artist,
  onBack,
}: {
  artwork: Artwork;
  artist?: ArtArtist;
  onBack?: () => void;
}) => {
  const [page, setPage] = useState(0);
  const originals = artwork.files.filter((f) => f.variant === "original");
  const original = originals[page];
  const preview =
    artwork.files.find(
      (f) => f.variant === "web" && f.original_file_id === original?.id,
    ) ??
    artwork.files.find((f) => f.variant === "web") ??
    (original && /^(video|audio)\//.test(original.mime_type)
      ? original
      : undefined);
  const image = preview?.url;
  return (
    <div className="art-viewer">
      <div className="art-stage">
        <Link
          className="art-back"
          href="/art"
          onClick={(event) => {
            if (onBack) {
              event.preventDefault();
              onBack();
            }
          }}
        >
          <ArrowLeft size={16} /> All art
        </Link>
        {image ? (
          preview.mime_type.startsWith("video/") ? (
            <video
              key={image}
              className="art-full-image"
              src={image}
              poster={
                artwork.files.find(
                  (f) =>
                    f.variant === "thumbnail" &&
                    f.original_file_id === original?.id,
                )?.url ?? undefined
              }
              controls
              playsInline
              preload="metadata"
              aria-label={artwork.title}
            />
          ) : preview.mime_type.startsWith("audio/") ? (
            <audio
              src={image}
              controls
              preload="metadata"
              aria-label={artwork.title}
            />
          ) : (
            <ZoomableArtwork
              key={image}
              src={image}
              alt={
                artwork.title +
                (originals.length > 1 ? ` — page ${page + 1}` : "")
              }
            />
          )
        ) : (
          <div className="art-writing">
            <span>
              {artwork.external_url
                ? "From the Book of Lore"
                : original?.mime_type === "application/pdf"
                  ? "PDF artwork"
                  : "Original artwork"}
            </span>
            <h2>{artwork.title}</h2>
            {artwork.external_url && (
              <a href={artwork.external_url} target="_blank" rel="noreferrer">
                Read the story <ArrowUpRight size={18} />
              </a>
            )}
          </div>
        )}
        {originals.length > 1 && (
          <nav aria-label="Comic pages" className="art-pages">
            <button
              aria-label="Previous page"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <span>
              Page {page + 1} of {originals.length}
            </span>
            <button
              aria-label="Next page"
              disabled={page === originals.length - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </nav>
        )}
      </div>
      <aside className="art-details">
        <p className="art-eyebrow">THE HOUSE COLLECTION</p>
        <h1>{artwork.title}</h1>
        {artist && (
          <Link className="art-credit" href={`/art?artist=${artist.id}`}>
            {artist.avatarUrl ? (
              <img src={artist.avatarUrl} alt="" width={44} height={44} />
            ) : (
              <span className="art-initials">{artist.name.slice(0, 2)}</span>
            )}
            <span>
              <small>Created by</small>
              <strong>{artist.name}</strong>
            </span>
            <ArrowUpRight size={18} />
          </Link>
        )}
        {artwork.funded && (
          <span className="art-funded">
            <Heart size={13} /> Funded by the House of Wizards
          </span>
        )}
        {artwork.description && (
          <p className="art-description">{artwork.description}</p>
        )}
        {artwork.assets.length > 0 && (
          <div className="art-token-section">
            <h2>In this artwork</h2>
            <div className="art-token-links">
              {artwork.assets.map((a) => (
                <Link
                  key={a.id}
                  href={`/art?collection=${encodeURIComponent(a.collection)}&token=${encodeURIComponent(a.asset_identifier)}`}
                >
                  {a.collection} #{a.asset_identifier}
                  <ArrowUpRight size={13} />
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="art-detail-actions">
          {original && (
            <a
              className="art-primary-link"
              href={`/api/art/${artwork.id}/download?file=${original.id}`}
            >
              <ArrowDownToLine size={16} /> Download original{" "}
              <span>{(original.byte_size / 1048576).toFixed(1)} MB</span>
            </a>
          )}
          {artist?.portfolio_url && (
            <a
              className="art-secondary-link"
              href={artist.portfolio_url}
              target="_blank"
              rel="noreferrer"
            >
              Artist’s portfolio <ArrowUpRight size={16} />
            </a>
          )}
        </div>
      </aside>
    </div>
  );
};
