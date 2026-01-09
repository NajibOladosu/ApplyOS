import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import { Login } from './components/Login'
import { AuthManager } from '../lib/auth/auth-manager'
import { APIClient } from '../lib/api/api-client'
import { Loader2, ExternalLink, Settings, LogOut, PlusCircle, FileText, BarChart3 } from 'lucide-react'

function Popup() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)

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
      setStats(data)
    } catch (e) {
      console.error('Failed to load stats', e)
    }
  }

  const handleLogout = async () => {
    await AuthManager.signOut()
    setSession(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <Login onLoginSuccess={checkAuth} />
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ApplyOS</h1>
          <p className="text-xs text-gray-600">{session.user.email}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dashboard */}
      <div className="space-y-4">
        {/* Stats Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Overview</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <span className="text-2xl font-bold text-blue-600">{stats?.totalApplications || 0}</span>
              <p className="text-xs text-blue-600 mt-1">Total Applications</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <span className="text-2xl font-bold text-green-600">{stats?.successRate || 0}%</span>
              <p className="text-xs text-green-600 mt-1">Response Rate</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 transition-all group">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <PlusCircle className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-700">Quick Add</span>
          </button>

          <button className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-purple-300 transition-all group">
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-2 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-700">Documents</span>
          </button>
        </div>

        <button className="w-full flex items-center justify-center p-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
          <BarChart3 className="w-4 h-4 mr-2" />
          Go to Dashboard
          <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
        </button>
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<Popup />)
