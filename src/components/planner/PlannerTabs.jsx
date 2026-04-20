export default function PlannerTabs({ activeTab, setActiveTab, inboxCount }) {
  const tabs = [
    { id: 'today', label: 'Today', icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="4" fill="currentColor" opacity=".9"/>
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.41 1.41M14.37 14.37l1.41 1.41M4.22 15.78l1.41-1.41M14.37 5.63l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )},
    { id: 'week', label: 'Week', icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6 2v3M14 2v3M2 8h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="5" y="11" width="2" height="2" rx=".5" fill="currentColor"/>
        <rect x="9" y="11" width="2" height="2" rx=".5" fill="currentColor"/>
        <rect x="13" y="11" width="2" height="2" rx=".5" fill="currentColor"/>
      </svg>
    )},
    { id: 'month', label: 'Month', icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6 2v3M14 2v3M2 8h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="6" cy="12" r="1" fill="currentColor"/>
        <circle cx="10" cy="12" r="1" fill="currentColor"/>
        <circle cx="14" cy="12" r="1" fill="currentColor"/>
        <circle cx="6" cy="15" r="1" fill="currentColor"/>
        <circle cx="10" cy="15" r="1" fill="currentColor"/>
      </svg>
    )},
    { id: 'agenda', label: 'Agenda', icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 5h12M4 10h8M4 15h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )},
    { id: 'inbox', label: 'Inbox', icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2 12l2-7h12l2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12h4.5a3.5 3.5 0 007 0H18v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    )},
  ];

  return (
    <nav className="planner-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`planner-tab${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          aria-label={tab.label}
        >
          <span className="planner-tab-icon">{tab.icon}</span>
          <span className="planner-tab-label">{tab.label}</span>
          {tab.id === 'inbox' && inboxCount > 0 && (
            <span className="planner-tab-badge">{inboxCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
}