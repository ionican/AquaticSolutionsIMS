import { redirect } from "next/navigation"
import { UserX } from "lucide-react"
import { SignOutButton } from "@/components/sign-out-button"
import { getAuthenticatedUser, getUserRole } from "@/lib/auth"

// The proxy sends a signed-in user with no recognised role here. Nothing else
// in the app is usable to them, so this page has no navigation.
export default async function NoRolePage() {
  const user = await getAuthenticatedUser()
  if (getUserRole(user)) redirect("/")

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center rounded-lg border border-border bg-card px-6 py-12 text-center">
        <UserX className="h-10 w-10 text-muted-foreground/60" />
        <h1 className="mt-4 text-lg font-semibold text-card-foreground">
          Your account has no role yet — ask an administrator
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user?.email ? `Signed in as ${user.email}. ` : ""}
          An administrator can give you a role from Admin → Users.
        </p>
        <SignOutButton className="mt-6 border border-border" />
      </div>
    </div>
  )
}
