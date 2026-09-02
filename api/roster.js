export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const { team } = req.query
  if (!team) return res.status(400).json({ error: 'Team required' })
  try {
    const response = await fetch(`https://api-web.nhle.com/v1/roster/${team}/20262027`)
    const data = await response.json()
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}