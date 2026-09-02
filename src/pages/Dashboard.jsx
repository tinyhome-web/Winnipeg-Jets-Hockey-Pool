import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Dashboard() {
  const [standings, setStandings] = useState([])
  const [recentGame, setRecentGame] = useState(null)
  const [recentPicks, setRecentPicks] = useState([])
  const [upcomingGame, setUpcomingGame] = useState(null)
  const [upcomingPicks, setUpcomingPicks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDashboardData() }, [])

  useEffect(() => {
  document.body.style.overflow = 'hidden'
  return () => {
    document.body.style.overflow = 'auto'
  }
}, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    const { data: participantsData } = await supabase
      .from('season_participants').select('*, users(name)').order('total_points', { ascending: false })
    if (participantsData) setStandings(participantsData)

    const { data: recentGames } = await supabase
      .from('games').select('*').eq('status', 'final').order('game_date', { ascending: false }).limit(1)
    if (recentGames?.length > 0) {
      setRecentGame(recentGames[0])
      const { data: picks } = await supabase
        .from('picks').select('*, users(name), players(name, team, is_goalie)')
        .eq('game_id', recentGames[0].id).order('points_earned', { ascending: false })
      if (picks) setRecentPicks(picks)
    }

    const { data: upcomingGames } = await supabase
      .from('games').select('*').eq('status', 'upcoming').order('game_date', { ascending: true }).limit(1)
    if (upcomingGames?.length > 0) {
      setUpcomingGame(upcomingGames[0])
      const { data: upPicks } = await supabase
        .from('picks').select('*, users(name), players(name, team, is_goalie)').eq('game_id', upcomingGames[0].id)
      if (upPicks) setUpcomingPicks(upPicks)
    }
    setLoading(false)
  }

  if (loading) return (
    <div style={s.loadingScreen}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>🏒</div>
        <p style={{ color: '#fff', fontSize: '20px', letterSpacing: '4px', fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif' }}>LOADING...</p>
      </div>
    </div>
  )

  const topScore = standings[0]?.total_points || 1

  return (
    <div style={s.page}>
      {/* Jersey stripe background */}
      <div style={s.stripesBg} />
      <div style={s.bgOverlay} />

      {/* Header */}
      <header style={s.header}>
        <h1 style={s.headerTitle}>JETS HOCKEY POOL</h1>
        <p style={s.headerSub}>2026–2027 SEASON</p>
        <a href="/admin" style={s.adminLink}>⚙ Admin</a>
      </header>

      {/* Main 3-column layout */}
      <main style={s.main}>

        {/* LEFT — Next Game */}
        <aside style={s.col}>
          <div style={s.sectionHeader}>
            <span>📅</span>
            <h2 style={s.sectionTitle}>NEXT GAME</h2>
          </div>
          {upcomingGame ? (
            <>
              <div style={s.nextGameBox}>
                <div style={s.nextTeamsRow}>
                  <span style={s.nextTeam}>WPG</span>
                  <span style={s.nextVs}>vs</span>
                  <span style={s.nextTeam}>{upcomingGame.opponent}</span>
                </div>
                <div style={s.nextMeta}>{upcomingGame.game_date} · {upcomingGame.is_home ? '🏠 HOME' : '✈️ AWAY'}</div>
              </div>
              {upcomingPicks.length > 0 ? (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>PLAYER</th>
                      <th style={s.th}>PICK</th>
                      <th style={s.th}>WINNER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingPicks.map((pick, i) => (
                      <tr key={pick.id} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)' }}>
                        <td style={s.td}>{pick.users?.name}{pick.is_wildcard && <span style={s.wc}>🃏</span>}</td>
                        <td style={s.td}>{pick.is_wildcard ? <em style={{ color: '#8F9191' }}>Wildcard</em> : (pick.players?.name || '—')}</td>
                        <td style={s.td}>{pick.predicted_winner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={s.empty}>Picks not yet entered.</div>
              )}
            </>
          ) : (
            <div style={s.empty}>No upcoming games scheduled.</div>
          )}
        </aside>

        {/* CENTER — Standings */}
        <section style={{ ...s.col, borderLeft: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={s.sectionHeader}>
            <span>🏆</span>
            <h2 style={s.sectionTitle}>STANDINGS</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {standings.map((st, i) => {
              const pct = (st.total_points / topScore) * 100
              const medals = ['🥇', '🥈', '🥉']
              return (
                <div key={st.id} style={{ ...s.standingRow, ...(i === 0 ? s.standingRowFirst : {}) }}>
                  <div style={s.standingRank}>
                    {i < 3 ? <span style={{ fontSize: '18px' }}>{medals[i]}</span> : <span style={s.rankNum}>{i + 1}</span>}
                  </div>
                  <div style={s.standingName}>{st.users?.name}</div>
                  <div style={s.barWrap}>
                    <div style={{ ...s.bar, width: `${pct}%` }} />
                  </div>
                  <div style={s.standingPts}>{st.total_points}<span style={s.ptLabel}>pts</span></div>
                </div>
              )
            })}
          </div>
        </section>

        {/* RIGHT — Last Game */}
        <aside style={s.col}>
          {recentGame ? (
            <>
              <div style={s.sectionHeader}>
                <span>🎯</span>
                <h2 style={s.sectionTitle}>LAST GAME</h2>
                <span style={s.gameDate}>{recentGame.game_date}</span>
              </div>
              <div style={s.scoreboard}>
                <div style={s.scoreSide}>
                  <div style={s.scoreTeamLabel}>WPG</div>
                  <div style={s.scoreNum}>{recentGame.jets_score ?? '—'}</div>
                </div>
                <div style={s.scoreDivider}>
                  <div style={s.scoreVs}>FINAL</div>
                  {recentGame.winning_team && (
                    <div style={s.winnerBadge}>{recentGame.winning_team} WIN</div>
                  )}
                </div>
                <div style={s.scoreSide}>
                  <div style={s.scoreTeamLabel}>{recentGame.opponent}</div>
                  <div style={s.scoreNum}>{recentGame.opponent_score ?? '—'}</div>
                </div>
              </div>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>PLAYER</th>
                    <th style={s.th}>PICK</th>
                    <th style={s.th}>WINNER</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPicks.map((pick, i) => (
                    <tr key={pick.id} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)' }}>
                      <td style={s.td}>{pick.users?.name}{pick.is_wildcard && <span style={s.wc}>🃏</span>}</td>
                      <td style={s.td}>{pick.is_wildcard ? <em style={{ color: '#8F9191' }}>Wildcard</em> : (pick.players?.name || '—')}</td>
                      <td style={s.td}>{pick.predicted_winner}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        <span style={{ ...s.ptsBubble, background: pick.points_earned > 0 ? '#2a6ab5' : '#2a3550' }}>
                          {pick.points_earned}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div style={s.empty}>No completed games yet.</div>
          )}
        </aside>
      </main>
    </div>
  )
}

const s = {
  page: {
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: '#01183F',
    color: '#fff',
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  stripesBg: {
  position: 'fixed', inset: 0, zIndex: 0,
  background: `
    radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 40%),
    radial-gradient(ellipse at 80% 70%, rgba(255,255,255,0.1) 0%, transparent 35%),
    radial-gradient(ellipse at 50% 50%, rgba(180,210,240,0.08) 0%, transparent 60%),
    repeating-linear-gradient(
      -30deg,
      transparent,
      transparent 80px,
      rgba(255,255,255,0.04) 80px,
      rgba(255,255,255,0.04) 81px
    ),
    repeating-linear-gradient(
      40deg,
      transparent,
      transparent 60px,
      rgba(255,255,255,0.03) 60px,
      rgba(255,255,255,0.03) 61px
    ),
    repeating-linear-gradient(
      -70deg,
      transparent,
      transparent 100px,
      rgba(255,255,255,0.02) 100px,
      rgba(255,255,255,0.02) 101px
    ),
    linear-gradient(180deg, #a8c8e8 0%, #c5ddf0 30%, #b8d4ec 60%, #9bbde0 100%)
  `,
},
  bgOverlay: {
  position: 'fixed', inset: 0, zIndex: 0,
  backgroundImage: 'radial-gradient(ellipse at 50% 50%, rgba(1,24,63,0.72) 0%, rgba(1,24,63,0.85) 100%)',
  pointerEvents: 'none',
},
  loadingScreen: {
    height: '100vh', backgroundColor: '#01183F',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  header: {
    backgroundColor: 'rgba(1,24,63,0.95)',
    backdropFilter: 'blur(10px)',
    borderBottom: '2px solid rgba(70,130,210,0.4)',
    padding: '12px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
    flexShrink: 0,
    gap: '16px',
  },
  headerTitle: {
    margin: 0, fontSize: '24px', fontWeight: 900,
    letterSpacing: '5px', color: '#fff', textAlign: 'center',
  },
  headerSub: {
    margin: 0, fontSize: '11px', letterSpacing: '4px',
    color: '#8F9191',
  },
  adminLink: {
    position: 'absolute', right: '24px',
    color: '#545559', textDecoration: 'none', fontSize: '13px', letterSpacing: '1px',
  },
  main: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  col: {
    padding: '20px 20px',
    overflowY: 'auto',
  },
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: '8px',
    marginBottom: '16px',
    borderBottom: '1px solid rgba(70,130,210,0.35)',
    paddingBottom: '10px',
  },
  sectionTitle: { margin: 0, fontSize: '16px', fontWeight: 800, letterSpacing: '3px', flex: 1 },
  gameDate: { fontSize: '11px', color: '#8F9191', letterSpacing: '1px' },
  standingRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 10px', borderRadius: '6px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid transparent',
  },
  standingRowFirst: {
    backgroundColor: 'rgba(70,130,210,0.15)',
    border: '1px solid rgba(70,130,210,0.3)',
  },
  standingRank: { width: '28px', textAlign: 'center', flexShrink: 0 },
  rankNum: { fontSize: '14px', fontWeight: 700, color: '#8F9191' },
  standingName: { fontSize: '14px', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  barWrap: { width: '50px', height: '5px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', flexShrink: 0 },
  bar: { height: '100%', backgroundImage: 'linear-gradient(90deg, #2a6ab5, #7db8f7)', borderRadius: '3px' },
  standingPts: { fontSize: '16px', fontWeight: 800, width: '50px', textAlign: 'right', flexShrink: 0 },
  ptLabel: { fontSize: '10px', color: '#8F9191', marginLeft: '2px', fontWeight: 400 },
  scoreboard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: 'rgba(1,24,63,0.7)',
    border: '1px solid rgba(70,130,210,0.2)',
    borderRadius: '10px', padding: '16px', marginBottom: '16px',
  },
  scoreSide: { textAlign: 'center' },
  scoreTeamLabel: { fontSize: '13px', fontWeight: 700, letterSpacing: '2px', color: '#8F9191', marginBottom: '4px' },
  scoreNum: { fontSize: '56px', fontWeight: 900, lineHeight: 1, color: '#fff' },
  scoreDivider: { textAlign: 'center' },
  scoreVs: { fontSize: '11px', color: '#8F9191', letterSpacing: '2px', marginBottom: '6px' },
  winnerBadge: { fontSize: '11px', color: '#7db8f7', letterSpacing: '1px', fontWeight: 700 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { textAlign: 'left', padding: '7px 8px', fontSize: '10px', letterSpacing: '2px', color: '#8F9191', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  td: { padding: '8px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '13px', color: '#fff' },
  wc: { marginLeft: '4px', fontSize: '11px' },
  ptsBubble: { display: 'inline-block', padding: '2px 7px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: '#fff' },
  nextGameBox: {
    backgroundColor: 'rgba(1,24,63,0.7)',
    border: '1px solid rgba(70,130,210,0.2)',
    borderRadius: '10px', padding: '16px', textAlign: 'center', marginBottom: '16px',
  },
  nextTeamsRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '6px' },
  nextTeam: { fontSize: '28px', fontWeight: 900, letterSpacing: '2px' },
  nextVs: { fontSize: '12px', color: '#8F9191' },
  nextMeta: { fontSize: '11px', color: '#8F9191', letterSpacing: '1px' },
  empty: { textAlign: 'center', color: '#8F9191', padding: '30px 0', fontSize: '13px' },
}