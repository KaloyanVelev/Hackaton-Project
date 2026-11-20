import { StreetAware } from "@/components/street-aware";

export const dynamic = "force-dynamic";

export default function Home() {
  return <StreetAware imageryKey={process.env.MAPTILER_PUBLIC_KEY?.trim() || null} />;
}
