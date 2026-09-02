export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const { gameId } = req.query
  if (!gameId) return res.status(400).json({ error: 'gameId required' })
  try {
    const response = await fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`)
    const data = await response.json()
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}