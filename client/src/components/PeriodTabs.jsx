import React from 'react';
import { Calendar, Clock, CalendarDays, CalendarRange, Layers, Zap } from 'lucide-react';

export default function PeriodTabs({ selectedPeriod, onChange, counts = {} }) {
  const tabs = [
    { id: '', label: 'Semua Periode', icon: Layers, badgeKey: 'total' },
    { id: 'HARIAN', label: 'Harian (Daily)', icon: Clock, badgeKey: 'HARIAN' },
    { id: 'PEKANAN', label: 'Pekanan (Weekly)', icon: CalendarDays, badgeKey: 'PEKANAN' },
    { id: 'BULANAN', label: 'Bulanan (Monthly)', icon: CalendarRange, badgeKey: 'BULANAN' },
    { id: 'TAHUNAN', label: 'Tahunan (Annual)', icon: Calendar, badgeKey: 'TAHUNAN' },
    { id: 'INSIDENTAL', label: 'Insidental', icon: Zap, badgeKey: 'INSIDENTAL' },
  ];

  return (
    <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-1.5 items-center">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = (selectedPeriod || '') === tab.id;
        const count = counts[tab.badgeKey] !== undefined ? counts[tab.badgeKey] : null;

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              isActive
                ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
            <span>{tab.label}</span>
            {count !== null && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-emerald-800 text-emerald-100'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
