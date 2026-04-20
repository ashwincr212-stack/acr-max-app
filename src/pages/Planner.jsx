import { useState, useCallback } from 'react';
import PlannerTabs from '../components/planner/PlannerTabs';
import PlannerHeader from '../components/planner/PlannerHeader';
import QuickAddSheet from '../components/planner/QuickAddSheet';
import TodayView from '../components/planner/TodayView';
import WeekView from '../components/planner/WeekView';
import MonthView from '../components/planner/MonthView';
import AgendaView from '../components/planner/AgendaView';
import InboxView from '../components/planner/InboxView';
import DayDetailSheet from '../components/planner/DayDetailSheet';
import '../styles/planner.css';

const SAMPLE_CATEGORIES = [
  { id: 'work', name: 'Work', color: '#1A6BFF' },
  { id: 'health', name: 'Health', color: '#3B6D11' },
  { id: 'personal', name: 'Personal', color: '#534AB7' },
  { id: 'finance', name: 'Finance', color: '#BA7517' },
  { id: 'meetings', name: 'Meetings', color: '#0F6E56' },
  { id: 'errands', name: 'Errands', color: '#993C1D' },
];

const today = new Date();
const fmt = (d) => d.toISOString().split('T')[0];
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

const SAMPLE_TASKS = [];

const SAMPLE_INBOX = [];

export default function Planner() {
  const [activeTab, setActiveTab] = useState('today');
  const [tasks, setTasks] = useState(SAMPLE_TASKS);
  const [inboxItems, setInboxItems] = useState(SAMPLE_INBOX);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [dayDetailDate, setDayDetailDate] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const addTask = useCallback((taskData) => {
    const newTask = {
      id: Date.now().toString(),
      title: taskData.title,
      date: taskData.date || '',
      time: taskData.time || '',
      duration: taskData.duration || 30,
      priority: taskData.priority || 'none',
      category: taskData.category || 'work',
      completed: false,
      isInbox: taskData.isInbox || false,
      notes: taskData.notes || '',
      remindAt: taskData.remindAt || '',
      subtasks: [],
      createdAt: new Date().toISOString(),
    };
    if (taskData.isInbox) {
      setInboxItems(prev => [{ id: newTask.id, title: newTask.title, notes: newTask.notes, createdAt: newTask.createdAt }, ...prev]);
    } else {
      setTasks(prev => [...prev, newTask]);
    }
    setQuickAddOpen(false);
  }, []);

  const toggleTask = useCallback((taskId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null } : t));
  }, []);

  const deleteTask = useCallback((taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const rescheduleTask = useCallback((taskId, newDate) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, date: newDate } : t));
  }, []);

  const scheduleInboxItem = useCallback((itemId, taskData) => {
    const item = inboxItems.find(i => i.id === itemId);
    if (!item) return;
    setInboxItems(prev => prev.filter(i => i.id !== itemId));
    setTasks(prev => [...prev, {
      id: itemId,
      title: item.title,
      date: taskData.date || fmt(today),
      time: taskData.time || '',
      duration: taskData.duration || 30,
      priority: taskData.priority || 'none',
      category: taskData.category || 'work',
      completed: false,
      isInbox: false,
      notes: item.notes || '',
      remindAt: taskData.remindAt || '',
      subtasks: [],
      createdAt: item.createdAt,
    }]);
  }, [inboxItems]);

  const deleteInboxItem = useCallback((itemId) => {
    setInboxItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const openDayDetail = useCallback((date) => {
    setDayDetailDate(date);
  }, []);

  const todayStr = fmt(today);
  const overdueTasks = tasks.filter(t => !t.completed && !t.isInbox && t.date && t.date < todayStr);

  return (
    <div className="planner-root">
      <PlannerHeader activeTab={activeTab} />
      <PlannerTabs activeTab={activeTab} setActiveTab={setActiveTab} inboxCount={inboxItems.length} />

      <div className="planner-content">
        {activeTab === 'today' && (
          <TodayView
            tasks={tasks}
            overdueTasks={overdueTasks}
            categories={SAMPLE_CATEGORIES}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onReschedule={rescheduleTask}
          />
        )}
        {activeTab === 'week' && (
          <WeekView
            tasks={tasks}
            categories={SAMPLE_CATEGORIES}
            onToggle={toggleTask}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            onDayPress={openDayDetail}
          />
        )}
        {activeTab === 'month' && (
          <MonthView
            tasks={tasks}
            categories={SAMPLE_CATEGORIES}
            onDayPress={openDayDetail}
          />
        )}
        {activeTab === 'agenda' && (
          <AgendaView
            tasks={tasks}
            categories={SAMPLE_CATEGORIES}
            onToggle={toggleTask}
            onDelete={deleteTask}
          />
        )}
        {activeTab === 'inbox' && (
          <InboxView
            items={inboxItems}
            categories={SAMPLE_CATEGORIES}
            onSchedule={scheduleInboxItem}
            onDelete={deleteInboxItem}
          />
        )}
      </div>

      <button className="planner-fab" onClick={() => setQuickAddOpen(true)} aria-label="Add task">
        <span>+</span>
      </button>

      {quickAddOpen && (
        <QuickAddSheet
          categories={SAMPLE_CATEGORIES}
          onAdd={addTask}
          onClose={() => setQuickAddOpen(false)}
        />
      )}

      {dayDetailDate && (
        <DayDetailSheet
          date={dayDetailDate}
          tasks={tasks.filter(t => t.date === fmt(dayDetailDate))}
          categories={SAMPLE_CATEGORIES}
          onToggle={toggleTask}
          onClose={() => setDayDetailDate(null)}
          onAddTask={() => { setDayDetailDate(null); setQuickAddOpen(true); }}
        />
      )}
    </div>
  );
}