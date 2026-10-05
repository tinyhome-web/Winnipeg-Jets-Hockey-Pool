# Winnipeg Jets Hockey Pool — Project Context

## Tech Stack
- **Frontend**: React (Vite) hosted on Vercel
- **Database/Backend**: Supabase (PostgreSQL)
- **Live URL**: https://winnipeg-jets-hockey-pool.vercel.app
- **GitHub**: https://github.com/tinyhome-web/Winnipeg-Jets-Hockey-Pool
- **NHL API**: https://api-web.nhle.com (no key needed)

## Project Structure
src/
pages/
Dashboard.jsx — public facing page
Admin.jsx — admin panel (password protected)
supabaseClient.js
App.jsx
index.css
App.css
api/
schedule.js — Vercel serverless: fetches WPG schedule
roster.js — Vercel serverless: fetches team rosters
playbyplay.js — Vercel serverless: fetches play by play
boxscore.js — Vercel serverless: fetches boxscore


## Database Tables (Supabase)
- **users** — pool participants (id, name, email)
- **seasons** — season info (id, name, start_date, end_date, is_active)
- **season_participants** — links users to seasons with total_points
- **games** — Jets schedule (id, nhl_game_id, game_date, opponent, is_home, status, jets_score, opponent_score, winning_team)
- **players** — player roster (id, nhl_player_id, name, team, is_goalie)
- **picks** — user picks per game (id, game_id, user_id, player_id, is_wildcard, predicted_winner, points_earned, breakdown)
- **picking_order** — pick order per game (id, game_id, user_id, pick_position)
- **player_game_stats** — not currently used, reserved for future

## Current Season
- 2026-2027
- 84 regular season games imported
- NHL API season code: 20262027

## Scoring Rules
- First Jets goal scorer = 5 pts (instead of 1)
- First opponent goal scorer = 5 pts (instead of 1)
- All other goals/assists = 1 pt
- Correct winning team prediction = 2 pts
- Goalie pick: starts at 3 pts, -1 per goal against, min 0, shutout = 6 pts (so 0, 1, 2, or 6)
- Assists on first goal = 1 pt (not 5)

## Wildcard Rule (last picker)
- No player pick — gets points of best unpicked Jets player
- First goal bonus applies if that player scored the first goal
- Still gets 2 pts for correct team prediction
- Wildcard points only from Jets players (not opponent)

## Picking Order Rules
- First game of season = random
- Normal games = ordered by previous game points (highest to lowest)
- Ties broken randomly
- If previous game was Friday AND current game is Saturday/Sunday = fully randomized
- If only Saturday/Sunday game with no Friday game = ordered by previous game

## Restrictions
- No duplicate picks per game
- No picking same player (or Jets/Opp goalies) in back-to-back games
- 12 fixed participants per season (can vary season to season)
- Goalies: don't pick specific goalie, just "Jets Goalies" or "OPP Goalies" — points go to whoever starts

## Admin Panel Features
- 4-column layout: Participants | Schedule | Enter Picks | Calculate Points
- Password protected
- Import schedule from NHL API (uses /api/schedule Vercel function)
- Custom dropdown for player picks (not native select — was white on white)
- Generate picking order button (auto-orders by last game or randomizes)
- Submit All Picks — validates duplicates and back-to-back rule
- Calculate Points — checks game is final via NHL API gameState field
- Double-calculation protection — subtracts old points before adding new ones

## Public Dashboard Features
- 3-column layout: Next Game | Standings | Last Game
- Ice texture background with Jets colors
- Cetacean Blue (#01183F), Wine Red (#AD0E28), light blue accents (#7db8f7)
- Clickable player names in standings → opens history modal
- History modal shows: total pts, games, avg/game, best game, full game-by-game breakdown

## Vercel API Functions
All NHL API calls go through Vercel serverless functions to avoid CORS:
- /api/schedule — WPG schedule for 20262027
- /api/roster?team=XXX — roster for any team, season 20262027
- /api/playbyplay?gameId=XXX — play by play data
- /api/boxscore?gameId=XXX — boxscore data

## Known Issues / Recent Fixes
- Custom dropdown built for player picks (browser native select was white on white)
- Double-calculation fix: subtracts old pick points before adding new ones
- Goalie picks stored as team's first goalie ID in DB, mapped back to goalie-TEAM format on load
- Weekend game rule uses Winnipeg timezone (America/Winnipeg) for day-of-week calculation
- Season participants must be manually added when new user is created (fixed in addUser function)
- Deleting a user also deletes their picks, picking_order, and season_participants records

## Admin Workflow (each game)
1. Before game: Admin Panel → Enter Picks → Select game → Generate Order → Enter picks → Submit
2. After game: Admin Panel → Calculate Points → Select game → Calculate
3. Public dashboard updates automatically

## Season Reset Process
1. DELETE FROM picks
2. DELETE FROM picking_order  
3. DELETE FROM player_game_stats
4. DELETE FROM games
5. DELETE FROM players
6. UPDATE season_participants SET total_points = 0
7. UPDATE seasons SET name, start_date, end_date for new season
8. Update season code in api/schedule.js, api/roster.js
9. Import new schedule from admin panel

## Environment Variables (Vercel + .env)
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

## Git Workflow
- npm run dev → local preview at localhost:5173
- git add . → git commit -m "message" → git push → auto deploys to Vercel
- Always test calculate points on LIVE site not localhost (Vercel API functions don't run locally)
