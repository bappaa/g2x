import { ImageResponse } from "next/og";

/**
 * Favicon, generated at build time so it always matches the navbar logo:
 * a purple rounded tile with a white "G". Google shows this next to the
 * search result, where a missing icon renders as a generic globe.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(140deg,#a855f7,#6d28d9)",
          borderRadius: 14,
          color: "#fff",
          fontSize: 42,
          fontWeight: 900,
        }}
      >
        G
      </div>
    ),
    size
  );
}
