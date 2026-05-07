import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    }),
  ])
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          8_000,
          'auth session load',
        )
        if (!isMounted) return
        setSession(session)
        if (session) await fetchProfile(session.user.id)
        else setIsLoading(false)
      } catch (error) {
        console.error('auth initialization failed', error)
        if (!isMounted) return
        setSession(null)
        setProfile(null)
        setIsLoading(false)
      }
    }

    void initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) void fetchProfile(session.user.id)
      else {
        setProfile(null)
        setIsLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId: string) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 8_000)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .abortSignal(controller.signal)
        .single()

      if (error) console.error('profile fetch failed', error)
      setProfile(data ?? null)
    } catch (error) {
      console.error('profile fetch failed', error)
      setProfile(null)
    } finally {
      window.clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }

  async function signOut() {
    sessionStorage.removeItem('verificationPending')
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
