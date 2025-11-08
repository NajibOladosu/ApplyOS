import { Sidebar } from "./sidebar"
import { TopBar } from "./topbar"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <TopBar />
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
