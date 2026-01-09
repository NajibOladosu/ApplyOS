import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'

function Popup() {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">ApplyOS</h1>
        <p className="text-sm text-gray-600">Job Application Manager</p>
      </div>
      
      <div className="space-y-3">
        <div className="card">
          <h2 className="text-lg font-semibold mb-2">Welcome!</h2>
          <p className="text-sm text-gray-600">
            ApplyOS extension is now installed. Visit any job posting to get started with Quick Add.
          </p>
        </div>
        
        <button className="btn-primary w-full">
          Open ApplyOS Dashboard
        </button>
        
        <button className="btn-secondary w-full">
          Settings
        </button>
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<Popup />)
