import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const ADMIN_PASSWORD = '2026test99'

export default function Admin() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState('')

  // Participants
  const [users, setUsers] = useState([])
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [participantMsg, setParticipantMsg] = useState('')

  // Schedule
  const [games, setGames] = useState([])
  const [importMessage, setImportMessage] = useState('')
  const [importing, setImporting] = useState(false)

  // Picks
  const [upcomingGames, setUpcomingGames] = useState([])
  const [selectedGame, setSelectedGame] = useState(null)
  const [pickingOrder, setPickingOrder] = useState([])
  const [picks, setPicks] = useState({})
  const [predictedWinners, setPredictedWinners] = useState({})
  const [players, setPlayers] = useState([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [picksMessage, setPicksMessage] = useState('')

  // Calculate
  const [allGames, setAllGames] = useState([])
  const [selectedCalcGame, setSelectedCalcGame] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [calcMessage, setCalcMessage] = useState('')
  const [calcResults, setCalcResults] = useState([])

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
      setAllGames(data)
    }
  }

  const addUser = async () => {
    if (!newName || !newEmail) return setParticipantMsg('Please enter both name and email')
    const { error } = await supabase.from('users').insert([{ name: newName, email: newEmail }])
    if (error) return setParticipantMsg('Error: ' + error.message)
    setParticipantMsg('Participant added!')
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
    setImportMessage('Importing...')
    try {
      const res = await fetch('/api/schedule')
      const data = await res.json()
      const games = (data.games || []).filter(game => game.gameType === 2)
      let added = 0, skipped = 0
      for (const game of games) {
        const isHome = game.homeTeam.abbrev === 'WPG'
        const opponent = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev
        const { error } = await supabase.from('games').upsert([{
          nhl_game_id: String(game.id),
          game_date: game.gameDate,
          opponent,
          is_home: isHome,
          status: 'upcoming'
        }], { onConflict: 'nhl_game_id' })
        if (error) skipped++
        else added++
      }
      setImportMessage(`Done! ${added} imported, ${skipped} skipped.`)
      fetchGames()
    } catch (err) {
      setImportMessage('Error: ' + err.message)
    }
    setImporting(false)
  }

  const fetchRosterForGame = async (game) => {
    setLoadingPlayers(true)
    setPlayers([])
    try {
      const [jetsRes, oppRes] = await Promise.all([
        fetch(`/api/roster?team=WPG`),
        fetch(`/api/roster?team=${game.opponent}`)
      ])
      const jetsData = await jetsRes.json()
      const oppData = await oppRes.json()

      const extractPlayers = (data, team) => {
        const skaters = [...(data.forwards || []), ...(data.defensemen || [])]
        const goalies = data.goalies || []
        return [
          ...skaters.map(p => ({ nhl_player_id: String(p.id), name: `${p.firstName.default} ${p.lastName.default}`, team, is_goalie: false })),
          ...goalies.map(p => ({ nhl_player_id: String(p.id), name: `${p.firstName.default} ${p.lastName.default}`, team, is_goalie: true }))
        ]
      }

      const allPlayers = [...extractPlayers(jetsData, 'WPG'), ...extractPlayers(oppData, game.opponent)]
      for (const player of allPlayers) {
        await supabase.from('players').upsert([player], { onConflict: 'nhl_player_id' })
      }

      const goaliePlayers = [
        { id: `goalie-WPG`, name: 'Jets Goalies', team: 'WPG', is_goalie: true },
        { id: `goalie-${game.opponent}`, name: `${game.opponent} Goalies`, team: game.opponent, is_goalie: true }
      ]

      const { data: dbPlayers } = await supabase.from('players').select('*').in('team', ['WPG', game.opponent])
      setPlayers([...goaliePlayers, ...(dbPlayers || []).filter(p => !p.is_goalie)])
    } catch (err) {
      setPicksMessage('Error loading roster: ' + err.message)
    }
    setLoadingPlayers(false)
  }

  const generatePickingOrder = async () => {
    if (!selectedGame) return
    const { data: previousGame } = await supabase
      .from('games').select('id, game_date').lt('game_date', selectedGame.game_date)
      .eq('status', 'final').order('game_date', { ascending: false }).limit(1).single()

    if (!previousGame) {
      const shuffled = [...users].sort(() => Math.random() - 0.5)
      setPickingOrder(shuffled.map((u, i) => ({ ...u, position: i + 1 })))
      setPicksMessage('No previous game — order randomized.')
      return
    }

    const prevDate = new Date(new Date(previousGame.game_date + 'T12:00:00').toLocaleString('en-US', { timeZone: 'America/Winnipeg' }))
    const currDate = new Date(new Date(selectedGame.game_date + 'T12:00:00').toLocaleString('en-US', { timeZone: 'America/Winnipeg' }))
    const isFriday = prevDate.getDay() === 5
    const isWeekend = currDate.getDay() === 0 || currDate.getDay() === 6

    if (isFriday && isWeekend) {
      const shuffled = [...users].sort(() => Math.random() - 0.5)
      setPickingOrder(shuffled.map((u, i) => ({ ...u, position: i + 1 })))
      setPicksMessage('Weekend game after Friday — order randomized.')
      return
    }

    const { data: previousPicks } = await supabase
      .from('picks').select('user_id, points_earned, users(name)').eq('game_id', previousGame.id)

    if (!previousPicks || previousPicks.length === 0) {
      const shuffled = [...users].sort(() => Math.random() - 0.5)
      setPickingOrder(shuffled.map((u, i) => ({ ...u, position: i + 1 })))
      setPicksMessage('No previous points — order randomized.')
      return
    }

    const sorted = [...previousPicks].sort((a, b) => {
      if (b.points_earned !== a.points_earned) return b.points_earned - a.points_earned
      return Math.random() - 0.5
    })
    setPickingOrder(sorted.map((p, i) => ({ id: p.user_id, name: p.users?.name, position: i + 1 })))
    setPicksMessage('Order generated from last game!')
  }

  const selectGame = async (game) => {
    setSelectedGame(game)
    setPicksMessage('')
    setPicks({})
    setPredictedWinners({})

    const { data: existingOrder } = await supabase
      .from('picking_order').select('*, users(name)').eq('game_id', game.id).order('pick_position')

    if (existingOrder && existingOrder.length > 0) {
      setPickingOrder(existingOrder.map(o => ({ id: o.user_id, name: o.users.name, position: o.pick_position })))
    } else {
      const { data: existingPicksCheck } = await supabase.from('picks').select('id').eq('game_id', game.id).limit(1)
      if (!existingPicksCheck || existingPicksCheck.length === 0) {
        const shuffled = [...users].sort(() => Math.random() - 0.5)
        setPickingOrder(shuffled.map((u, i) => ({ ...u, position: i + 1 })))
      }
    }

    const { data: existingPicks } = await supabase
      .from('picks').select('*, players(id, name, team, is_goalie)').eq('game_id', game.id)

    if (existingPicks && existingPicks.length > 0) {
      const picksMap = {}
      const winnersMap = {}
      for (const pick of existingPicks) {
        if (pick.player_id) {
          const { data: playerData } = await supabase.from('players').select('is_goalie, team').eq('id', pick.player_id).limit(1)
          picksMap[pick.user_id] = playerData?.[0]?.is_goalie ? `goalie-${playerData[0].team}` : pick.player_id
        } else {
          picksMap[pick.user_id] = ''
        }
        winnersMap[pick.user_id] = pick.predicted_winner || ''
      }
      setPicks(picksMap)
      setPredictedWinners(winnersMap)
    }

    await fetchRosterForGame(game)
  }

  const submitPicks = async () => {
    if (!selectedGame) return

    const selectedPlayers = Object.values(picks).filter(p => p !== '')
    const uniquePlayers = new Set(selectedPlayers)
    if (selectedPlayers.length !== uniquePlayers.size) {
      return setPicksMessage('Error: Duplicate picks detected!')
    }

    const { data: previousGame } = await supabase
      .from('games').select('id').lt('game_date', selectedGame.game_date)
      .eq('status', 'final').order('game_date', { ascending: false }).limit(1).single()

    if (previousGame) {
      for (const user of pickingOrder) {
        const isWildcard = user.id === pickingOrder[pickingOrder.length - 1].id
        if (isWildcard) continue
        const playerId = picks[user.id]
        if (!playerId) continue
        const { data: previousUserPickData } = await supabase
          .from('picks').select('player_id').eq('game_id', previousGame.id).eq('user_id', user.id).limit(1)
        const previousUserPick = previousUserPickData?.[0]
        if (previousUserPick && previousUserPick.player_id === playerId) {
          const playerName = players.find(p => p.id === playerId)?.name || 'A player'
          return setPicksMessage(`Error: ${user.name} picked ${playerName} last game — can't pick back-to-back.`)
        }
      }
    }

    // Auto-save picking order
    await supabase.from('picking_order').delete().eq('game_id', selectedGame.id)
    for (const user of pickingOrder) {
      await supabase.from('picking_order').insert([{ game_id: selectedGame.id, user_id: user.id, pick_position: user.position }])
    }

    setPicksMessage('Saving picks...')
    await supabase.from('picks').delete().eq('game_id', selectedGame.id)

    const lastPicker = pickingOrder[pickingOrder.length - 1]
    for (const user of pickingOrder) {
      const isWildcard = user.id === lastPicker.id
      const playerId = picks[user.id]
      const predictedWinner = predictedWinners[user.id]
      if (!predictedWinner) return setPicksMessage(`Please select a predicted winner for ${user.name}`)
      if (!isWildcard && !playerId) return setPicksMessage(`Please select a player for ${user.name}`)

      let playerDbId = null
      if (!isWildcard && playerId) {
        if (playerId.startsWith('goalie-')) {
          const team = playerId.replace('goalie-', '')
          const { data: goalieData } = await supabase.from('players').select('id').eq('team', team).eq('is_goalie', true).limit(1)
          if (goalieData?.length > 0) playerDbId = goalieData[0].id
        } else {
          playerDbId = playerId
        }
      }

      await supabase.from('picks').insert([{
        game_id: selectedGame.id, user_id: user.id, player_id: playerDbId,
        is_wildcard: isWildcard, predicted_winner: predictedWinner, points_earned: 0
      }])
    }
    setPicksMessage('All picks saved!')
  }

  const calculatePoints = async (game) => {
    setCalculating(true)
    setCalcMessage('Fetching game data...')
    setCalcResults([])
    try {
      const [pbpRes, boxRes] = await Promise.all([
        fetch(`/api/playbyplay?gameId=${game.nhl_game_id}`),
        fetch(`/api/boxscore?gameId=${game.nhl_game_id}`)
      ])
      const pbpData = await pbpRes.json()
      const boxData = await boxRes.json()

      const gameState = pbpData.gameState
      if (gameState !== 'OFF' && gameState !== 'FINAL') {
        setCalcMessage(`Game not finished yet. State: ${gameState}`)
        setCalculating(false)
        return
      }

      const plays = pbpData.plays || []
      const goalPlays = plays.filter(p => p.typeDescKey === 'goal')
      const jetsTeamId = pbpData.homeTeam?.abbrev === 'WPG' ? pbpData.homeTeam?.id : pbpData.awayTeam?.id
      const oppTeamId = pbpData.homeTeam?.abbrev === 'WPG' ? pbpData.awayTeam?.id : pbpData.homeTeam?.id
      const firstJetsGoalScorerId = goalPlays.find(p => p.details?.eventOwnerTeamId === jetsTeamId)?.details?.scoringPlayerId
      const firstOppGoalScorerId = goalPlays.find(p => p.details?.eventOwnerTeamId === oppTeamId)?.details?.scoringPlayerId

      const playerStatsMap = {}
      for (const play of goalPlays) {
        const d = play.details
        if (!d) continue
        if (d.scoringPlayerId) {
          if (!playerStatsMap[d.scoringPlayerId]) playerStatsMap[d.scoringPlayerId] = { goals: 0, assists: 0 }
          playerStatsMap[d.scoringPlayerId].goals++
        }
        if (d.assist1PlayerId) {
          if (!playerStatsMap[d.assist1PlayerId]) playerStatsMap[d.assist1PlayerId] = { goals: 0, assists: 0 }
          playerStatsMap[d.assist1PlayerId].assists++
        }
        if (d.assist2PlayerId) {
          if (!playerStatsMap[d.assist2PlayerId]) playerStatsMap[d.assist2PlayerId] = { goals: 0, assists: 0 }
          playerStatsMap[d.assist2PlayerId].assists++
        }
      }

      const jetsIsHome = pbpData.homeTeam?.abbrev === 'WPG'
      const jetsGoalies = jetsIsHome ? boxData.playerByGameStats?.homeTeam?.goalies : boxData.playerByGameStats?.awayTeam?.goalies
      const oppGoalies = jetsIsHome ? boxData.playerByGameStats?.awayTeam?.goalies : boxData.playerByGameStats?.homeTeam?.goalies
      const jetsStartingGoalie = (jetsGoalies || []).find(g => g.starter) || jetsGoalies?.[0]
      const oppStartingGoalie = (oppGoalies || []).find(g => g.starter) || oppGoalies?.[0]
      const jetsGoalsAgainst = jetsStartingGoalie?.goalsAgainst ?? 0
      const oppGoalsAgainst = oppStartingGoalie?.goalsAgainst ?? 0
      const calcGoaliePoints = (ga) => ga === 0 ? 6 : Math.max(0, 3 - ga)
      const jetsGoaliePoints = calcGoaliePoints(jetsGoalsAgainst)
      const oppGoaliePoints = calcGoaliePoints(oppGoalsAgainst)

      const jetsScore = jetsIsHome ? boxData.homeTeam?.score : boxData.awayTeam?.score
      const oppScore = jetsIsHome ? boxData.awayTeam?.score : boxData.homeTeam?.score
      const winner = jetsScore > oppScore ? 'WPG' : game.opponent

      await supabase.from('games').update({ status: 'final', jets_score: jetsScore, opponent_score: oppScore, winning_team: winner }).eq('id', game.id)

      const { data: gamePicks } = await supabase.from('picks').select('*, users(name)').eq('game_id', game.id)
      if (!gamePicks || gamePicks.length === 0) {
        setCalcMessage('No picks found.')
        setCalculating(false)
        return
      }

      const wildcardPick = gamePicks.find(p => p.is_wildcard)
      const nonWildcardPicks = gamePicks.filter(p => !p.is_wildcard)
      const pickedPlayerIds = new Set(nonWildcardPicks.map(p => p.player_id).filter(Boolean))

      let wildcardPlayerPoints = 0
      const { data: jetsPlayers } = await supabase.from('players').select('*').eq('team', 'WPG').eq('is_goalie', false)
      for (const player of (jetsPlayers || [])) {
        if (pickedPlayerIds.has(player.id)) continue
        const nhlId = parseInt(player.nhl_player_id)
        const stats = playerStatsMap[nhlId]
        if (!stats) continue
        let pts = stats.goals + stats.assists
        if (nhlId === firstJetsGoalScorerId) pts += 4
        if (pts > wildcardPlayerPoints) wildcardPlayerPoints = pts
      }

      const results = []
      for (const pick of gamePicks) {
        let points = 0
        let breakdown = []
        let playerData = null

        if (pick.predicted_winner === winner) { points += 2; breakdown.push('Correct winner: +2') }

        if (pick.is_wildcard) {
          points += wildcardPlayerPoints
          if (wildcardPlayerPoints > 0) breakdown.push(`Wildcard: +${wildcardPlayerPoints}`)
        } else if (pick.player_id) {
          const { data: fetched } = await supabase.from('players').select('*').eq('id', pick.player_id).single()
          playerData = fetched
          if (playerData?.is_goalie) {
            const goaliePoints = playerData.team === 'WPG' ? jetsGoaliePoints : oppGoaliePoints
            points += goaliePoints
            breakdown.push(`Goalie: +${goaliePoints}`)
          } else {
            const nhlId = parseInt(playerData?.nhl_player_id)
            const stats = playerStatsMap[nhlId]
            if (stats) {
              let pp = stats.goals + stats.assists
              if (nhlId === firstJetsGoalScorerId) pp += 4
              if (nhlId === firstOppGoalScorerId) pp += 4
              points += pp
              if (stats.goals > 0) breakdown.push(`Goals: +${stats.goals}`)
              if (stats.assists > 0) breakdown.push(`Assists: +${stats.assists}`)
              if (nhlId === firstJetsGoalScorerId || nhlId === firstOppGoalScorerId) breakdown.push('First goal: +4')
            }
          }
        }

        await supabase.from('picks').update({ points_earned: points }).eq('id', pick.id)

        const { data: currentStanding } = await supabase.from('season_participants').select('total_points').eq('user_id', pick.user_id).single()
        const currentPoints = currentStanding?.total_points || 0
        await supabase.from('season_participants').update({ total_points: currentPoints + points }).eq('user_id', pick.user_id)

        results.push({
          name: pick.users?.name,
          points,
          breakdown: breakdown.join(', ') || 'No points',
          isWildcard: pick.is_wildcard,
          playerName: pick.is_wildcard ? 'Wildcard' : (playerData?.is_goalie ? `${playerData.team} Goalies` : playerData?.name || '—'),
          predictedWinner: pick.predicted_winner
        })
      }

      results.sort((a, b) => b.points - a.points)
      setCalcResults(results)
      setCalcMessage('Points calculated!')
      fetchGames()
    } catch (err) {
      setCalcMessage('Error: ' + err.message)
    }
    setCalculating(false)
  }

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) { setAuthenticated(true); setError('') }
    else setError('Incorrect password')
  }

  if (!authenticated) return (
    <div style={a.loginPage}>
      <div style={a.loginBox}>
        <h1 style={a.loginTitle}>⚙️ ADMIN</h1>
        <p style={a.loginSub}>Jets Hockey Pool</p>
        <input type="password" placeholder="Enter password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={a.loginInput} />
        <button onClick={handleLogin} style={a.loginBtn}>Login</button>
        {error && <p style={{ color: '#AD0E28', marginTop: '10px', fontSize: '14px' }}>{error}</p>}
      </div>
    </div>
  )

  return (
    <div style={a.page}>
      <div style={a.bgPattern} />
<div style={{ position: 'fixed', inset: 0, zIndex: 0, backgroundImage: 'radial-gradient(ellipse at 50% 50%, rgba(1,24,63,0.72) 0%, rgba(1,24,63,0.85) 100%)', pointerEvents: 'none' }} />
      <header style={a.header}>
        <h1 style={a.headerTitle}>⚙️ ADMIN PANEL</h1>
        <a href="/" style={a.backLink}>← Public Dashboard</a>
      </header>

      <main style={a.main}>

        {/* COL 1 — Participants */}
        <div style={a.col}>
          <div style={a.colHeader}>👥 PARTICIPANTS</div>
          <div style={a.addForm}>
            <input placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} style={a.input} />
            <input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={a.input} />
            <button onClick={addUser} style={a.btnPrimary}>Add</button>
            {participantMsg && <p style={a.msg}>{participantMsg}</p>}
          </div>
          <div style={a.participantList}>
            {users.map((u, i) => (
              <div key={u.id} style={a.participantRow}>
                <span style={a.participantNum}>{i + 1}</span>
                <div style={a.participantInfo}>
                  <div style={a.participantName}>{u.name}</div>
                  <div style={a.participantEmail}>{u.email}</div>
                </div>
                <button onClick={() => deleteUser(u.id)} style={a.btnDelete}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* COL 2 — Schedule */}
        <div style={a.col}>
          <div style={a.colHeader}>📅 SCHEDULE</div>
          <button onClick={importSchedule} disabled={importing} style={a.btnPrimary}>
            {importing ? 'Importing...' : 'Import from NHL API'}
          </button>
          {importMessage && <p style={a.msg}>{importMessage}</p>}
          <div style={a.scheduleList}>
            {games.map(g => (
              <div key={g.id} style={{ ...a.scheduleRow, opacity: g.status === 'final' ? 0.5 : 1 }}>
                <div style={a.scheduleDate}>{g.game_date}</div>
                <div style={a.scheduleOpp}>vs {g.opponent}</div>
                <div style={a.scheduleHome}>{g.is_home ? 'H' : 'A'}</div>
                <div style={{ ...a.scheduleStatus, color: g.status === 'final' ? '#545559' : '#7db8f7' }}>
                  {g.jets_score !== null && g.opponent_score !== null ? `${g.jets_score}-${g.opponent_score}` : <span style={{ color: '#fff' }}>—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COL 3 — Enter Picks */}
        <div style={{ ...a.col, ...a.colWide }}>
          <div style={a.colHeader}>🏒 ENTER PICKS</div>
          <div style={a.pickGameSelect}>
            <select onChange={e => { const g = upcomingGames.find(x => x.id === e.target.value); if (g) selectGame(g) }} style={a.select}>
              <option value="">-- Select upcoming game --</option>
              {upcomingGames.map(g => (
                <option key={g.id} value={g.id}>{g.game_date} vs {g.opponent} ({g.is_home ? 'Home' : 'Away'})</option>
              ))}
            </select>
            {selectedGame && (
              <button onClick={generatePickingOrder} style={a.btnSecondary}>Generate Order</button>
            )}
          </div>
          {picksMessage && <p style={{ ...a.msg, color: picksMessage.includes('Error') || picksMessage.includes('Please') ? '#AD0E28' : '#7db8f7' }}>{picksMessage}</p>}
          {selectedGame && (
            <>
              {loadingPlayers ? <p style={a.msg}>Loading roster...</p> : (
                <div style={a.picksTable}>
                  <div style={a.picksHeader}>
                    <span style={{ width: '24px' }}>#</span>
                    <span style={{ flex: 1 }}>PLAYER</span>
                    <span style={{ flex: 2 }}>PICK</span>
                    <span style={{ flex: 1 }}>WINNER</span>
                  </div>
                  {pickingOrder.map((user, index) => {
                    const isWildcard = index === pickingOrder.length - 1
                    return (
                      <div key={user.id} style={{ ...a.pickRow, backgroundColor: isWildcard ? 'rgba(173,14,40,0.1)' : index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <span style={{ width: '24px', color: '#545559', fontSize: '12px' }}>{index + 1}{isWildcard ? '🃏' : ''}</span>
                        <span style={{ flex: 1, fontSize: '13px' }}>{user.name}</span>
                        <span style={{ flex: 2 }}>
                          {isWildcard ? (
                            <em style={{ color: '#545559', fontSize: '12px' }}>Auto — best unpicked Jets player</em>
                          ) : (
                            <select value={picks[user.id] || ''} onChange={e => setPicks({ ...picks, [user.id]: e.target.value })} style={a.pickSelect}>
                              <option value="">-- Select --</option>
                              <optgroup label="Goalies">
                                {players.filter(p => p.is_goalie).map(p => <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)}
                              </optgroup>
                              <optgroup label="WPG Skaters">
                                {players.filter(p => !p.is_goalie && p.team === 'WPG').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </optgroup>
                              <optgroup label={`${selectedGame.opponent} Skaters`}>
                                {players.filter(p => !p.is_goalie && p.team === selectedGame.opponent).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </optgroup>
                            </select>
                          )}
                        </span>
                        <span style={{ flex: 1 }}>
                          <select value={predictedWinners[user.id] || ''} onChange={e => setPredictedWinners({ ...predictedWinners, [user.id]: e.target.value })} style={a.pickSelect}>
                            <option value="">-- Winner --</option>
                            <option value="WPG">WPG</option>
                            <option value={selectedGame.opponent}>{selectedGame.opponent}</option>
                          </select>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              <button onClick={submitPicks} style={{ ...a.btnPrimary, marginTop: '12px', width: '100%' }}>
                ✓ Submit All Picks
              </button>
            </>
          )}
        </div>

        {/* COL 4 — Calculate Points */}
        <div style={a.col}>
          <div style={a.colHeader}>🎯 CALCULATE POINTS</div>
          <select onChange={e => { const g = allGames.find(x => x.id === e.target.value); if (g) setSelectedCalcGame(g) }} style={{ ...a.select, marginBottom: '12px' }}>
            <option value="">-- Select game --</option>
            {upcomingGames.map(g => <option key={g.id} value={g.id}>{g.game_date} vs {g.opponent} — UPCOMING</option>)}
            {allGames.filter(g => g.status === 'final').sort((a, b) => b.game_date.localeCompare(a.game_date)).map(g => (
              <option key={g.id} value={g.id}>{g.game_date} vs {g.opponent} — FINAL</option>
            ))}
          </select>
          {selectedCalcGame && (
            <button onClick={() => calculatePoints(selectedCalcGame)} disabled={calculating} style={{ ...a.btnPrimary, width: '100%', backgroundColor: '#AD0E28' }}>
              {calculating ? 'Calculating...' : `Calculate: ${selectedCalcGame.game_date} vs ${selectedCalcGame.opponent}`}
            </button>
          )}
          {calcMessage && <p style={{ ...a.msg, color: calcMessage.includes('Error') ? '#AD0E28' : '#7db8f7', fontWeight: 'bold' }}>{calcMessage}</p>}
          {calcResults.length > 0 && (
            <div style={a.calcResults}>
              {calcResults.map((r, i) => (
                <div key={i} style={{ ...a.calcRow, backgroundColor: i === 0 ? 'rgba(70,130,210,0.15)' : 'transparent' }}>
                  <span style={{ width: '20px', color: '#545559', fontSize: '12px' }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{r.name} {r.isWildcard ? '🃏' : ''}</div>
                    <div style={{ fontSize: '11px', color: '#8F9191' }}>{r.playerName} · {r.predictedWinner}</div>
                    <div style={{ fontSize: '11px', color: '#545559' }}>{r.breakdown}</div>
                  </div>
                  <span style={{ ...a.ptsBubble, background: r.points > 0 ? '#2a6ab5' : '#2a3550' }}>{r.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const a = {
  loginPage: {
    minHeight: '100vh', backgroundColor: '#01183F',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
  },
  loginBox: {
    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px', padding: '40px', textAlign: 'center', width: '320px',
  },
  loginTitle: { color: '#fff', fontSize: '28px', fontWeight: 900, letterSpacing: '3px', margin: '0 0 4px' },
  loginSub: { color: '#8F9191', fontSize: '13px', letterSpacing: '2px', margin: '0 0 24px' },
  loginInput: {
    width: '100%', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff',
    fontSize: '15px', marginBottom: '12px', boxSizing: 'border-box',
  },
  loginBtn: {
    width: '100%', padding: '10px', backgroundColor: '#003087', border: 'none',
    borderRadius: '6px', color: '#fff', fontSize: '15px', fontWeight: 700,
    letterSpacing: '2px', cursor: 'pointer',
  },
  page: {
    minHeight: '100vh', backgroundColor: '#01183F', color: '#fff',
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
    display: 'flex', flexDirection: 'column', position: 'relative',
    overflowX: 'hidden',
  },
  bgPattern: {
    position: 'fixed', inset: 0, zIndex: 0,
    backgroundImage: `
      radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 40%),
      radial-gradient(ellipse at 80% 70%, rgba(255,255,255,0.1) 0%, transparent 35%),
      repeating-linear-gradient(-30deg, transparent, transparent 80px, rgba(255,255,255,0.04) 80px, rgba(255,255,255,0.04) 81px),
      repeating-linear-gradient(40deg, transparent, transparent 60px, rgba(255,255,255,0.03) 60px, rgba(255,255,255,0.03) 61px),
      linear-gradient(180deg, #a8c8e8 0%, #c5ddf0 30%, #b8d4ec 60%, #9bbde0 100%)
    `,
    pointerEvents: 'none',
  },
  header: {
    backgroundColor: 'rgba(1,24,63,0.95)', backdropFilter: 'blur(10px)',
    borderBottom: '2px solid rgba(70,130,210,0.3)', padding: '12px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', zIndex: 2, flexShrink: 0, width: '100%',
  },
  headerTitle: { margin: 0, fontSize: '22px', fontWeight: 900, letterSpacing: '4px', color: '#fff' },
  backLink: { position: 'absolute', left: '24px', color: '#7db8f7', textDecoration: 'none', fontSize: '13px', fontWeight: 700, letterSpacing: '1px' },
  main: {
    display: 'grid', gridTemplateColumns: '16% 18% 1fr 24%',
    gap: '0', flex: 1, position: 'relative', zIndex: 1, overflow: 'hidden',
    height: 'calc(100vh - 52px)',
    width: '100%',
  },
  col: {
    padding: '16px', overflowY: 'auto',
    borderRight: '1px solid rgba(255,255,255,0.07)',
  },
  colWide: { padding: '16px' },
  colHeader: {
    fontSize: '13px', fontWeight: 800, letterSpacing: '3px', color: '#8F9191',
    marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid rgba(70,130,210,0.3)',
  },
  addForm: { marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '6px' },
  input: {
    padding: '7px 10px', backgroundColor: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '5px',
    color: '#fff', fontSize: '13px', width: '100%', boxSizing: 'border-box',
  },
  select: {
    padding: '7px 10px', backgroundColor: '#0a1f4e',
    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '5px',
    color: '#fff', fontSize: '13px', width: '100%', boxSizing: 'border-box',
  },
  pickSelect: {
    padding: '4px 6px', backgroundColor: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
    color: '#fff', fontSize: '12px', width: '100%', boxSizing: 'border-box',
  },
  btnPrimary: {
    padding: '8px 14px', backgroundColor: '#003087', border: 'none',
    borderRadius: '5px', color: '#fff', fontSize: '13px', fontWeight: 700,
    letterSpacing: '1px', cursor: 'pointer', width: '100%',
  },
  btnSecondary: {
    padding: '7px 12px', backgroundColor: 'rgba(70,130,210,0.2)',
    border: '1px solid rgba(70,130,210,0.4)', borderRadius: '5px',
    color: '#7db8f7', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  btnDelete: {
    padding: '3px 7px', backgroundColor: 'rgba(173,14,40,0.2)',
    border: '1px solid rgba(173,14,40,0.3)', borderRadius: '4px',
    color: '#AD0E28', fontSize: '12px', cursor: 'pointer', flexShrink: 0,
  },
  msg: { fontSize: '12px', color: '#7db8f7', margin: '6px 0' },
  participantList: { display: 'flex', flexDirection: 'column', gap: '4px' },
  participantRow: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px',
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '5px',
  },
  participantNum: { fontSize: '11px', color: '#545559', width: '16px', flexShrink: 0 },
  participantInfo: { flex: 1, minWidth: 0 },
  participantName: { fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  participantEmail: { fontSize: '11px', color: '#8F9191', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  scheduleList: { display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '10px' },
  scheduleRow: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 6px',
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px', fontSize: '12px',
  },
  scheduleDate: { color: '#fff', width: '90px', flexShrink: 0, fontSize: '13px', fontWeight: 700 },
  scheduleOpp: { flex: 1, fontWeight: 700, fontSize: '14px', color: '#fff' },
  scheduleHome: { color: '#fff', width: '20px', fontSize: '12px', fontWeight: 700 },
  scheduleStatus: { width: '60px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#fff' },
  pickGameSelect: { display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' },
  picksTable: { display: 'flex', flexDirection: 'column', gap: '2px' },
  picksHeader: {
    display: 'flex', gap: '8px', padding: '5px 8px',
    fontSize: '10px', letterSpacing: '2px', color: '#8F9191',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  pickRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '5px 8px', borderRadius: '4px',
  },
  calcResults: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' },
  calcRow: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
    borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  ptsBubble: {
    display: 'inline-block', padding: '3px 9px', borderRadius: '10px',
    fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0,
  },
}