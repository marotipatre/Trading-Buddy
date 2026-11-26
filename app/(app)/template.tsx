import { PageEnter } from "@/components/motion/primitives";

/** Re-mounts on every navigation, so each page eases in instead of snapping. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageEnter>{children}</PageEnter>;
}
