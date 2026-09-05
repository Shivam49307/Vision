import { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)
const AUTH_BASE = `${import.meta.env.VITE_API_URL || ''}/api/auth`

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('visionai_token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setLoading(false); return }

    fetch(`${AUTH_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((u) => { setUser(u); setLoading(false) })
      .catch(() => { localStorage.removeItem('visionai_token'); setToken(null); setLoading(false) })
  }, [token])

  const login = (newToken) => {
    localStorage.setItem('visionai_token', newToken)
    setToken(newToken)
  }

  const logout = () => {
    localStorage.removeItem('visionai_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
