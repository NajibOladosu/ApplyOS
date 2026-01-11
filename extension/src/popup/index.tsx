import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import { Login } from './components/Login'
import { AuthManager } from '../lib/auth/auth-manager'
import { APIClient } from '../lib/api/api-client'
import { Loader2, Settings, LogOut, PlusCircle, LayoutGrid, Briefcase, RefreshCw, ChevronRight } from 'lucide-react'
import { QuickAddTab } from './tabs/QuickAddTab'
import { ApplicationsTab } from './tabs/ApplicationsTab'

function Popup() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'quick-add' | 'applications'>('quick-add')

  useEffect(() => {
    checkAuth()
  }, [])

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

  const handleLogout = async () => {
    await AuthManager.signOut()
    setSession(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return <Login onLoginSuccess={checkAuth} />
  }

  return (
    <div className="bg-background min-h-screen text-foreground font-sans flex flex-col w-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src="icons/icon-48.png" alt="ApplyOS" className="w-7 h-7" />
          <span className="font-bold text-lg font-mono tracking-tight">
            <span className="text-primary">Apply</span>
            <span className="text-foreground">OS</span>
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex p-1 mx-4 mt-4 bg-secondary rounded-lg gap-1 border border-border">
        <button
          onClick={() => setActiveTab('quick-add')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all ${activeTab === 'quick-add'
            ? 'bg-primary text-black shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/20'
            }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Current Job
        </button>
        <button
          onClick={() => setActiveTab('applications')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all ${activeTab === 'applications'
            ? 'bg-primary text-black shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/20'
            }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Applications
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'quick-add' ? (
          <QuickAddTab />
        ) : (
          <ApplicationsTab />
        )}
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<Popup />)
