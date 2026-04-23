import { useState, useEffect, useCallback } from 'react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import PlannerTabs from '../components/planner/PlannerTabs';
import PlannerHeader from '../components/planner/PlannerHeader';
import QuickAddSheet from '../components/planner/QuickAddSheet';
import TodayView from '../components/planner/TodayView';
import WeekView from '../components/planner/WeekView';
import MonthView from '../components/planner/MonthView';
import AgendaView from '../components/planner/AgendaView';
import InboxView from '../components/planner/InboxView';
import DayDetailSheet from '../components/planner/DayDetailSheet';
import { fmt } from '../utils/plannerUtils';
import '../styles/planner.css';

const PLANNER_CATEGORIES = [
  { id: 'work', name: 'Work', color: '#1A6BFF' },
  { id: 'health', name: 'Health', color: '#3B6D11' },
  { id: 'personal', name: 'Personal', color: '#534AB7' },
  { id: 'finance', name: 'Finance', color: '#BA7517' },
  { id: 'meetings', name: 'Meetings', color: '#0F6E56' },
  { id: 'errands', name: 'Errands', color: '#993C1D' },
];

const today = new Date();

const getUserDocId = (username) => username?.toLowerCase?.() || '';

const normalizeStringDate = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return '';
};

const normalizeTaskDoc = (docSnap) => {
  const data = docSnap.data() || {};
  return {
    id: data.id || docSnap.id,
    title: data.title || '',
    date: data.date || '',
    time: data.time || '',
    duration: Number(data.duration || 30),
    priority: data.priority || 'none',
    category: data.category || 'work',
    completed: Boolean(data.completed),
    completedAt: normalizeStringDate(data.completedAt) || null,
    isInbox: Boolean(data.isInbox),
    notes: data.notes || '',
    remindAt: data.remindAt || '',
    subtasks: Array.isArray(data.subtasks) ? data.subtasks : [],
    createdAt: normalizeStringDate(data.createdAt) || new Date().toISOString(),
    updatedAt: normalizeStringDate(data.updatedAt) || '',
  };
};

const normalizeInboxDoc = (docSnap) => {
  const data = docSnap.data() || {};
  return {
    id: data.id || docSnap.id,
    title: data.title || '',
    notes: data.notes || '',
    createdAt: normalizeStringDate(data.createdAt) || new Date().toISOString(),
  };
};

const getReminderAt = (date, time, offsetMinutes) => {
  if (!date || !time || offsetMinutes === '') return '';
  const scheduled = new Date(`${date}T${time}:00`);
  if (Number.isNaN(scheduled.getTime())) return '';
  scheduled.setMinutes(scheduled.getMinutes() - Number(offsetMinutes || 0));
  return scheduled.toISOString();
};

