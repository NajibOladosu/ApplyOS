import { supabase } from '../api/supabase-client'

export class AuthManager {
    static async signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) throw error
        return data
    }

    static async signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    }

    static async getSession() {
        const { data: { session } } = await supabase.auth.getSession()
        return session
    }

    static async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser()
        return user
    }

    static onAuthStateChange(callback: (event: string, session: any) => void) {
        return supabase.auth.onAuthStateChange(callback)
    }
}
