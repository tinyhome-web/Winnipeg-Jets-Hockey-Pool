import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const ADMIN_PASSWORD = '2026test99'

export default function Admin() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [message, setMessage] = useState('')
  const [games, setGames] = useState([])
  const [importMessage, setImportMessage] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (authenticated) {
      fetchUsers()
      fetchGames()
    }
  }, [authenticated])

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('users').select('*').order('name')
    if (!error) setUsers(data)
  }

  const fetchGames = async () => {
    const { data, error } = await supabase.from('games').select('*').order('game_date')
    if (!error) setGames(data)
  }

  const addUser = async () => {
    if (!newName || !newEmail) return setMessage('Please enter both name and email')
    const { error } = await supabase.from('users').insert([{ name: newName, email: newEmail }])
    if (error) return setMessage('Error: ' + error.message)
    setMessage('Participant added!')
    setNewName('')
    setNewEmail('')
    fetchUsers()
  }

  const deleteUser = async (id) => {
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (!error) fetchUsers()
  }

  const importSchedule = async () => {
    setImporting(true)
    setImportMessage('Importing schedule...')
    try {
      const res = await fetch('https://corsproxy.io/?https://api-web.nhle.com/v1/club-schedule-season/WPG/20252026')
      const data = await res.json()
      const games = (data.games || []).filter(game => game.gameType === 2)

      let added = 0
      let skipped = 0

      for (const game of games) {
        const isHome = game.homeTeam.abbrev === 'WPG'
        const opponent = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev
        const gameDate = game.gameDate

        const { error } = await supabase.from('games').upsert([{
          nhl_game_id: String(game.id),
          game_date: gameDate,
          opponent: opponent,
          is_home: isHome,
          status: 'upcoming'
        }], { onConflict: 'nhl_game_id' })

        if (error) skipped++
        else added++
      }

      setImportMessage(`Done! ${added} games imported, ${skipped} skipped.`)
      fetchGames()
    } catch (err) {
      setImportMessage('Error importing schedule: ' + err.message)
    }
    setImporting(false)
  }

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
        <button onClick={handleLogin} style={{ padding: '8px 20px' }}>Login</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '0 20px' }}>
      <h1>Admin Panel</h1>

      {/* Participants Section */}
      <h2>Participants</h2>
      <div style={{ marginBottom: '20px' }}>
        <input
          placeholder="Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ padding: '8px', marginRight: '10px' }}
        />
        <input
          placeholder="Email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          style={{ padding: '8px', marginRight: '10px' }}
        />
        <button onClick={addUser} style={{ padding: '8px 20px' }}>Add Participant</button>
        {message && <p style={{ color: 'green' }}>{message}</p>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Email</th>
            <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{user.name}</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{user.email}</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                <button onClick={() => deleteUser(user.id)} style={{ color: 'red' }}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Schedule Section */}
      <h2>Jets Schedule</h2>
      <button
        onClick={importSchedule}
        disabled={importing}
        style={{ padding: '10px 20px', marginBottom: '10px', backgroundColor: '#003087', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        {importing ? 'Importing...' : 'Import Jets Schedule from NHL API'}
      </button>
      {importMessage && <p>{importMessage}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Date</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Opponent</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Home/Away</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {games.map(game => (
            <tr key={game.id}>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{game.game_date}</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{game.opponent}</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{game.is_home ? 'Home' : 'Away'}</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{game.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}