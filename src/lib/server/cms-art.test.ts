/** @jest-environment node */
import { NextRequest } from "next/server";
import sharp from "sharp";
import { requireCMSUser } from "@/lib/cms-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { artCMS } from "./cms-art";

jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));
jest.mock("@/lib/cms-auth", () => ({
  requireCMSUser: jest.fn(),
  isAuthError: (result: unknown) =>
    !!result && typeof result === "object" && "error" in result,
}));
jest.mock("@/lib/supabase", () => ({ getSupabaseClient: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { error: jest.fn() } }));
const auth = jest.mocked(requireCMSUser);
const getDB = jest.mocked(getSupabaseClient);
const upload = jest.fn().mockResolvedValue({ error: null });
const remove = jest.fn().mockResolvedValue({ error: null });
const rpc = jest.fn().mockResolvedValue({ data: "id", error: null });
const upsert = jest.fn().mockResolvedValue({ error: null });
const queue = {
  select: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
  upsert,
};
beforeEach(() => {
  jest.clearAllMocks();
  upload.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: "id", error: null });
  auth.mockResolvedValue({
    address: "0xtest",
    user: {
      id: "editor",
      eth_address: "0xtest",
      twitter_handle: null,
      role: "editor",
      created_at: "",
      updated_at: "",
    },
  });
  // The database adapter is mocked at its boundary; production never bypasses CMS authentication.
  getDB.mockReturnValue({
    from: () => queue,
    rpc,
    storage: { from: () => ({ upload, remove }) },
  } as unknown as ReturnType<typeof getSupabaseClient>);
});
const request = (data: unknown, photo?: File, kind = "artist") => {
  const form = new FormData();
  form.set("data", JSON.stringify(data));
  if (photo) form.set(kind === "artist" ? "photo" : "originals", photo);
  return new NextRequest("http://localhost:3000/api/cms/art/artists", {
    method: "POST",
    body: form,
  });
};
describe("art CMS mutations", () => {
  it.each(["list", "get", "save", "delete"] as const)(
    "requires an authenticated CMS user for %s",
    async (action) => {
      auth.mockResolvedValue({ error: "Not authenticated", status: 401 });
      const response = await artCMS(
        "artist",
        action,
      )(new NextRequest("http://localhost:3000/api/cms/art/artists"));
      expect(response.status).toBe(401);
      expect(upload).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("rejects cross-origin form submissions", async () => {
    const response = await artCMS(
      "artist",
      "save",
    )(
      new NextRequest("http://localhost:3000/api/cms/art/artists", {
        method: "POST",
        headers: { origin: "https://untrusted.example" },
      }),
    );
    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects unsafe portfolio URLs", async () => {
    const response = await artCMS(
      "artist",
      "save",
    )(request({ name: "Artist", portfolio_url: "javascript:alert(1)" }));
    expect(response.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "saves an artist without a global File constructor (photo: %s)",
    async (withPhoto) => {
      const bytes = await sharp({
        create: { width: 4, height: 4, channels: 3, background: "purple" },
      })
        .png()
        .toBuffer();
      const req = request(
        { name: "Artist" },
        withPhoto
          ? new File([new Uint8Array(bytes)], "avatar.png", {
              type: "image/png",
            })
          : undefined,
      );
      // Node 18 supports multipart File values without a global File constructor.
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, "File");
      Object.defineProperty(globalThis, "File", {
        configurable: true,
        value: undefined,
      });
      try {
        const response = await artCMS("artist", "save")(req);
        expect(response.status).toBe(201);
        expect(rpc).toHaveBeenCalledTimes(1);
        expect(upload).toHaveBeenCalledTimes(withPhoto ? 2 : 0);
      } finally {
        if (descriptor) Object.defineProperty(globalThis, "File", descriptor);
        else Reflect.deleteProperty(globalThis, "File");
      }
    },
  );
  it("preserves avatar bytes and creates a small display version", async () => {
    const bytes = await sharp({
      create: { width: 1000, height: 600, channels: 3, background: "purple" },
    })
      .png()
      .toBuffer();
    const photo = new File([new Uint8Array(bytes)], "avatar.png", {
      type: "image/png",
    });
    const response = await artCMS(
      "artist",
      "save",
    )(
      request(
        { name: "Artist", portfolio_url: "", profile_image_source_url: "" },
        photo,
      ),
    );
    expect(response.status).toBe(201);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[0][1].toString("hex")).toBe(bytes.toString("hex"));
    const metadata = await sharp(upload.mock.calls[1][1]).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
  });
  it("queues newly uploaded files for cleanup if the atomic save fails", async () => {
    rpc.mockResolvedValue({ error: { message: "CONFLICT", code: "P0001" } });
    const bytes = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "purple" },
    })
      .png()
      .toBuffer();
    const response = await artCMS(
      "artist",
      "save",
    )(
      request(
        { name: "Artist" },
        new File([new Uint8Array(bytes)], "avatar.png", { type: "image/png" }),
      ),
    );
    expect(response.status).toBe(409);
    expect(upsert.mock.calls[0][0]).toHaveLength(2);
  });
  it("retains uploads when the database response is lost, since the save may have committed", async () => {
    rpc.mockRejectedValueOnce(new Error("Connection lost"));
    const bytes = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "purple" },
    })
      .png()
      .toBuffer();
    const response = await artCMS(
      "artist",
      "save",
    )(
      request(
        { name: "Artist" },
        new File([new Uint8Array(bytes)], "avatar.png", { type: "image/png" }),
      ),
    );
    expect(response.status).toBe(503);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upsert).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it("keeps each image original and links both resized previews to it", async () => {
    const bytes = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: "purple" },
    })
      .png()
      .toBuffer();
    const response = await artCMS(
      "artwork",
      "save",
    )(
      request(
        {
          artist_id: "10000000-0000-4000-8000-000000000001",
          title: "A painting",
          funded: true,
        },
        new File([new Uint8Array(bytes)], "painting.png", {
          type: "image/png",
        }),
        "artwork",
      ),
    );
    expect(response.status).toBe(201);
    expect(upload).toHaveBeenCalledTimes(3);
    expect(upload.mock.calls[0][1].toString("hex")).toBe(bytes.toString("hex"));
    const files = rpc.mock.calls[0][1].p_files;
    expect(files).toHaveLength(3);
    expect(files[1].original_file_id).toBe(files[0].id);
    expect(files[2].original_file_id).toBe(files[0].id);
    expect((await sharp(upload.mock.calls[1][1]).metadata()).width).toBe(640);
    expect((await sharp(upload.mock.calls[2][1]).metadata()).width).toBe(1920);
  });
  it("keeps GIF animation in the web preview", async () => {
    const bytes = Buffer.from(
      "R0lGODlhAgACAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQBCgABACwAAAAAAgACAIEAAP8AAAAAAAAAAAAIBgABCAQQEAA7",
      "base64",
    );
    const response = await artCMS(
      "artwork",
      "save",
    )(
      request(
        {
          artist_id: "10000000-0000-4000-8000-000000000001",
          title: "Animated spell",
          funded: true,
        },
        new File([new Uint8Array(bytes)], "spell.gif", { type: "image/gif" }),
        "artwork",
      ),
    );
    expect(response.status).toBe(201);
    expect(
      (await sharp(upload.mock.calls[2][1], { animated: true }).metadata())
        .pages,
    ).toBe(2);
  });
  it("rejects deleting an artist with linked artworks", async () => {
    rpc.mockResolvedValue({ error: { message: "ARTIST_HAS_ARTWORKS" } });
    const response = await artCMS("artist", "delete")(
      new NextRequest("http://localhost:3000/api/cms/art/artists"),
      {
        params: Promise.resolve({ id: "10000000-0000-4000-8000-000000000001" }),
      },
    );
    expect(response.status).toBe(409);
    expect(remove).not.toHaveBeenCalled();
  });
});
