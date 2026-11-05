import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { artworkTitle } from "@/lib/art-titles";
import { getSupabaseClient } from "@/lib/supabase";
import { artistSchema, artworkSchema, type ArtCatalog } from "@/types/art";

const readCatalog = async () => {
  const db = getSupabaseClient();
  const [artistResult, artworkResult] = await Promise.all([
    db
      .from("commission_artists")
      .select("id,name,portfolio_url,profile_image_bucket,profile_image_path")
      .order("name"),
    db
      .from("commission_artworks")
      .select(
        "id,artist_id,title,description,funded,medium,external_url,featured_assets_source_text,commission_artwork_files(id,original_filename,variant,original_file_id,page_number,bucket_id,object_path,mime_type,width,height,byte_size),commission_artwork_rune_assets(commission_rune_assets(id,collection,asset_identifier,asset_url))",
      )
      .order("title"),
  ]);
  if (artistResult.error || artworkResult.error)
    throw new Error("The art catalog could not be loaded.");
  const artists = z.array(artistSchema).parse(artistResult.data);
  const artworks = z.array(artworkSchema).parse(artworkResult.data);
  return { artists, artworks };
};

// Cache durable metadata only. Signed URLs expire and must never be retained
// by the data cache or served during stale-while-revalidate.
const getCatalogData = unstable_cache(readCatalog, ["commission-art-data-v3"], {
  revalidate: 300,
  tags: ["commission-art"],
});

export const getArtCatalog = async (): Promise<ArtCatalog> => {
  const { artists, artworks } = await getCatalogData();
  const db = getSupabaseClient();
  const paths = new Map<string, Set<string>>();
  const add = (bucket: string, path: string) => {
    const group = paths.get(bucket) ?? new Set<string>();
    group.add(path);
    paths.set(bucket, group);
  };
  artists.forEach((a) => {
    if (a.profile_image_bucket && a.profile_image_path)
      add(a.profile_image_bucket, a.profile_image_path);
  });
  artworks.forEach((a) =>
    a.commission_artwork_files.forEach((f) => {
      if (f.variant !== "original" || /^(video|audio)\//.test(f.mime_type))
        add(f.bucket_id, f.object_path);
    }),
  );
  const urls = new Map<string, string>();
  await Promise.all(
    Array.from(paths, async ([bucket, objectPaths]) => {
      const { data, error } = await db.storage
        .from(bucket)
        .createSignedUrls(Array.from(objectPaths), 3600);
      if (error) throw new Error("Artwork previews could not be loaded.");
      data?.forEach((item) => {
        if (item.path && item.signedUrl)
          urls.set(`${bucket}/${item.path}`, item.signedUrl);
      });
    }),
  );
  return {
    artists: artists.map((a) => ({
      ...a,
      avatarUrl:
        urls.get(`${a.profile_image_bucket}/${a.profile_image_path}`) ?? null,
    })),
    artworks: artworks.map((a) => ({
      id: a.id,
      artist_id: a.artist_id,
      title: artworkTitle(
        a.title,
        a.commission_artwork_rune_assets.map(
          (link) => link.commission_rune_assets,
        ),
        a.featured_assets_source_text,
      ),
      description: a.description,
      funded: a.funded,
      medium: a.medium,
      external_url: a.external_url,
      assets: a.commission_artwork_rune_assets.map(
        (link) => link.commission_rune_assets,
      ),
      files: a.commission_artwork_files
        .map((f) => ({
          ...f,
          url: urls.get(`${f.bucket_id}/${f.object_path}`) ?? null,
        }))
        .sort((x, y) => (x.page_number ?? 0) - (y.page_number ?? 0)),
    })),
  };
};
