const TAB_TITLES = {
  today: null,
  week: 'This Week',
  month: null,
  agenda: 'Agenda',
  inbox: 'Inbox',
};

export default function PlannerHeader({ activeTab }) {
  const now = new Date();

  if (activeTab === 'today') {
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    return (
      <header className="planner-header planner-header--today">
        <div className="planner-header-today-label">{dayName}</div>
        <div className="planner-header-today-date">{dateStr}</div>
      </header>
    );
  }

  if (activeTab === 'month') {
    const monthStr = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return (
      <header className="planner-header planner-header--month">
        <div className="planner-header-month-title">{monthStr}</div>
      </header>
    );
  }

  return (
    <header className="planner-header planner-header--default">
      <div className="planner-header-default-title">{TAB_TITLES[activeTab]}</div>
    </header>
  );
}