export default function Planner({ currentUser }) {
  const userId = getUserDocId(currentUser?.username);

  const [activeTab, setActiveTab] = useState('today');
  const [tasks, setTasks] = useState([]);
  const [inboxItems, setInboxItems] = useState([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [dayDetailDate, setDayDetailDate] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (!userId) {
      setTasks([]);
      setInboxItems([]);
      return undefined;
    }

    const tasksQuery = query(
      collection(db, 'acr_users', userId, 'plannerTasks'),
      orderBy('createdAt', 'asc')
    );
    const inboxQuery = query(
      collection(db, 'acr_users', userId, 'plannerInbox'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeTasks = onSnapshot(tasksQuery, (snap) => {
      setTasks(snap.docs.map(normalizeTaskDoc));
    }, (error) => {
      console.error('Planner tasks sync failed:', error);
      setTasks([]);
    });

    const unsubscribeInbox = onSnapshot(inboxQuery, (snap) => {
      setInboxItems(snap.docs.map(normalizeInboxDoc));
    }, (error) => {
      console.error('Planner inbox sync failed:', error);
      setInboxItems([]);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeInbox();
    };
  }, [userId]);

  const addTask = useCallback((taskData) => {
    if (!userId) return;
    const createdAt = new Date().toISOString();

    if (taskData.isInbox) {
      const inboxRef = doc(collection(db, 'acr_users', userId, 'plannerInbox'));
      const inboxItem = {
        id: inboxRef.id,
        title: taskData.title,
        notes: taskData.notes || '',
        createdAt,
      };

      setInboxItems(prev => [inboxItem, ...prev]);
      setDoc(inboxRef, inboxItem).catch(error => {
        console.error('Failed to save planner inbox item:', error);
        setInboxItems(prev => prev.filter(item => item.id !== inboxItem.id));
      });
      setQuickAddOpen(false);
      return;
    }

    const taskRef = doc(collection(db, 'acr_users', userId, 'plannerTasks'));
    const newTask = {
      id: taskRef.id,
      title: taskData.title,
      date: taskData.date || '',
      time: taskData.time || '',
      duration: taskData.duration || 30,
      priority: taskData.priority || 'none',
      category: taskData.category || 'work',
      completed: false,
      completedAt: null,
      isInbox: taskData.isInbox || false,
      notes: taskData.notes || '',
      remindAt: getReminderAt(taskData.date, taskData.time, taskData.remindAt),
      subtasks: [],
      createdAt,
      updatedAt: createdAt,
    };

    setTasks(prev => [...prev, newTask]);
    setDoc(taskRef, newTask).catch(error => {
      console.error('Failed to save planner task:', error);
      setTasks(prev => prev.filter(task => task.id !== newTask.id));
    });
    setQuickAddOpen(false);
  }, [userId]);

  const toggleTask = useCallback((taskId) => {
    if (!userId) return;
    const existing = tasks.find(t => t.id === taskId);
    if (!existing) return;
    const updatedAt = new Date().toISOString();
    const patch = {
      completed: !existing.completed,
      completedAt: !existing.completed ? updatedAt : null,
      updatedAt,
    };

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t));
    setDoc(doc(db, 'acr_users', userId, 'plannerTasks', taskId), patch, { merge: true }).catch(error => {
      console.error('Failed to update planner task:', error);
      setTasks(prev => prev.map(t => t.id === taskId ? existing : t));
    });
  }, [tasks, userId]);

  const deleteTask = useCallback((taskId) => {
    if (!userId) return;
    const previous = tasks.find(t => t.id === taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    deleteDoc(doc(db, 'acr_users', userId, 'plannerTasks', taskId)).catch(error => {
      console.error('Failed to delete planner task:', error);
      if (previous) setTasks(prev => [...prev, previous]);
    });
  }, [tasks, userId]);

  const rescheduleTask = useCallback((taskId, newDate) => {
    if (!userId) return;
    const existing = tasks.find(t => t.id === taskId);
    if (!existing) return;
    const patch = { date: newDate, updatedAt: new Date().toISOString() };
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t));
    setDoc(doc(db, 'acr_users', userId, 'plannerTasks', taskId), patch, { merge: true }).catch(error => {
      console.error('Failed to reschedule planner task:', error);
      setTasks(prev => prev.map(t => t.id === taskId ? existing : t));
    });
  }, [tasks, userId]);

  const scheduleInboxItem = useCallback((itemId, taskData) => {
    if (!userId) return;
    const item = inboxItems.find(i => i.id === itemId);
    if (!item) return;
    const updatedAt = new Date().toISOString();
    const taskRef = doc(db, 'acr_users', userId, 'plannerTasks', itemId);
    const inboxRef = doc(db, 'acr_users', userId, 'plannerInbox', itemId);
    const scheduledTask = {
      id: itemId,
      title: item.title,
      date: taskData.date || fmt(today),
      time: taskData.time || '',
      duration: taskData.duration || 30,
      priority: taskData.priority || 'none',
      category: taskData.category || 'work',
      completed: false,
      completedAt: null,
      isInbox: false,
      notes: item.notes || '',
      remindAt: getReminderAt(taskData.date, taskData.time, taskData.remindAt),
      subtasks: [],
      createdAt: item.createdAt,
      updatedAt,
    };

    setInboxItems(prev => prev.filter(i => i.id !== itemId));
    setTasks(prev => [...prev, scheduledTask]);

    const batch = writeBatch(db);
    batch.set(taskRef, scheduledTask);
    batch.delete(inboxRef);
    batch.commit().catch(error => {
      console.error('Failed to schedule planner inbox item:', error);
      setInboxItems(prev => [item, ...prev]);
      setTasks(prev => prev.filter(t => t.id !== itemId));
    });
  }, [inboxItems, userId]);

  const deleteInboxItem = useCallback((itemId) => {
    if (!userId) return;
    const previous = inboxItems.find(i => i.id === itemId);
    setInboxItems(prev => prev.filter(i => i.id !== itemId));
    deleteDoc(doc(db, 'acr_users', userId, 'plannerInbox', itemId)).catch(error => {
      console.error('Failed to delete planner inbox item:', error);
      if (previous) setInboxItems(prev => [previous, ...prev]);
    });
  }, [inboxItems, userId]);

  const openDayDetail = useCallback((date) => {
    setDayDetailDate(date);
  }, []);

  const todayStr = fmt(today);
  const plannedTasks = tasks.filter(t => !t.isInbox);
  const overdueTasks = plannedTasks.filter(t => !t.completed && t.date && t.date < todayStr);
  const remainingTasks = plannedTasks.filter(t => !t.completed);
  const doneTasks = plannedTasks.filter(t => t.completed);
  const todayTasks = plannedTasks.filter(t => t.date === todayStr);
  const plannerStats = {
    total: plannedTasks.length,
    remaining: remainingTasks.length,
    done: doneTasks.length,
    overdue: overdueTasks.length,
    today: todayTasks.length,
    inbox: inboxItems.length,
    completionPct: plannedTasks.length ? Math.round((doneTasks.length / plannedTasks.length) * 100) : 0,
  };

  return (
    <div className="planner-root">
      <PlannerHeader activeTab={activeTab} stats={plannerStats} />
      <PlannerTabs activeTab={activeTab} setActiveTab={setActiveTab} inboxCount={inboxItems.length} />

      <div className="planner-content">
        {activeTab === 'today' && (
          <TodayView
            tasks={tasks}
            overdueTasks={overdueTasks}
            categories={PLANNER_CATEGORIES}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onReschedule={rescheduleTask}
          />
        )}
        {activeTab === 'week' && (
          <WeekView
            tasks={tasks}
            categories={PLANNER_CATEGORIES}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onReschedule={rescheduleTask}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            onDayPress={openDayDetail}
          />
        )}
        {activeTab === 'month' && (
          <MonthView
            tasks={tasks}
            categories={PLANNER_CATEGORIES}
            onDayPress={openDayDetail}
          />
        )}
        {activeTab === 'agenda' && (
          <AgendaView
            tasks={tasks}
            categories={PLANNER_CATEGORIES}
            onToggle={toggleTask}
            onDelete={deleteTask}
          />
        )}
        {activeTab === 'inbox' && (
          <InboxView
            items={inboxItems}
            categories={PLANNER_CATEGORIES}
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
          categories={PLANNER_CATEGORIES}
          onAdd={addTask}
          onClose={() => setQuickAddOpen(false)}
        />
      )}

      {dayDetailDate && (
        <DayDetailSheet
          date={dayDetailDate}
          tasks={tasks.filter(t => t.date === fmt(dayDetailDate))}
          categories={PLANNER_CATEGORIES}
          onToggle={toggleTask}
          onClose={() => setDayDetailDate(null)}
          onAddTask={() => { setDayDetailDate(null); setQuickAddOpen(true); }}
        />
      )}
    </div>
  );
}
