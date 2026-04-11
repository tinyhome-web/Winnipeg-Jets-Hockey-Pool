import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Dashboard() {
  const [standings, setStandings] = useState([])
  const [recentGame, setRecentGame] = useState(null)
  const [recentPicks, setRecentPicks] = useState([])
  const [upcomingGame, setUpcomingGame] = useState(null)
  const [upcomingPicks, setUpcomingPicks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)

    // Fetch standings
    const { data: participantsData } = await supabase
      .from('season_participants')
      .select('*, users(name)')
      .order('total_points', { ascending: false })
    if (participantsData) setStandings(participantsData)

    // Fetch most recent completed game
    const { data: recentGames } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'final')
      .order('game_date', { ascending: false })
      .limit(1)
    
    if (recentGames && recentGames.length > 0) {
      setRecentGame(recentGames[0])
      
      // Fetch picks for recent game
      const { data: picks } = await supabase
        .from('picks')
        .select('*, users(name), players(name, team, is_goalie)')
        .eq('game_id', recentGames[0].id)
        .order('points_earned', { ascending: false })
      if (picks) setRecentPicks(picks)
    }

    // Fetch next upcoming game
    const { data: upcomingGames } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'upcoming')
      .order('game_date', { ascending: true })
      .limit(1)
    
    if (upcomingGames && upcomingGames.length > 0) {
      setUpcomingGame(upcomingGames[0])

      // Fetch picks for upcoming game
      const { data: upPicks } = await supabase
        .from('picks')
        .select('*, users(name), players(name, team, is_goalie)')
        .eq('game_id', upcomingGames[0].id)
      if (upPicks) setUpcomingPicks(upPicks)
    }

    setLoading(false)
  }

  if (loading) return <div style={{ textAlign: 'center', marginTop: '100px' }}>Loading...</div>

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <div style={{ backgroundColor: '#003087', color: 'white', padding: '20px', borderRadius: '8px', marginBottom: '24px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '28px' }}>🏒 Jets Hockey Pool</h1>
        <p style={{ margin: '4px 0 0', opacity: 0.8 }}>2025-2026 Season</p>
      </div>

      {/* Standings */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
        <h2 style={{ marginTop: 0, color: '#003087' }}>📊 Season Standings</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd' }}>Rank</th>
              <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd' }}>Participant</th>
              <th style={{ textAlign: 'right', padding: '10px', borderBottom: '2px solid #ddd' }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, index) => (
              <tr key={s.id} style={{ backgroundColor: index === 0 ? '#fff8e1' : index % 2 === 0 ? '#fafafa' : 'white' }}>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                </td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee', fontWeight: index === 0 ? 'bold' : 'normal' }}>
                  {s.users?.name}
                </td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>
                  {s.total_points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Game Results */}
      {recentGame && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
          <h2 style={{ marginTop: 0, color: '#003087' }}>🎯 Last Game Results</h2>
          <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '6px', marginBottom: '16px', textAlign: 'center' }}>
            <strong>WPG {recentGame.jets_score} — {recentGame.opponent_score} {recentGame.opponent}</strong>
            <span style={{ marginLeft: '12px', color: '#666', fontSize: '14px' }}>{recentGame.game_date}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd' }}>Participant</th>
                <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd' }}>Pick</th>
                <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd' }}>Predicted Winner</th>
                <th style={{ textAlign: 'right', padding: '10px', borderBottom: '2px solid #ddd' }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {recentPicks.map((pick, index) => (
                <tr key={pick.id} style={{ backgroundColor: index % 2 === 0 ? '#fafafa' : 'white' }}>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    {pick.users?.name} {pick.is_wildcard ? '🃏' : ''}
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    {pick.is_wildcard ? 'Wildcard' : pick.players?.name || '—'}
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{pick.predicted_winner}</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>
                    {pick.points_earned}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upcoming Game */}
      {upcomingGame && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px' }}>
          <h2 style={{ marginTop: 0, color: '#003087' }}>📅 Next Game</h2>
          <div style={{ backgroundColor: '#e8f4fd', padding: '12px', borderRadius: '6px', marginBottom: '16px', textAlign: 'center' }}>
            <strong>WPG vs {upcomingGame.opponent}</strong>
            <span style={{ marginLeft: '12px', color: '#666', fontSize: '14px' }}>
              {upcomingGame.game_date} — {upcomingGame.is_home ? 'Home' : 'Away'}
            </span>
          </div>
          {upcomingPicks.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd' }}>Participant</th>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd' }}>Pick</th>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd' }}>Predicted Winner</th>
                </tr>
              </thead>
              <tbody>
                {upcomingPicks.map((pick, index) => (
                  <tr key={pick.id} style={{ backgroundColor: index % 2 === 0 ? '#fafafa' : 'white' }}>
                    <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                      {pick.users?.name} {pick.is_wildcard ? '🃏' : ''}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                      {pick.is_wildcard ? 'Wildcard' : pick.players?.name || '—'}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{pick.predicted_winner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#888', textAlign: 'center' }}>Picks not yet entered for this game.</p>
          )}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '20px', color: '#999', fontSize: '12px' }}>
        <a href="/admin" style={{ color: '#999' }}>Admin</a>
      </div>
    </div>
  )
}