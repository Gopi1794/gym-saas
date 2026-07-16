import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: "TEAMID.com.gymflow.member",
            paths: ["/reset-password"],
          },
        ],
      },
    },
    { headers: { "Content-Type": "application/json" } }
  )
}
