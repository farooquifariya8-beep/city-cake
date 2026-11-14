import { MapShell } from "@/components/map/map-shell";

export default function MapLayout({ children }: LayoutProps<"/">) {
  return <MapShell>{children}</MapShell>;
}
