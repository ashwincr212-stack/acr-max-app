export default function Coins({ coinLogs = [], coins = 0, setActiveTab }) {
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday - 86400000).getTime()

  const todayCoins = coinLogs
    .filter(log => log.createdAt >= startOfToday)
    .reduce((sum, log) => sum + log.amount, 0)

  const yesterdayCoins = coinLogs
    .filter(log => log.createdAt >= startOfYesterday && log.createdAt < startOfToday)
    .reduce((sum, log) => sum + log.amount, 0)

  const skillCoins = coinLogs
    .filter(log => log.source === 'skill')
    .reduce((sum, log) => sum + log.amount, 0)

  const predictionCoins = coinLogs
    .filter(log => log.source === 'prediction')
    .reduce((sum, log) => sum + log.amount, 0)

  const surpriseCoins = coinLogs
    .filter(log => log.source === 'surprise')
    .reduce((sum, log) => sum + log.amount, 0)

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back
          </button>
          <h1 className="text-lg font-bold text-slate-900">Max Coins Insights</h1>
          <div className="w-[68px]" />
        </div>

        <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Max Coins</p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900">
            {coins}
          </p>
        </div>

        <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Daily Earnings</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Today</span>
              <span className="font-semibold text-slate-900">{todayCoins} Max Coins</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Yesterday</span>
              <span className="font-semibold text-slate-900">{yesterdayCoins} Max Coins</span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Source Breakdown</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Skill Machine</span>
              <span className="font-semibold text-slate-900">{skillCoins}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Predictions</span>
              <span className="font-semibold text-slate-900">{predictionCoins}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Surprises</span>
              <span className="font-semibold text-slate-900">{surpriseCoins}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">AI Insight</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            You earn more Max Coins from Skill Machine in the morning
          </p>
        </div>

        <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Motivation</h2>
          <p className="mt-3 text-sm font-medium text-slate-700">
            Next reward at 600 Max Coins 🚀
          </p>
        </div>
      </div>
    </div>
  )
}
