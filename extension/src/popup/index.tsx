import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import { Login } from './components/Login'
import { AuthManager } from '../lib/auth/auth-manager'
import { APIClient } from '../lib/api/api-client'
import { Loader2, ExternalLink, Settings, LogOut, PlusCircle, FileText, BarChart3, Briefcase } from 'lucide-react'

// Main Dashboard Component
function Popup() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{ totalApplications: number, successRate: number } | null>(null)

  // App URLs - Update these with production URLs when ready
  const APP_URL = 'https://applyos.io'
  const DASHBOARD_URL = `${APP_URL}/dashboard`
  const DOCUMENTS_URL = `${APP_URL}/documents`

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (session) {
      loadStats()
    }
  }, [session])

  const checkAuth = async () => {
    try {
      const currentSession = await AuthManager.getSession()
      setSession(currentSession)
    } catch (e) {
      console.error('Auth check failed', e)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const data = await APIClient.getAnalytics()
      setStats(data as any)
    } catch (e) {
      console.error('Failed to load stats', e)
      // Fallback stats if API fails (or dummy for demo)
      setStats({ totalApplications: 0, successRate: 0 })
    }
  }

  const handleLogout = async () => {
    await AuthManager.signOut()
    setSession(null)
  }

  const openTab = (url: string) => {
    chrome.tabs.create({ url })
  }

  const handleQuickAdd = () => {
    // Determine context: are we on a job page?
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0]
      if (activeTab?.url && (
        activeTab.url.includes('linkedin.com') ||
        activeTab.url.includes('indeed.com') ||
        activeTab.url.includes('glassdoor.com')
      )) {
        // We are on a supported site. We should tell the user to use the floating button
        // Or inject the script if not present.
        // For now, simpler: Open main app "New Application" page
        openTab(`${APP_URL}/applications/new`)
      } else {
        // Generic page: Open main app
        openTab(`${APP_URL}/applications/new`)
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-primary">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <Login onLoginSuccess={checkAuth} />
  }

  return (
    <div className="p-5 bg-background min-h-screen text-foreground font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-black font-bold text-lg shadow-[0_0_15px_rgba(0,255,136,0.3)]">
            A
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none tracking-tight">ApplyOS</h1>
            <p className="text-[10px] text-muted-foreground leading-none mt-1">Extension v1.0</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dashboard */}
      <div className="space-y-5">
        {/* Stats Card */}
        <div className="glass-effect rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

          <div className="relative z-10 flex justify-between items-start mb-4">
            <h2 className="text-secondary-foreground text-xs font-semibold uppercase tracking-wider">Your Stats</h2>
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>

          <div className="grid grid-cols-2 gap-6 relative z-10">
            <div>
              <span className="text-3xl font-bold text-white tracking-tight">{stats?.totalApplications || 0}</span>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium">Total Applications</p>
            </div>
            <div>
              <span className="text-3xl font-bold text-primary tracking-tight">{stats?.successRate || 0}%</span>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium">Response Rate</p>
            </div>
          </div>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleQuickAdd}
            className="flex flex-col items-center justify-center p-4 bg-card hover:bg-secondary/80 border border-border rounded-xl transition-all group hover:border-primary/50 hover:shadow-[0_0_15px_rgba(0,255,136,0.1)]"
          >
            <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-black transition-colors text-primary border border-border group-hover:border-transparent">
              <PlusCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-foreground">New App</span>
          </button>

          <button
            onClick={() => openTab(DOCUMENTS_URL)}
            className="flex flex-col items-center justify-center p-4 bg-card hover:bg-secondary/80 border border-border rounded-xl transition-all group hover:border-primary/50 hover:shadow-[0_0_15px_rgba(0,255,136,0.1)]"
          >
            <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-500 group-hover:text-white transition-colors text-purple-400 border border-border group-hover:border-transparent">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-foreground">Documents</span>
          </button>
        </div>

        {/* Full Dashboard Link */}
        <button
          onClick={() => openTab(DASHBOARD_URL)}
          className="w-full btn-secondary h-12 text-sm justify-between px-6 group border-border hover:border-primary/50"
        >
          <div className="flex items-center">
            <Briefcase className="w-4 h-4 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
            <span>Open Full Dashboard</span>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<Popup />)
