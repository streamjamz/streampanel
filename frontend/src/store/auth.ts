import { create } from 'zustand'

function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch { return null }
}

interface AuthState {
  accessToken: string | null
  role: string | null
  login: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => {
  const token = localStorage.getItem('access_token')
  const payload = token ? parseJwt(token) : null
  return {
    accessToken: token,
    role: payload?.role ?? null,
    login: (accessToken, refreshToken) => {
      localStorage.setItem('access_token', accessToken)
      localStorage.setItem('refresh_token', refreshToken)
      const payload = parseJwt(accessToken)
      set({ accessToken, role: payload?.role ?? null })
    },
    logout: () => {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ accessToken: null, role: null })
    },
  }
})
