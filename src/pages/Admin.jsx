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
  const [upcomingGames, setUpcomingGames] = useState([])
  const [importMessage, setImportMessage] = useState('')
  const [importing, setImporting] = useState(false)
  const [selectedGame, setSelectedGame] = useState(null)
  const [pickingOrder, setPickingOrder] = useState([])
  const [picks, setPicks] = useState({})
  const [predictedWinners, setPredictedWinners] = useState({})
  const [players, setPlayers] = useState([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [picksMessage, setPicksMessage] = useState('')
  const [activeTab, setActiveTab] = useState('participants')

  useEffect(() => {
    if (authenticated) {
      fetchUsers()
      fetchGames()
    }
  }, [authenticated])

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('name')
    if (data) setUsers(data)
  }

  const fetchGames = async () => {
    const { data } = await supabase.from('games').select('*').order('game_date')
    if (data) {
      setGames(data)
      setUpcomingGames(data.filter(g => g.status === 'upcoming'))
    }
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
    await supabase.from('users').delete().eq('id', id)
    fetchUsers()
  }

  const importSchedule = async () => {
    setImporting(true)
    setImportMessage('Importing schedule...')
    try {
      const res = await fetch('https://corsproxy.io/?https://api-web.nhle.com/v1/club-schedule-season/WPG/20252026')
      const data = await res.json()
      const games = (data.games || []).filter(game => game.gameType === 2)
      let added = 0, skipped = 0
      for (const game of games) {
        const isHome = game.homeTeam.abbrev === 'WPG'
        const opponent = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev
        const { error } = await supabase.from('games').upsert([{
          nhl_game_id: String(game.id),
          game_date: game.gameDate,
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

  const fetchRosterForGame = async (game) => {
    setLoadingPlayers(true)
    setPlayers([])
    try {
      // Fetch both rosters
      const [jetsRes, oppRes] = await Promise.all([
        fetch(`https://corsproxy.io/?https://api-web.nhle.com/v1/roster/WPG/20252026`),
        fetch(`https://corsproxy.io/?https://api-web.nhle.com/v1/roster/${game.opponent}/20252026`)
      ])
      const jetsData = await jetsRes.json()
      console.log('Jets data:', jetsData)
      const oppData = await oppRes.json()

      const extractPlayers = (data, team) => {
  const skaters = [
    ...(data.forwards || []),
    ...(data.defensemen || [])
  ]
  const goalies = data.goalies || []
  
  const skaterList = skaters.map(p => ({
    nhl_player_id: String(p.id),
    name: `${p.firstName.default} ${p.lastName.default}`,
    team: team,
    is_goalie: false
  }))

  const goalieList = goalies.map(p => ({
    nhl_player_id: String(p.id),
    name: `${p.firstName.default} ${p.lastName.default}`,
    team: team,
    is_goalie: true
  }))

  return [...skaterList, ...goalieList]
}

      const allPlayers = [
        ...extractPlayers(jetsData, 'WPG'),
        ...extractPlayers(oppData, game.opponent)
      ]

      // Upsert players into DB
      for (const player of allPlayers) {
        await supabase.from('players').upsert([player], { onConflict: 'nhl_player_id' })
      }

      // Add goalie options
      const goaliePlayers = [
        { id: `goalie-WPG`, name: 'Jets Goalies', team: 'WPG', is_goalie: true },
        { id: `goalie-${game.opponent}`, name: `${game.opponent} Goalies`, team: game.opponent, is_goalie: true }
      ]

      const { data: dbPlayers } = await supabase
        .from('players')
        .select('*')
        .in('team', ['WPG', game.opponent])

      setPlayers([...goaliePlayers, ...(dbPlayers || []).filter(p => !p.is_goalie)])
    } catch (err) {
      setPicksMessage('Error loading roster: ' + err.message)
    }
    setLoadingPlayers(false)
  }

  const selectGame = async (game) => {
    setSelectedGame(game)
    setPicksMessage('')
    setPicks({})
    setPredictedWinners({})

    // Load existing picks if they exist
    const { data: existingPicks } = await supabase
    .from('picks')
    .select('*, players(id, name, team, is_goalie)')
    .eq('game_id', game.id)
    console.log('Game ID:', game.id)
    console.log('Existing picks:', existingPicks)

    if (existingPicks && existingPicks.length > 0) {
    const existingPicksMap = {}
    const existingWinnersMap = {}
    for (const pick of existingPicks) {
    existingPicksMap[pick.user_id] = pick.player_id || ''
    existingWinnersMap[pick.user_id] = pick.predicted_winner || ''
    }
    setPicks(existingPicksMap)
    setPredictedWinners(existingWinnersMap)
    }

    // Check if picking order already exists
    const { data: existingOrder } = await supabase
      .from('picking_order')
      .select('*, users(name)')
      .eq('game_id', game.id)
      .order('pick_position')

    if (existingOrder && existingOrder.length > 0) {
  setPickingOrder(existingOrder.map(o => ({ id: o.user_id, name: o.users.name, position: o.pick_position })))
} else {
  // Only randomize if no picks exist yet for this game
  const { data: existingPicksCheck } = await supabase
    .from('picks')
    .select('id')
    .eq('game_id', game.id)
    .limit(1)

  if (!existingPicksCheck || existingPicksCheck.length === 0) {
    const shuffled = [...users].sort(() => Math.random() - 0.5)
    setPickingOrder(shuffled.map((u, i) => ({ ...u, position: i + 1 })))
  }
}

    await fetchRosterForGame(game)
  }

  const savePickingOrder = async () => {
    if (!selectedGame) return
    // Delete existing order for this game
    await supabase.from('picking_order').delete().eq('game_id', selectedGame.id)
    // Insert new order
    for (const user of pickingOrder) {
      await supabase.from('picking_order').insert([{
        game_id: selectedGame.id,
        user_id: user.id,
        pick_position: user.position
      }])
    }
    setPicksMessage('Picking order saved!')
  }

  const submitPicks = async () => {
  if (!selectedGame) return

  // Check for duplicate picks
const selectedPlayers = Object.values(picks).filter(p => p !== '')
const uniquePlayers = new Set(selectedPlayers)
if (selectedPlayers.length !== uniquePlayers.size) {
  return setPicksMessage('Error: Two or more participants have the same player selected. Please fix before submitting.')
}

// Check back-to-back rule
const { data: previousGame } = await supabase
  .from('games')
  .select('id')
  .lt('game_date', selectedGame.game_date)
  .order('game_date', { ascending: false })
  .limit(1)
  .single()

if (previousGame) {
  const { data: previousPicks } = await supabase
    .from('picks')
    .select('player_id')
    .eq('game_id', previousGame.id)

  const previousPlayerIds = new Set((previousPicks || []).map(p => p.player_id).filter(Boolean))

  for (const user of pickingOrder) {
  const isWildcard = user.id === pickingOrder[pickingOrder.length - 1].id
  if (isWildcard) continue
  const playerId = picks[user.id]
  if (!playerId) continue

  // Check if THIS specific user picked this same player last game
  const { data: previousUserPick } = await supabase
    .from('picks')
    .select('player_id')
    .eq('game_id', previousGame.id)
    .eq('user_id', user.id)
    .single()

  if (previousUserPick && previousUserPick.player_id === playerId) {
    const playerName = players.find(p => p.id === playerId)?.name || 'A player'
    return setPicksMessage(`Error: ${user.name} picked ${playerName} last game and cannot pick them again in back-to-back games.`)
  }
}
}
// Auto-save picking order
await supabase.from('picking_order').delete().eq('game_id', selectedGame.id)
for (const user of pickingOrder) {
  await supabase.from('picking_order').insert([{
    game_id: selectedGame.id,
    user_id: user.id,
    pick_position: user.position
  }])
}
  setPicksMessage('Saving picks...')

    // Delete existing picks for this game
    await supabase.from('picks').delete().eq('game_id', selectedGame.id)

    const lastPicker = pickingOrder[pickingOrder.length - 1]

    for (const user of pickingOrder) {
      const isWildcard = user.id === lastPicker.id
      const playerId = picks[user.id]
      const predictedWinner = predictedWinners[user.id]

      if (!predictedWinner) {
        return setPicksMessage(`Please select a predicted winner for ${user.name}`)
      }

      if (!isWildcard && !playerId) {
        return setPicksMessage(`Please select a player for ${user.name}`)
      }

      // Get player DB id if not wildcard
      let playerDbId = null
      if (!isWildcard && playerId) {
        if (playerId.startsWith('goalie-')) {
          // Find or create goalie entry
          const team = playerId.replace('goalie-', '')
          const { data: goalieData } = await supabase
            .from('players')
            .select('id')
            .eq('team', team)
            .eq('is_goalie', true)
            .limit(1)
          if (goalieData && goalieData.length > 0) playerDbId = goalieData[0].id
        } else {
          playerDbId = playerId
        }
      }

      await supabase.from('picks').insert([{
        game_id: selectedGame.id,
        user_id: user.id,
        player_id: playerDbId,
        is_wildcard: isWildcard,
        predicted_winner: predictedWinner,
        points_earned: 0
      }])
    }

    setPicksMessage('All picks saved successfully!')
  }

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true)
      setError('')
    } else {
      setError('Incorrect password')
    }
  }

  const tabStyle = (tab) => ({
    padding: '10px 20px',
    marginRight: '5px',
    cursor: 'pointer',
    backgroundColor: activeTab === tab ? '#003087' : '#eee',
    color: activeTab === tab ? 'white' : 'black',
    border: 'none',
    borderRadius: '4px 4px 0 0'
  })

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
    <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 20px' }}>
      <h1>⚙️ Admin Panel</h1>

      <div style={{ marginBottom: '0' }}>
        <button style={tabStyle('participants')} onClick={() => setActiveTab('participants')}>Participants</button>
        <button style={tabStyle('schedule')} onClick={() => setActiveTab('schedule')}>Schedule</button>
        <button style={tabStyle('picks')} onClick={() => setActiveTab('picks')}>Enter Picks</button>
      </div>

      <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '0 4px 4px 4px' }}>

        {/* PARTICIPANTS TAB */}
        {activeTab === 'participants' && (
          <div>
            <h2>Participants</h2>
            <div style={{ marginBottom: '20px' }}>
              <input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ padding: '8px', marginRight: '10px' }} />
              <input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ padding: '8px', marginRight: '10px' }} />
              <button onClick={addUser} style={{ padding: '8px 20px' }}>Add Participant</button>
              {message && <p style={{ color: 'green' }}>{message}</p>}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <div>
            <h2>Jets Schedule</h2>
            <button onClick={importSchedule} disabled={importing} style={{ padding: '10px 20px', marginBottom: '10px', backgroundColor: '#003087', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
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
        )}

        {/* PICKS TAB */}
        {activeTab === 'picks' && (
          <div>
            <h2>Enter Picks</h2>
            <div style={{ marginBottom: '20px' }}>
              <label><strong>Select Game:</strong></label>
              <select
                onChange={(e) => {
                  const game = upcomingGames.find(g => g.id === e.target.value)
                  if (game) selectGame(game)
                }}
                style={{ marginLeft: '10px', padding: '8px' }}
              >
                <option value="">-- Select a game --</option>
                {upcomingGames.map(game => (
                  <option key={game.id} value={game.id}>
                    {game.game_date} vs {game.opponent} ({game.is_home ? 'Home' : 'Away'})
                  </option>
                ))}
              </select>
            </div>

            {selectedGame && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Picking Order</h3>
                  <button onClick={savePickingOrder} style={{ padding: '6px 14px', backgroundColor: '#003087', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Save Order
                  </button>
                </div>
                <p style={{ color: '#666', fontSize: '14px' }}>Drag to reorder if needed, then click Save Order before entering picks.</p>

                {loadingPlayers ? (
                  <p>Loading roster...</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Position</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Participant</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Pick</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Predicted Winner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pickingOrder.map((user, index) => {
                        const isWildcard = index === pickingOrder.length - 1
                        return (
                          <tr key={user.id} style={{ backgroundColor: isWildcard ? '#fff8e1' : 'white' }}>
                            <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{index + 1}{isWildcard ? ' 🃏' : ''}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{user.name}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                              {isWildcard ? (
                                <em style={{ color: '#888' }}>Auto (best unpicked Jets player)</em>
                              ) : (
                                <select
                                  value={picks[user.id] || ''}
                                  onChange={(e) => setPicks({ ...picks, [user.id]: e.target.value })}
                                  style={{ padding: '6px', width: '100%' }}
                                >
                                  <option value="">-- Select player --</option>
                                  <optgroup label="🥅 Goalies">
                                    {players.filter(p => p.is_goalie).map(p => (
                                      <option key={p.id} value={p.id}>{p.name} ({p.team})</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="WPG Skaters">
                                    {players.filter(p => !p.is_goalie && p.team === 'WPG').map(p => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label={`${selectedGame.opponent} Skaters`}>
                                    {players.filter(p => !p.is_goalie && p.team === selectedGame.opponent).map(p => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </optgroup>
                                </select>
                              )}
                            </td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                              <select
                                value={predictedWinners[user.id] || ''}
                                onChange={(e) => setPredictedWinners({ ...predictedWinners, [user.id]: e.target.value })}
                                style={{ padding: '6px' }}
                              >
                                <option value="">-- Pick winner --</option>
                                <option value="WPG">WPG (Jets)</option>
                                <option value={selectedGame.opponent}>{selectedGame.opponent}</option>
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}

                <div style={{ marginTop: '20px' }}>
                  <button onClick={submitPicks} style={{ padding: '10px 24px', backgroundColor: '#1a7a1a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>
                    Submit All Picks
                  </button>
                  {picksMessage && <p style={{ color: picksMessage.includes('Error') || picksMessage.includes('Please') ? 'red' : 'green' }}>{picksMessage}</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}