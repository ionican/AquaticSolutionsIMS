"use client"

import { createContext, useContext } from "react"
import { hasPermission, type Permission, type Role } from "@/lib/roles"

// The signed-in user's id and role, read on the server by the root layout.
// Client components use it only to hide controls the role cannot use; the API
// route guards are the actual protection.
interface CurrentUser {
  userId: string | null
  role: Role | null
}

const RoleContext = createContext<CurrentUser>({ userId: null, role: null })

export function RoleProvider({ userId, role, children }: CurrentUser & { children: React.ReactNode }) {
  return <RoleContext.Provider value={{ userId, role }}>{children}</RoleContext.Provider>
}

export function useRole() {
  const { userId, role } = useContext(RoleContext)
  return {
    userId,
    role,
    can: (permission: Permission) => hasPermission(role, permission),
  }
}
