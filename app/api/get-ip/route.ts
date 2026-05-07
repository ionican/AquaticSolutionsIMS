import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Get the IP from various possible headers
  const forwardedFor = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const cfConnectingIp = request.headers.get("cf-connecting-ip")

  let ip = forwardedFor?.split(",")[0] || realIp || cfConnectingIp || "Unknown"

  return NextResponse.json({ ip: ip.trim() })
}
