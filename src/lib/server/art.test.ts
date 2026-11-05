/** @jest-environment node */
import { getSupabaseClient } from "@/lib/supabase";
import { getArtCatalog } from "./art";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase", () => ({ getSupabaseClient: jest.fn() }));
jest.mock("next/cache", () => ({
  // Retain cached data across requests, including after signed URLs expire.
  unstable_cache: (read: () => Promise<unknown>) => {
    let cached: Promise<unknown> | undefined;
    return () => (cached ??= read());
  },
}));

it("reuses catalog metadata but signs fresh image links on every request", async () => {
  const sign = jest.fn().mockImplementation(async (paths: string[]) => ({
    data: paths.map((path) => ({
      path,
      signedUrl: `https://storage.example/${path}?generation=${sign.mock.calls.length}`,
    })),
    error: null,
  }));
  const from = jest.fn((table: string) => ({
    select: () => ({
      order: async () => ({
        error: null,
        data:
          table === "commission_artists"
            ? [
                {
                  id: "artist",
                  name: "Artist",
                  portfolio_url: null,
                  profile_image_bucket: "commission-web",
                  profile_image_path: "avatar.webp",
                },
              ]
            : [
                {
                  id: "art",
                  artist_id: "artist",
                  title: "Painting",
                  description: null,
                  funded: true,
                  medium: null,
                  external_url: null,
                  featured_assets_source_text: null,
                  commission_artwork_rune_assets: [],
                  commission_artwork_files: [
                    "original",
                    "web",
                    "thumbnail",
                  ].map((variant) => ({
                    id: variant,
                    original_filename: "art.png",
                    variant,
                    original_file_id:
                      variant === "original" ? null : "original",
                    page_number: null,
                    bucket_id:
                      variant === "original"
                        ? "commission-originals"
                        : "commission-web",
                    object_path: `${variant}.webp`,
                    mime_type: "image/webp",
                    width: 100,
                    height: 100,
                    byte_size: 100,
                  })),
                },
              ],
      }),
    }),
  }));
  jest.mocked(getSupabaseClient).mockReturnValue({
    from,
    storage: { from: () => ({ createSignedUrls: sign }) },
  } as unknown as ReturnType<typeof getSupabaseClient>);

  const first = await getArtCatalog();
  const later = await getArtCatalog();
  expect(from).toHaveBeenCalledTimes(2); // Two tables, read once.
  expect(sign).toHaveBeenCalledTimes(2);
  expect(later.artists[0].avatarUrl).not.toBe(first.artists[0].avatarUrl);
  expect(
    later.artworks[0].files.find((file) => file.variant === "web")?.url,
  ).not.toBe(
    first.artworks[0].files.find((file) => file.variant === "web")?.url,
  );
  expect(sign.mock.calls[0]).toEqual([
    ["avatar.webp", "web.webp", "thumbnail.webp"],
    3600,
  ]);
  expect(
    later.artworks[0].files.find((file) => file.variant === "original")?.url,
  ).toBeNull();
});
