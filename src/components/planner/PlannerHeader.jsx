const TAB_TITLES = {
  today: null,
  week: 'This Week',
  month: null,
  agenda: 'Agenda',
  inbox: 'Inbox',
};

export default function PlannerHeader({ activeTab, stats = {} }) {
  const now = new Date();
  const completionPct = stats.completionPct || 0;
  const remaining = stats.remaining || 0;
  const done = stats.done || 0;
  const overdue = stats.overdue || 0;

  const StatusStrip = () => (
    <div className="planner-status-strip">
      <div className="planner-status-chip">
        <span className="planner-status-num">{remaining}</span>
        <span>Remaining</span>
      </div>
      <div className="planner-status-chip planner-status-chip--done">
        <span className="planner-status-num">{done}</span>
        <span>Done</span>
      </div>
      <div className={`planner-status-chip${overdue ? ' planner-status-chip--hot' : ''}`}>
        <span className="planner-status-num">{overdue}</span>
        <span>Overdue</span>
      </div>
    </div>
  );

  const Progress = () => (
    <div className="planner-hero-progress" aria-label={`${completionPct}% complete`}>
      <div className="planner-hero-progress-fill" style={{ width: `${completionPct}%` }} />
    </div>
  );

  if (activeTab === 'today') {
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    return (
      <header className="planner-header planner-header--today">
        <div className="planner-hero-row">
          <div>
            <div className="planner-header-today-label">{dayName}</div>
            <div className="planner-header-today-date">{dateStr}</div>
            <div className="planner-header-subline">{stats.today || 0} for today · {completionPct}% complete</div>
          </div>
          <div className="planner-focus-orb">
            <span>{completionPct}%</span>
            <small>clear</small>
          </div>
        </div>
        <StatusStrip />
        <Progress />
      </header>
    );
  }

  if (activeTab === 'month') {
    const monthStr = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return (
      <header className="planner-header planner-header--month">
        <div className="planner-hero-row planner-hero-row--compact">
          <div>
            <div className="planner-header-month-title">{monthStr}</div>
            <div className="planner-header-subline">{stats.total || 0} planned · {stats.inbox || 0} inbox</div>
          </div>
          <div className="planner-focus-orb planner-focus-orb--small">
            <span>{completionPct}%</span>
          </div>
        </div>
        <StatusStrip />
        <Progress />
      </header>
    );
  }

  return (
    <header className="planner-header planner-header--default">
      <div className="planner-hero-row planner-hero-row--compact">
        <div>
          <div className="planner-header-default-title">{TAB_TITLES[activeTab]}</div>
          <div className="planner-header-subline">{remaining} open · {done} completed</div>
        </div>
        <div className="planner-focus-orb planner-focus-orb--small">
          <span>{completionPct}%</span>
        </div>
      </div>
      <StatusStrip />
      <Progress />
    </header>
  );
}
