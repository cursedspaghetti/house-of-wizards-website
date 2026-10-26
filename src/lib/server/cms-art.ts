import "server-only";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireCMSUser, isAuthError } from "@/lib/cms-auth";
import { getSupabaseClient } from "@/lib/supabase";
import {
  artistInput,
  artworkInput,
  validateArtUpload,
} from "@/lib/cms-art-validation";
import { artworkTitle } from "@/lib/art-titles";
import { artFileSchema } from "@/types/art";
import { cmsArtworkSchema } from "@/types/cms-art";
import { logger } from "@/lib/logger";

type Kind = "artist" | "artwork";
type ObjectRef = { bucket_id: string; object_path: string };
type StoredFile = z.infer<typeof artFileSchema> & { sha256: string };
const db = () => getSupabaseClient();
class ArtError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const check = (error: { message: string; code?: string } | null) => {
  if (!error) return;
  if (error.message.includes("CONFLICT"))
    throw new ArtError(
      "This entry changed since you opened it. Reload before saving.",
      409,
    );
  if (error.message.includes("ARTIST_HAS_ARTWORKS") || error.code === "23503")
    throw new ArtError(
      "This artist has artworks. Reassign or delete them first.",
      409,
    );
  if (error.message.includes("NOT_FOUND"))
    throw new ArtError("Entry not found", 404);
  if (error.message.includes("ORIGINAL_REQUIRED"))
    throw new ArtError("Add an original file or an external artwork URL");
  logger.error("Art catalog database operation failed", error);
  throw new ArtError("The catalog could not be saved. Please retry.", 500);
};
const invalidate = () => {
  revalidateTag("commission-art");
  revalidatePath("/art", "layout");
  revalidatePath("/cms/art", "layout");
};
/** A durable cleanup queue prevents storage failures from undoing a successful edit. */
export const cleanArtStorage = async () => {
  const { data, error } = await db()
    .from("commission_storage_cleanup")
    .select("bucket_id,object_path")
    .limit(500);
  if (error || !data) return;
  const objects = z
    .array(z.object({ bucket_id: z.string(), object_path: z.string() }))
    .parse(data);
  for (const bucket of ["commission-originals", "commission-web"]) {
    const paths = objects
      .filter((o) => o.bucket_id === bucket)
      .map((o) => o.object_path);
    if (!paths.length) continue;
    const removed = await db().storage.from(bucket).remove(paths);
    if (!removed.error)
      await db()
        .from("commission_storage_cleanup")
        .delete()
        .eq("bucket_id", bucket)
        .in("object_path", paths);
  }
};
const queueCleanup = async (objects: ObjectRef[]) => {
  if (!objects.length) return;
  const { error } = await db()
    .from("commission_storage_cleanup")
    .upsert(objects, { onConflict: "bucket_id,object_path" });
  if (error)
    logger.error("Could not queue temporary artwork files for cleanup", error);
  await cleanArtStorage();
};
const store = async (
  bucket: string,
  path: string,
  bytes: Buffer,
  mime: string,
  uploaded: ObjectRef[],
) => {
  const { error } = await db().storage.from(bucket).upload(path, bytes, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error)
    throw new ArtError(
      "The upload failed. Check the file size and try again.",
      502,
    );
  uploaded.push({ bucket_id: bucket, object_path: path });
};
const imageVersions = async (file: File) => {
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const metadata = await sharp(bytes, {
      limitInputPixels: 80_000_000,
    }).metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "gif", "webp", "avif", "heif", "tiff"].includes(
        metadata.format,
      )
    )
      throw new ArtError("Unsupported image format");
    const thumbnail = await sharp(bytes, { limitInputPixels: 80_000_000 })
      .rotate()
      .resize(640, 640, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    const web = await sharp(bytes, {
      animated: true,
      limitInputPixels: 80_000_000,
    })
      .rotate()
      .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();
    return {
      bytes,
      thumbnail,
      web,
      width: metadata.width ?? null,
      height: metadata.pageHeight ?? metadata.height ?? null,
    };
  } catch {
    throw new ArtError(
      "This image could not be decoded. Try a supported raster image with smaller dimensions.",
    );
  }
};
const uploadedFile = (form: FormData, key: string): File | null => {
  const value = form.get(key);
  // Multipart entries are strings or File values. Avoid the global File
  // constructor: it is absent in Node 18 and can differ across runtimes.
  return value !== null && typeof value !== "string" && value.size > 0
    ? value
    : null;
};
const readFiles = (form: FormData, key: string) =>
  form
    .getAll(key)
    .filter(
      (value): value is File => typeof value !== "string" && value.size > 0,
    );
