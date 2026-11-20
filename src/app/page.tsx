import { StreetAware } from "@/components/street-aware";
import { streetStyleUrl } from "@/lib/map-style";

export const dynamic = "force-dynamic";

export default function Home() {
  return <StreetAware imageryKey={process.env.MAPTILER_PUBLIC_KEY?.trim() || null}
    streetsStyle={process.env.OSM_STREET_STYLE_URL?.trim() || streetStyleUrl} />;
}
