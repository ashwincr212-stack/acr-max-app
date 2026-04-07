import express from "express"
import axios from "axios"
import cors from "cors"

const app = express()
app.use(cors())

const API_KEY = "c316698ec1mshd0c3d0a897c6280p1a0808jsnc28cf23e969e"

// 🧠 CACHE
let cricketData = {
  matches: [],
  points: [],
  players: {
    orange: {},
    purple: {}
  }
}

// 🔥 FETCH LIVE DATA
const fetchCricketData = async () => {
  console.log("🔥 FUNCTION STARTED")

  try {
    console.log("➡️ TRY BLOCK STARTED")

    const res = await axios.get(
      "https://cricket-api-free-data.p.rapidapi.com/live-score",
      {
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": "cricket-api-free-data.p.rapidapi.com"
        }
      }
    )

    console.log("✅ API RESPONSE:", res.data)

    const matchesRaw = res.data?.data || []

    const matches = matchesRaw.slice(0, 5).map(m => ({
      teams: `${m?.team1 || "Team A"} vs ${m?.team2 || "Team B"}`,
      time: m?.status || "Live"
    }))

    cricketData.matches = matches

    // TEMP STATIC DATA
    cricketData.points = [
      { team: "CSK", pts: 10 },
      { team: "MI", pts: 8 }
    ]

    cricketData.players = {
      orange: { name: "Virat Kohli", runs: 450 },
      purple: { name: "Bumrah", wickets: 18 }
    }

    console.log("✅ LIVE DATA UPDATED")

  } catch (err) {
    console.log("❌ FULL ERROR:", err.response?.data || err.message)
  }
}

// 🔁 AUTO REFRESH
setInterval(fetchCricketData, 5 * 60 * 1000)

// FIRST LOAD
fetchCricketData()

// 📡 API
app.get("/cricket", (req, res) => {
  res.json(cricketData)
})

// START SERVER
app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000")
})