const validateFiles = (files: File[], photo = false) => {
  for (const file of files) {
    const error = validateArtUpload(file, photo);
    if (error) throw new ArtError(error);
  }
};
const fileRecord = async (
  artworkId: string,
  file: File,
  variant: "original" | "web" | "thumbnail",
  bytes: Buffer,
  mime: string,
  uploaded: ObjectRef[],
  originalId: string | null = null,
  page: number | null = null,
): Promise<StoredFile> => {
  const id = randomUUID();
  const bucket =
    variant === "original" ? "commission-originals" : "commission-web";
  const extension =
    mime === "image/webp"
      ? "webp"
      : file.name
          .split(".")
          .pop()
          ?.replace(/[^a-z0-9]/gi, "")
          .slice(0, 12) || "bin";
  const path = `artworks/${artworkId}/${id}/${variant}.${extension}`;
  let width: number | null = null;
  let height: number | null = null;
  if (mime.startsWith("image/")) {
    const metadata = await sharp(bytes, {
      limitInputPixels: 80_000_000,
    }).metadata();
    width = metadata.width ?? null;
    height = metadata.pageHeight ?? metadata.height ?? null;
  }
  await store(bucket, path, bytes, mime, uploaded);
  return {
    id,
    original_filename: file.name,
    variant,
    original_file_id: originalId,
    page_number: page,
    bucket_id: bucket,
    object_path: path,
    mime_type: mime,
    byte_size: bytes.length,
    sha256: createHash("sha256").update(new Uint8Array(bytes)).digest("hex"),
    width,
    height,
  };
};
const uploadOriginal = async (
  id: string,
  file: File,
  uploaded: ObjectRef[],
  page: number | null,
): Promise<StoredFile[]> => {
  if (file.type.startsWith("image/")) {
    const image = await imageVersions(file);
    const original = await fileRecord(
      id,
      file,
      "original",
      image.bytes,
      file.type,
      uploaded,
      null,
      page,
    );
    return [
      original,
      await fileRecord(
        id,
        file,
        "thumbnail",
        image.thumbnail,
        "image/webp",
        uploaded,
        original.id,
        page,
      ),
      await fileRecord(
        id,
        file,
        "web",
        image.web,
        "image/webp",
        uploaded,
        original.id,
        page,
      ),
    ];
  }
  return [
    await fileRecord(
      id,
      file,
      "original",
      Buffer.from(await file.arrayBuffer()),
      file.type,
      uploaded,
      null,
      page,
    ),
  ];
};
const attachPreviews = async (kind: Kind, data: unknown) => {
  const entries = z
    .array(
      z
        .object({
          id: z.string(),
          profile_image_bucket: z.string().nullable().optional(),
          profile_image_path: z.string().nullable().optional(),
          commission_artwork_files: z.array(artFileSchema).optional(),
        })
        .passthrough(),
    )
    .parse(data);
  const refs = entries.map((entry) => {
    const file = entry.commission_artwork_files?.find(
      (file) => file.variant === "thumbnail",
    );
    return {
      id: entry.id,
      bucket: kind === "artist" ? entry.profile_image_bucket : file?.bucket_id,
      path: kind === "artist" ? entry.profile_image_path : file?.object_path,
    };
  });
  const urls = new Map<string, string>();
  for (const bucket of new Set(
    refs.map((ref) => ref.bucket).filter((value): value is string => !!value),
  )) {
    const paths = refs
      .filter((ref) => ref.bucket === bucket)
      .map((ref) => ref.path)
      .filter((value): value is string => !!value);
    if (!paths.length) continue;
    const { data: signed, error } = await db()
      .storage.from(bucket)
      .createSignedUrls(paths, 3600);
    if (!error)
      signed?.forEach((item) => {
        if (item.path && item.signedUrl)
          urls.set(`${bucket}/${item.path}`, item.signedUrl);
      });
  }
  return entries.map((entry) => {
    const artwork = kind === "artwork" ? cmsArtworkSchema.parse(entry) : null;
    const display_title = artwork
      ? artworkTitle(
          artwork.title,
          artwork.commission_artwork_rune_assets.map(
            (link) => link.commission_rune_assets,
          ),
          artwork.featured_assets_source_text,
        )
      : undefined;
    const ref = refs.find((ref) => ref.id === entry.id);
    return {
      ...entry,
      display_title,
      [kind === "artist" ? "avatar_url" : "preview_url"]:
        urls.get(`${ref?.bucket}/${ref?.path}`) ?? null,
    };
  });
};
const table = (kind: Kind) =>
  kind === "artist" ? "commission_artists" : "commission_artworks";
