import { z } from "zod";
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);
export const webUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    // Zod refinements also run after a failed .url() check.
    try {
      return ["https:", "http:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Use an HTTP(S) URL");
const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? null : value),
  webUrl.nullish().transform((value) => value ?? null),
);
export const artistInput = z
  .object({
    name: z.string().trim().min(1, "Artist name is required").max(200),
    portfolio_url: optionalUrl,
    profile_image_source_url: optionalUrl,
    remove_photo: z.boolean().default(false),
    expected_updated_at: z.string().datetime({ offset: true }).optional(),
    links: z
      .array(
        z.object({
          kind: z.enum([
            "portfolio",
            "twitter",
            "instagram",
            "discord",
            "tiktok",
            "other",
          ]),
          value: webUrl,
        }),
      )
      .max(30)
      .default([]),
  })
  .refine(
    (value) =>
      new Set(value.links.map((link) => `${link.kind}:${link.value}`)).size ===
      value.links.length,
    "Remove duplicate profile links",
  );
export const artworkInput = z
  .object({
    artist_id: z.string().uuid(),
    title: z.string().trim().max(300).default(""),
    description: optionalText(10000),
    medium: optionalText(200),
    funded: z.boolean(),
    external_url: optionalUrl,
    featured_assets_source_text: optionalText(5000),
    expected_updated_at: z.string().datetime({ offset: true }).optional(),
    assets: z
      .array(
        z.object({
          collection: z.enum([
            "wizards",
            "warriors",
            "souls",
            "ponies",
            "beasts",
            "athenaeum",
            "shadows",
          ]),
          asset_identifier: z
            .string()
            .trim()
            .regex(/^\d+$/, "Use a token ID")
            .max(40),
        }),
      )
      .max(100)
      .default([]),
    remove_file_ids: z.array(z.string().uuid()).max(100).default([]),
    pages: z
      .array(
        z.object({
          id: z.string().uuid(),
          page_number: z.number().int().positive().max(1000),
        }),
      )
      .max(100)
      .default([]),
    comic: z.boolean().default(false),
  })
  .refine(
    (value) =>
      new Set(
        value.assets.map(
          (asset) => `${asset.collection}:${asset.asset_identifier}`,
        ),
      ).size === value.assets.length,
    "Remove duplicate tokens",
  )
  .refine(
    (value) =>
      new Set(value.pages.map((page) => page.page_number)).size ===
      value.pages.length,
    "Page numbers must be unique",
  );
export type ArtistInput = z.infer<typeof artistInput>;
export type ArtworkInput = z.infer<typeof artworkInput>;
export const uploadTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/tiff",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/flac",
  "application/pdf",
];
export const validateArtUpload = (
  file: { size: number; type: string },
  photo = false,
): string | null => {
  if (!file.size) return "The selected file is empty";
  if (
    !uploadTypes.includes(file.type) ||
    (photo && !file.type.startsWith("image/"))
  )
    return "Choose a supported image, video, audio or PDF file";
  if (file.size > (file.type.startsWith("image/") ? 50 : 100) * 1024 * 1024)
    return "Images may be up to 50 MB; other media may be up to 100 MB";
  return null;
};
