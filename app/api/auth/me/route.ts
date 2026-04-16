import { getAuthUser } from "@/lib/auth"

/**
 * Returns the current user's info including role and permissions.
 * Used by the client-side navigation to show user state.
 */
export async function GET() {
  const user = await getAuthUser()

  if (!user) {
    return Response.json({ user: null })
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    },
  })
}
