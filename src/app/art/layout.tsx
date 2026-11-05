import "@/components/art/art.css";
// Pages contain expiring private-storage URLs; never cache rendered HTML.
export const dynamic = "force-dynamic";

export default function ArtLayout({ children }: { children: React.ReactNode }) {
  return children;
}
