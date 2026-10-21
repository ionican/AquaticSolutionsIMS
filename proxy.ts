import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { roleFromAppMetadata } from "./lib/roles"

// Default deny: everything requires a Supabase session except the login page
// and static assets. New routes are protected without opt-in.
// /auth/* hosts the invite / password-reset landing pages, which must be
// reachable without a session.
const PUBLIC_PATHS = new Set(["/login"])
// /_vercel/ carries the Analytics script + beacons, which the login page loads.
const PUBLIC_PREFIXES = ["/auth/", "/_next/", "/_vercel/", "/brand/", "/favicon", "/icon", "/apple-icon"]

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Refreshed tokens must reach both downstream code (request) and
          // the browser (response).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Validates the JWT against Supabase and refreshes it when close to expiry.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    // Preserve the query string so deep links (e.g. an edit-mode ?id=) survive
    // the login round-trip.
    const target = pathname + request.nextUrl.search
    loginUrl.search = ""
    if (target !== "/") {
      loginUrl.searchParams.set("redirect", target)
    }
    return NextResponse.redirect(loginUrl)
  }

  // Signed in but no recognised role: nothing is permitted, so stop here.
  // Route handlers and page layouts check permissions again themselves.
  if (!roleFromAppMetadata(user.app_metadata)) {
    if (pathname.startsWith("/api/")) {
      // build-info and get-ip are role-free; the build stamp on the no-role
      // page still calls build-info.
      if (pathname === "/api/build-info" || pathname === "/api/get-ip") return response
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (pathname !== "/no-role") {
      const noRoleUrl = request.nextUrl.clone()
      noRoleUrl.pathname = "/no-role"
      noRoleUrl.search = ""
      return NextResponse.redirect(noRoleUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
