import { useState } from 'react'
import { supabase } from '../supabaseClient'

const ADMIN_PASSWORD = '2026test99'

export default function Admin() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true)
      setError('')
    } else {
      setError('Incorrect password')
    }
  }

  if (!authenticated) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center' }}>
        <h1>Admin Login</h1>
        <input
          type="password"
          placeholder="Enter admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          style={{ padding: '8px', width: '100%', marginBottom: '10px' }}
        />
        <button onClick={handleLogin} style={{ padding: '8px 20px' }}>
          Login
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
      <h1>Admin Panel</h1>
      <p>Welcome! More features coming soon.</p>
    </div>
  )
}