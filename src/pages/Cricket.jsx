import { useEffect, useState } from "react"

function Cricket() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("matches")

  // 🔥 FETCH FROM YOUR SERVER CACHE
  const fetchCricket = async () => {
    try {
      const res = await fetch("http://localhost:5000/cricket")
      const json = await res.json()

      setData(json)
    } catch (err) {
      console.log("Error:", err)

      // fallback data
      setData({
        matches: [
          { teams: "MI vs DC", time: "3:30 PM" },
          { teams: "GT vs RR", time: "7:30 PM" }
        ],
        points: [
          { team: "CSK", pts: 10 },
          { team: "MI", pts: 8 },
          { team: "RCB", pts: 8 }
        ],
        players: {
          orange: { name: "Virat Kohli", runs: 450 },
          purple: { name: "Bumrah", wickets: 18 }
        }
      })
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchCricket()
  }, [])

  if (loading) {
    return <p className="p-4">Loading cricket data...</p>
  }

  return (
    <div className="p-4">

      {/* HEADER */}
      <h1 className="text-2xl font-bold mb-4">🏏 IPL Dashboard</h1>

      {/* TABS */}
      <div className="flex gap-2 mb-4">
        {["matches", "points", "players"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1 rounded-full text-sm capitalize ${
              tab === t
                ? "bg-black text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* MATCHES */}
      {tab === "matches" && (
        <div className="space-y-4">

          <h2 className="font-semibold text-lg">🔥 Today’s Matches</h2>

          {data.matches.map((m, i) => (
            <div
              key={i}
              className="bg-white p-4 rounded-xl shadow flex justify-between"
            >
              <span>{m.teams}</span>
              <span className="text-gray-500">{m.time}</span>
            </div>
          ))}

        </div>
      )}

      {/* POINTS TABLE */}
      {tab === "points" && (
        <div className="space-y-3">
          {data.points.map((t, i) => (
            <div
              key={i}
              className="bg-white p-4 rounded-xl shadow flex justify-between"
            >
              <span>{t.team}</span>
              <span className="font-bold">{t.pts} pts</span>
            </div>
          ))}
        </div>
      )}

      {/* PLAYERS */}
      {tab === "players" && (
        <div className="space-y-4">

          {/* ORANGE CAP */}
          <div className="bg-orange-100 p-4 rounded-xl shadow">
            <h2 className="font-semibold">🟠 Orange Cap</h2>
            <p>{data.players.orange.name}</p>
            <p className="text-sm text-gray-500">
              Runs: {data.players.orange.runs}
            </p>
          </div>

          {/* PURPLE CAP */}
          <div className="bg-purple-100 p-4 rounded-xl shadow">
            <h2 className="font-semibold">🟣 Purple Cap</h2>
            <p>{data.players.purple.name}</p>
            <p className="text-sm text-gray-500">
              Wickets: {data.players.purple.wickets}
            </p>
          </div>

        </div>
      )}

    </div>
  )
}

export default Cricket