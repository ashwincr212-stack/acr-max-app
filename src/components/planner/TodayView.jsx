import { useMemo } from 'react';
import TaskCard from './TaskCard';
import { fmt } from '../../utils/plannerUtils';

const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const todayStr = fmt(new Date());

export default function TodayView({ tasks, overdueTasks, categories, onToggle, onDelete, onReschedule }) {
  const todayTasks = useMemo(() =>
    tasks.filter(t => t.date === todayStr && !t.isInbox).sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    }), [tasks]);

  const now = new Date();
  const nowStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const activeTasks = todayTasks.filter(t => !t.completed);
  const doneTasks = todayTasks.filter(t => t.completed);

  const currentTask = activeTasks.find(t => {
    if (!t.time) return false;
    const endTime = addMinutes(t.time, t.duration);
    return t.time <= nowStr && endTime >= nowStr;
  });

  const upcomingTasks = activeTasks.filter(t => {
    if (t === currentTask) return false;
    if (!t.time) return true;
    return t.time > nowStr;
  });

  const completedCount = doneTasks.length;
  const totalActive = activeTasks.length;

  const getCat = (id) => categories.find(c => c.id === id);

  return (
    <div className="view-scroll">
      {/* Stats bar */}
      <div className="today-stats-bar">
        <div className="today-stat">
          <span className="today-stat-num">{totalActive}</span>
          <span className="today-stat-label">remaining</span>
        </div>
        <div className="today-stat-divider" />
        <div className="today-stat">
          <span className="today-stat-num">{completedCount}</span>
          <span className="today-stat-label">done</span>
        </div>
        {overdueTasks.length > 0 && (
          <>
            <div className="today-stat-divider" />
            <div className="today-stat today-stat--warn">
              <span className="today-stat-num">{overdueTasks.length}</span>
              <span className="today-stat-label">overdue</span>
            </div>
          </>
        )}
        {totalActive > 0 && (
          <div className="today-progress-bar">
            <div
              className="today-progress-fill"
              style={{ width: `${(completedCount / (completedCount + totalActive)) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Overdue / Carry Forward */}
      {overdueTasks.length > 0 && (
        <div className="section-block">
          <div className="section-label-row">
            <span className="section-label section-label--overdue">Overdue</span>
            <span className="section-label-count">{overdueTasks.length}</span>
          </div>
          {overdueTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              category={getCat(task.category)}
              onToggle={onToggle}
              onDelete={onDelete}
              onReschedule={onReschedule}
              showRescheduleToday
              overdue
            />
          ))}
        </div>
      )}

      {/* Current task */}
      {currentTask && (
        <div className="section-block">
          <div className="section-label-row">
            <span className="now-pill">
              <span className="now-dot" />
              Now
            </span>
          </div>
          <TaskCard
            task={currentTask}
            category={getCat(currentTask.category)}
            onToggle={onToggle}
            onDelete={onDelete}
            onReschedule={onReschedule}
            highlight
          />
        </div>
      )}

      {/* Upcoming */}
      {upcomingTasks.length > 0 && (
        <div className="section-block">
          <div className="section-label-row">
            <span className="section-label">Today's Tasks</span>
            <span className="section-label-count">{upcomingTasks.length}</span>
          </div>
          {upcomingTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              category={getCat(task.category)}
              onToggle={onToggle}
              onDelete={onDelete}
              onReschedule={onReschedule}
            />
          ))}
        </div>
      )}

      {/* No tasks state */}
      {activeTasks.length === 0 && overdueTasks.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">Today</div>
          <div className="empty-state-title">No tasks yet</div>
          <div className="empty-state-sub">Tap + to add your first task</div>
        </div>
      )}

      {/* Completed */}
      {doneTasks.length > 0 && (
        <div className="section-block">
          <div className="section-label-row">
            <span className="section-label section-label--done">Completed</span>
            <span className="section-label-count">{doneTasks.length}</span>
          </div>
          {doneTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              category={getCat(task.category)}
              onToggle={onToggle}
              onDelete={onDelete}
              onReschedule={onReschedule}
            />
          ))}
        </div>
      )}

      <div style={{ height: 100 }} />
    </div>
  );
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}
