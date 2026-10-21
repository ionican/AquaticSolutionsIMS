import { RequirePermission } from "@/components/require-permission"

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequirePermission path="/admin/database">{children}</RequirePermission>
}
