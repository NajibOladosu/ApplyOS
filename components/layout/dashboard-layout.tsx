"use client"

import { useState } from "react"
import { Sidebar } from "./sidebar"
import { TopBar } from "./topbar"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - Always visible on md and up */}
      <div className="hidden md:block fixed left-0 top-0 z-40 h-screen w-64">
        <Sidebar />
      </div>

      {/* Mobile/Tablet Sidebar - Drawer modal on smaller screens */}
      <div className="md:hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="md:pl-64">
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
