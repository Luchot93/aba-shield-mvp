import React, { useState, useEffect, useRef } from 'react';
import { Ico } from './icons.jsx';
import { relTime } from '../utils/notifications.js';

export default function NavBar({ page, setPage, notifications, setNotifications, currentUser }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const notifPanelRef = useRef(null);
  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!notifOpen) return;
    const handler = e => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const markOneRead = id =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const borderColor = u => u === 'urgent' ? '#EF4444' : u === 'warning' ? '#F59E0B' : '#CBD5E1';

  return (
    <>
      <header style={{ background:'#0B1220', borderBottom:'1px solid #1E293B' }}>
        <div className="max-w-full px-6 h-14 flex items-center gap-6">
          <div className="flex items-center gap-2 mr-4 flex-shrink-0" style={{ fontFamily:'Syne, sans-serif' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background:'#0D9488' }}>
              <Ico.Shield />
            </div>
            <span className="text-white font-bold text-[15px] tracking-tight">ABA <span style={{ color:'#2DD4BF' }}>Shield</span></span>
          </div>

          <nav className="flex items-center gap-0.5 flex-1">
            {[['pipeline','Pipeline'],['clients','Clients'],['staff','Staff']].map(([id,label]) => (
              <button key={id} onClick={() => setPage(id)}
                className={`relative px-3.5 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${page===id ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                style={{ fontFamily:'DM Sans, sans-serif' }}>
                {page===id && <span className="absolute inset-0 rounded-md" style={{ background:'rgba(13,148,136,0.25)', border:'1px solid rgba(13,148,136,0.4)' }}/>}
                <span className="relative">{label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              data-testid="bell-btn"
              onClick={() => setNotifOpen(o => !o)}
              className="relative p-2 rounded-md hover:bg-white/5"
              style={{ color:'#94A3B8' }}>
              <Ico.Bell />
              {unread > 0 && (
                <span
                  className="absolute top-1 right-1 inline-flex h-2.5 w-2.5 rounded-full bg-red-500 items-center justify-center text-[8px] font-bold text-white"
                  style={{ animation: 'bellPing 1.5s ease-in-out infinite' }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            <div className="h-5 w-px mx-1" style={{ background:'#1E293B' }}/>
            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                style={{ background:'linear-gradient(135deg,#0D9488,#0284C7)', fontFamily:'DM Sans, sans-serif' }}>AU</div>
              <span className="text-sm text-slate-300" style={{ fontFamily:'DM Sans, sans-serif' }}>{currentUser.name}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Notification panel overlay */}
      {notifOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="flex-1" onClick={() => setNotifOpen(false)}/>
          {/* Panel */}
          <div
            ref={notifPanelRef}
            data-testid="notif-panel"
            className="bg-white shadow-2xl flex flex-col"
            style={{ width:'380px', height:'100vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900" style={{ fontFamily:'Syne, sans-serif' }}>Notifications</span>
                {unread > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">{unread}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    data-testid="mark-all-read"
                    onClick={markAllRead}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-800 transition-colors">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setNotifOpen(false)} className="p-1.5 rounded-lg hover:bg-stone-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <Ico.X/>
                </button>
              </div>
            </div>

            {/* Helper text */}
            <p className="px-5 py-2.5 text-xs text-gray-400 border-b border-stone-100 flex-shrink-0">
              In production, all notifications are also delivered by email to assigned staff.
            </p>

            {/* List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {notifications.length === 0
                ? <div data-testid="notif-empty" className="flex items-center justify-center h-40 text-sm text-slate-400">You're all caught up ✓</div>
                : notifications.map(n => (
                  <div
                    key={n.id}
                    data-testid={`notif-${n.id}`}
                    className="px-4 py-3"
                    style={{
                      borderLeft: `3px solid ${borderColor(n.urgency)}`,
                      background: n.read ? '#fff' : '#FAFAF8',
                      borderBottom: '1px solid #E7E5E0',
                    }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${n.read ? 'font-normal text-slate-500' : 'font-medium text-slate-800'}`}>
                          {n.subject}
                        </p>
                        {n.clientName && (
                          <p className="text-xs text-slate-400 mt-0.5">{n.clientName}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1" style={{ fontFamily:'DM Mono, monospace' }}>
                          {relTime(n.timestamp)}
                        </p>
                      </div>
                      {!n.read && (
                        <button
                          onClick={() => markOneRead(n.id)}
                          className="text-xs text-teal-600 hover:text-teal-800 flex-shrink-0 mt-0.5 transition-colors">
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
}
