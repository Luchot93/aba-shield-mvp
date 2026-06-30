import React, { useState, useEffect, useRef } from 'react';
import { Ico } from './icons.jsx';
import { relTime } from '../utils/notifications.js';
import { SEED_USERS } from '../constants/seedData.js';
import { isAdmin } from '../utils/permissions.js';
import { FLAGS } from '../constants/featureFlags.js';

const ROLE_BADGE = {
  admin: 'bg-purple-500/20 text-purple-300',
  bcba:  'bg-teal-500/20 text-teal-300',
  bcaba: 'bg-teal-500/20 text-teal-300',
  rbt:   'bg-blue-500/20 text-blue-300',
};

const initials = name => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

export default function NavBar({ page, setPage, notifications, setNotifications, currentUser, setCurrentUser, onLogout }) {
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [switcherOpen,  setSwitcherOpen]  = useState(false);
  const notifPanelRef  = useRef(null);
  const switcherRef    = useRef(null);
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

  useEffect(() => {
    if (!switcherOpen) return;
    const handler = e => {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [switcherOpen]);

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const markOneRead = id =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const rowBg = (urgency, read) => {
    if (urgency === 'urgent')  return read ? 'bg-red-50/40'    : 'bg-red-50/70';
    if (urgency === 'warning') return read ? 'bg-amber-50/40'  : 'bg-amber-50/70';
    return read ? 'bg-white' : 'bg-stone-50';
  };

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
            {[
              ...(FLAGS.METRICS && isAdmin(currentUser?.role) ? [['metrics','Metrics']] : []),
              ...(FLAGS.PIPELINE ? [['pipeline','Pipeline']] : []),
              ['clients','Clients'],
              ['assessments','Assessments'],
              ...(FLAGS.STAFF ? [['staff','Staff']] : []),
            ].map(([id,label]) => (
              <button key={id} onClick={() => setPage(id)}
                className={`relative px-3.5 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${page===id ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                style={{ fontFamily:'DM Sans, sans-serif' }}>
                {page===id && <span className="absolute inset-0 rounded-md" style={{ background:'rgba(13,148,136,0.25)', border:'1px solid rgba(13,148,136,0.4)' }}/>}
                <span className="relative">{label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {FLAGS.PIPELINE && (
              <>
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
              </>
            )}

            {/* Role switcher */}
            <div className="relative" ref={switcherRef}>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500 mb-0.5 pr-1">Testing as:</span>
                <button
                  onClick={() => setSwitcherOpen(o => !o)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: switcherOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  onMouseLeave={e => !switcherOpen && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0"
                    style={{ background:'#0D9488', fontFamily:'DM Sans, sans-serif' }}>
                    {initials(currentUser.name)}
                  </div>
                  <span className="text-sm text-white" style={{ fontFamily:'DM Sans, sans-serif' }}>{currentUser.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${ROLE_BADGE[currentUser.role] || ROLE_BADGE.rbt}`}>
                    {currentUser.role}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-slate-400 flex-shrink-0">
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {switcherOpen && (
                <div className="absolute right-0 top-full mt-1 rounded-xl shadow-xl z-50 overflow-hidden border"
                  style={{ background:'#1E293B', borderColor:'rgba(255,255,255,0.1)', minWidth:'220px' }}>
                  {SEED_USERS.map(u => (
                    <button key={u.id}
                      onClick={() => { setCurrentUser(u); setSwitcherOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                      style={{ color:'white' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0"
                        style={{ background:'#0D9488' }}>
                        {initials(u.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{u.name}</div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${ROLE_BADGE[u.role] || ROLE_BADGE.rbt}`}>
                        {u.role}
                      </span>
                      {currentUser.id === u.id && (
                        <span className="text-teal-400 text-xs flex-shrink-0">✓</span>
                      )}
                    </button>
                  ))}
                  <div className="border-t mt-1 pt-1" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <button
                      onClick={() => { setSwitcherOpen(false); onLogout?.(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors text-slate-400 hover:text-white"
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      <span className="text-sm">Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Notification panel overlay */}
      {FLAGS.PIPELINE && notifOpen && (
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
                    className={`px-4 py-3 border-b border-stone-100 ${rowBg(n.urgency, n.read)}`}>
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
