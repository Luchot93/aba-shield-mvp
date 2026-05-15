import React from 'react';

export default function Avatar({ initials, role, size='md' }) {
  const sz = size==='sm' ? 'w-5 h-5 text-[10px]' : size==='lg' ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-xs';
  const color = role==='bcba'
    ? 'bg-teal-50 text-teal-700 border-teal-200'
    : role==='rbt'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <div className={`${sz} ${color} rounded-full border flex items-center justify-center font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}
