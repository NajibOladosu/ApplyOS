import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

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
