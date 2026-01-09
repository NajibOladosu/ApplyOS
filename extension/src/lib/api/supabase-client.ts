import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hvmaerptxgeldviarcuj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bWFlcnB0eGdlbGR2aWFyY3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MDU1NDMsImV4cCI6MjA4MjI2NTU0M30.1dKY7vKqmngH8wQBe2ZLslyK_0fyi8J25pEWeWhbmHI'

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: {
            getItem: (key) => {
                return new Promise((resolve) => {
                    chrome.storage.local.get([key], (result) => {
                        resolve(result[key] || null)
                    })
                })
            },
            setItem: (key, value) => {
                return new Promise((resolve) => {
                    chrome.storage.local.set({ [key]: value }, () => {
                        resolve()
                    })
                })
            },
            removeItem: (key) => {
                return new Promise((resolve) => {
                    chrome.storage.local.remove([key], () => {
                        resolve()
                    })
                })
            }
        },
        persistSession: true,
        autoRefreshToken: true
    }
})
