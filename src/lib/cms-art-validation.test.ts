import { artistInput, artworkInput, webUrl } from "./cms-art-validation";

test("accepts blank optional artist URLs submitted by the CMS form", () => {
  expect(
    artistInput.parse({
      name: "Artist",
      portfolio_url: "",
      profile_image_source_url: "",
    }),
  ).toMatchObject({ portfolio_url: null, profile_image_source_url: null });
});

test("accepts a blank optional external artwork URL", () => {
  expect(
    artworkInput.parse({
      artist_id: "10000000-0000-4000-8000-000000000001",
      title: "Art",
      funded: true,
      external_url: "",
    }).external_url,
  ).toBeNull();
});

test.each([
  "",
  "not a URL",
  "https://",
  "javascript:alert(1)",
  "ftp://example.com",
])("rejects invalid required URL %s without throwing", (value) => {
  expect(webUrl.safeParse(value).success).toBe(false);
});

test("trims optional whitespace and accepts HTTP(S) links", () => {
  expect(
    artistInput.parse({ name: "Artist", portfolio_url: "  " }).portfolio_url,
  ).toBeNull();
  expect(webUrl.parse(" https://example.com/artist ")).toBe(
    "https://example.com/artist",
  );
});