export const artCMS =
  (kind: Kind, action: "list" | "get" | "save" | "delete") =>
  async (
    request: NextRequest,
    context?: { params: Promise<{ id: string }> },
  ) => {
    const uploaded: ObjectRef[] = [];
    let committed = false;
    let saveAttempted = false;
    let rollbackConfirmed = false;
    try {
      const auth = await requireCMSUser();
      if (isAuthError(auth))
        return NextResponse.json(
          { error: auth.error },
          { status: auth.status },
        );
      if (action !== "get" && action !== "list") {
        const origin = request.headers.get("origin");
        if (origin && origin !== request.nextUrl.origin)
          throw new ArtError("Invalid request origin", 403);
      }
      const param = context ? (await context.params).id : undefined;
      if (param && !z.string().uuid().safeParse(param).success)
        throw new ArtError("Invalid entry ID");
      if (action === "list" || action === "get") {
        const selection =
          kind === "artist"
            ? "*,commission_artist_links(id,kind,value),commission_artworks(id)"
            : "*,commission_artwork_files(*),commission_artwork_rune_assets(commission_rune_assets(*))";
        let query = db()
          .from(table(kind))
          .select(selection)
          .order(kind === "artist" ? "name" : "created_at", {
            ascending: kind === "artist",
          });
        if (param) query = query.eq("id", param);
        const { data, error } = await query;
        check(error);
        if (param && !data?.length) throw new ArtError("Entry not found", 404);
        return NextResponse.json(
          { entries: await attachPreviews(kind, data ?? []) },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      }
      const id = param ?? randomUUID();
      if (action === "delete") {
        const { error } = await db().rpc("cms_delete_commission_art", {
          p_id: id,
          p_kind: kind,
        });
        check(error);
        committed = true;
        invalidate();
        await cleanArtStorage();
        return NextResponse.json({ ok: true });
      }
      if (
        Number(request.headers.get("content-length") ?? 0) >
        125 * 1024 * 1024
      )
        throw new ArtError("Upload no more than 120 MB at once", 413);
      const form = await request.formData();
      const bytes = Array.from(form.values()).reduce(
        (total, value) => total + (typeof value !== "string" ? value.size : 0),
        0,
      );
      if (bytes > 120 * 1024 * 1024)
        throw new ArtError("Upload no more than 120 MB at once", 413);
      const raw = form.get("data");
      if (typeof raw !== "string") throw new ArtError("Missing form data");
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new ArtError("Invalid form data");
      }
      if (kind === "artist") {
        const input = artistInput.parse(parsed);
        let existing: {
          profile_image_bucket: string | null;
          profile_image_path: string | null;
          profile_image_original_path: string | null;
        } | null = null;
        if (param) {
          const { data, error } = await db()
            .from(table(kind))
            .select(
              "profile_image_bucket,profile_image_path,profile_image_original_path",
            )
            .eq("id", id)
            .maybeSingle();
          check(error);
          if (!data) throw new ArtError("Entry not found", 404);
          existing = data;
        }
        const photo = uploadedFile(form, "photo");
        if (photo) validateFiles([photo], true);
        let picture = input.remove_photo
          ? {
              profile_image_bucket: null,
              profile_image_path: null,
              profile_image_original_path: null,
            }
          : (existing ?? {
              profile_image_bucket: null,
              profile_image_path: null,
              profile_image_original_path: null,
            });
        if (photo) {
          const image = await imageVersions(photo);
          const avatar = await sharp(image.bytes)
            .rotate()
            .resize(256, 256, { fit: "cover" })
            .webp({ quality: 85 })
            .toBuffer();
          const version = randomUUID();
          const originalPath = `artists/${id}/${version}/original.${
            photo.name
              .split(".")
              .pop()
              ?.replace(/[^a-z0-9]/gi, "") || "bin"
          }`;
          const webPath = `artists/${id}/${version}/avatar.webp`;
          await store(
            "commission-originals",
            originalPath,
            image.bytes,
            photo.type,
            uploaded,
          );
          await store(
            "commission-web",
            webPath,
            avatar,
            "image/webp",
            uploaded,
          );
          picture = {
            profile_image_bucket: "commission-web",
            profile_image_path: webPath,
            profile_image_original_path: originalPath,
          };
        }
        saveAttempted = true;
        const { error } = await db().rpc("cms_save_commission_artist", {
          p_id: id,
          p_data: { ...input, ...picture },
          p_links: input.links,
        });
        rollbackConfirmed = !!error?.code && /^[0-9A-Z]{5}$/.test(error.code);
        check(error);
      } else {
        const input = artworkInput.parse(parsed);
        const originals = readFiles(form, "originals");
        const poster = uploadedFile(form, "poster");
        const webPreview = uploadedFile(form, "web_preview");
        if (
          originals.reduce((sum, file) => sum + file.size, 0) >
          120 * 1024 * 1024
        )
          throw new ArtError("Upload no more than 120 MB at once");
        validateFiles(originals);
        if (poster) validateFiles([poster], true);
        if (webPreview) {
          validateFiles([webPreview]);
          if (
            !webPreview.type.startsWith("video/") &&
            !webPreview.type.startsWith("audio/")
          )
            throw new ArtError("Web preview must be audio or video");
        }
        if (originals.length > 30)
          throw new ArtError("Upload no more than 30 comic pages at once");
        let existing: StoredFile[] = [];
        if (param) {
          const { data, error } = await db()
            .from("commission_artwork_files")
            .select("*")
            .eq("artwork_id", id);
          check(error);
          existing = z
            .array(artFileSchema.extend({ sha256: z.string() }))
            .parse(data);
        }
        const originalIds = existing
          .filter((f) => f.variant === "original")
          .map((f) => f.id);
        if (
          input.remove_file_ids.some(
            (fileId) => !originalIds.includes(fileId),
          ) ||
          input.pages.some((page) => !originalIds.includes(page.id))
        )
          throw new ArtError("A file does not belong to this artwork");
        const retained = existing.filter(
          (f) =>
            f.variant === "original" && !input.remove_file_ids.includes(f.id),
        );
        if (!input.comic && retained.length + originals.length > 1)
          throw new ArtError(
            "Separate originals need separate artworks. Enable comic mode only for comic pages.",
          );
        if ((poster || webPreview) && originals[0]?.type.startsWith("image/"))
          throw new ArtError(
            "Images already get automatic previews; add covers only for video, audio or PDFs",
          );
        if ((poster || webPreview) && originals.length !== 1)
          throw new ArtError(
            "Upload a poster or web preview together with one new media original",
          );
        if (
          webPreview &&
          !originals[0]?.type.startsWith(webPreview.type.split("/")[0] + "/")
        )
          throw new ArtError("The preview must match the original media type");
        const title =
          input.title ||
          artworkTitle("", input.assets, input.featured_assets_source_text);
        if (!title.trim())
          throw new ArtError(
            "Enter a fallback title or link a known character",
          );
        if (!retained.length && !originals.length && !input.external_url)
          throw new ArtError(
            "Upload an original or enter an external artwork URL",
          );
        const pages = input.pages.filter(
          (page) => !input.remove_file_ids.includes(page.id),
        );
        if (input.comic && pages.length !== retained.length)
          throw new ArtError("Set a page number for each retained comic page");
        if (!input.comic) {
          for (const file of retained)
            pages.push({ id: file.id, page_number: 1 });
        }
        const nextPage = Math.max(0, ...pages.map((p) => p.page_number));
        const files: StoredFile[] = [];
        for (let index = 0; index < originals.length; index++)
          files.push(
            ...(await uploadOriginal(
              id,
              originals[index],
              uploaded,
              input.comic ? nextPage + index + 1 : null,
            )),
          );
        const original = files.find((f) => f.variant === "original");
        if (poster && original) {
          const image = await imageVersions(poster);
          files.push(
            await fileRecord(
              id,
              poster,
              "thumbnail",
              image.thumbnail,
              "image/webp",
              uploaded,
              original.id,
              original.page_number,
            ),
          );
          if (
            !original.mime_type.startsWith("video/") &&
            !original.mime_type.startsWith("audio/")
          )
            files.push(
              await fileRecord(
                id,
                poster,
                "web",
                image.web,
                "image/webp",
                uploaded,
                original.id,
                original.page_number,
              ),
            );
        }
        if (webPreview && original)
          files.push(
            await fileRecord(
              id,
              webPreview,
              "web",
              Buffer.from(await webPreview.arrayBuffer()),
              webPreview.type,
              uploaded,
              original.id,
              original.page_number,
            ),
          );
        const assets = input.assets.map((asset) => ({
          ...asset,
          asset_url: ["wizards", "warriors", "souls"].includes(asset.collection)
            ? `https://www.forgottenrunes.com/lore/${asset.collection}/${asset.asset_identifier}/0`
            : null,
        }));
        saveAttempted = true;
        const { error } = await db().rpc("cms_save_commission_artwork", {
          p_id: id,
          p_data: { ...input, title, pages },
          p_assets: assets,
          p_files: files,
          p_remove_ids: input.remove_file_ids,
        });
        rollbackConfirmed = !!error?.code && /^[0-9A-Z]{5}$/.test(error.code);
        check(error);
      }
      committed = true;
      invalidate();
      await cleanArtStorage();
      return NextResponse.json({ id }, { status: param ? 200 : 201 });
    } catch (error: unknown) {
      if (committed) {
        logger.error("Art saved but cache/storage cleanup was delayed", error);
        return NextResponse.json({ ok: true });
      }
      // A lost response does not prove rollback: never delete uploads that a
      // successful transaction might already reference.
      if (saveAttempted && !rollbackConfirmed) {
        logger.error(
          "Could not confirm art save; retain uploaded files for recovery",
          { error, uploaded },
        );
        return NextResponse.json(
          {
            error:
              "Could not confirm the save. Reload the catalog before retrying.",
          },
          { status: 503 },
        );
      }
      await queueCleanup(uploaded);
      if (error instanceof z.ZodError)
        return NextResponse.json(
          {
            error: error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; "),
          },
          { status: 400 },
        );
      if (error instanceof ArtError)
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      logger.error("Art CMS request failed", error);
      return NextResponse.json(
        { error: "The request failed. Please retry." },
        { status: 500 },
      );
    }
  };
