import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "GymFlow — The gym OS built for growth"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#09090b",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 900,
            color: "#D50000",
            letterSpacing: "-4px",
            lineHeight: 1,
          }}
        >
          GYMFLOW
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#a1a1aa",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          The gym OS built for growth
        </div>
      </div>
    ),
    { ...size }
  )
}
