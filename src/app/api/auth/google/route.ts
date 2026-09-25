import { NextResponse } from "next/server";

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/login?google=not-configured", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }

  return NextResponse.redirect(new URL("/login?google=pending-setup", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
}
