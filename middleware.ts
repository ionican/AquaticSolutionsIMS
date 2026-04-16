import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { ROUTE_PERMISSIONS, ROLE_PERMISSIONS, type Permission, type Role } from "@/lib/auth-types"

/** Paths that don't require authentication. */
const PUBLIC_PATHS = ["/login", "/auth/callback", "/api/version"]
const PUBLIC_PREFIXES = ["/_next/", "/icon", "/apple-icon", "/favicon"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  // Create a Supabase client that can read/write cookies on the response
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Update the request cookies so downstream code sees fresh values
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Re-create the response with updated request
          response = NextResponse.next({ request })
          // Set cookies on the response so the browser stores them
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session — this keeps the JWT alive and sets fresh cookies
  const { data: { user } } = await supabase.auth.getUser()

  // Not authenticated → redirect to login (for pages) or 401 (for API)
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check page-level permission requirements
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS)
    .sort((a, b) => b.length - a.length) // longest match first
    .find((route) => pathname === route || pathname.startsWith(route + "/"))

  if (matchedRoute) {
    const requiredPermission = ROUTE_PERMISSIONS[matchedRoute]

    // Quick permission check using role from user metadata.
    // The user_roles table is authoritative, but for middleware performance
    // we cache the role in user_metadata during login/role assignment.
    const role: Role = (user.user_metadata?.role as Role) ?? "viewer"
    const rolePerms = new Set<Permission>(ROLE_PERMISSIONS[role])

    if (!rolePerms.has(requiredPermission)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      // Redirect non-admins away from admin pages
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = "/"
      return NextResponse.redirect(homeUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
