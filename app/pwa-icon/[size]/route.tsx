import { ImageResponse } from "next/og";

/** App icon for installing on a phone or desktop. Public, so the browser can fetch it before sign-in. */
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const n = size === "512" ? 512 : size === "180" ? 180 : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f9d73", borderRadius: n * 0.22 }}>
        <svg width={n * 0.58} height={n * 0.58} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 17 9 11 13 15 21 7" />
          <polyline points="15 7 21 7 21 13" />
        </svg>
      </div>
    ),
    { width: n, height: n },
  );
}
