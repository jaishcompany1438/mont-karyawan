import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSearch,
  RotateCcw,
  ListTodo
} from 'lucide-react';

export default function StatCards({ stats = {}, activeFilter, onCardClick }) {
  const {
    total = 0,
    completed = 0,
    in_progress = 0,
    under_review = 0,
    revision = 0,
    overdue = 0
  } = stats;

  const cards = [
    {
      id: 'ALL',
      title: 'Total Tugas',
      count: total,
      desc: 'Semua tugas terdaftar',
      icon: ListTodo,
      textColor: 'text-slate-900',
      bgColor: 'bg-white',
      borderColor: 'border-slate-200',
      iconBg: 'bg-slate-100 text-slate-700'
    },
    {
      id: 'IN_PROGRESS',
      title: 'Sedang Dikerjakan',
      count: in_progress,
      desc: 'Dalam proses oleh staf',
      icon: Clock,
      textColor: 'text-blue-900',
      bgColor: 'bg-blue-50/50',
      borderColor: 'border-blue-200',
      iconBg: 'bg-blue-100 text-blue-700'
    },
    {
      id: 'UNDER_REVIEW',
      title: 'Menunggu Review',
      count: under_review,
      desc: 'Siap diverifikasi pimpinan',
      icon: FileSearch,
      textColor: 'text-amber-900',
      bgColor: 'bg-amber-50/60',
      borderColor: 'border-amber-200',
      iconBg: 'bg-amber-100 text-amber-700'
    },
    {
      id: 'REVISION',
      title: 'Perlu Revisi',
      count: revision,
      desc: 'Memerlukan perbaikan',
      icon: RotateCcw,
      textColor: 'text-orange-900',
      bgColor: 'bg-orange-50/50',
      borderColor: 'border-orange-200',
      iconBg: 'bg-orange-100 text-orange-700'
    },
    {
      id: 'COMPLETED',
      title: 'Tugas Selesai',
      count: completed,
      desc: 'Telah disetujui tuntas',
      icon: CheckCircle2,
      textColor: 'text-blue-900',
      bgColor: 'bg-blue-50/50',
      borderColor: 'border-blue-200',
      iconBg: 'bg-blue-100 text-blue-700'
    },
    {
      id: 'OVERDUE',
      title: 'Lewat Tenggat (Overdue)',
      count: overdue,
      desc: 'Melewati batas due date',
      icon: AlertTriangle,
      textColor: 'text-rose-900',
      bgColor: 'bg-rose-50/50',
      borderColor: 'border-rose-200',
      iconBg: 'bg-rose-100 text-rose-700'
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = activeFilter === card.id;

        return (
          <div
            key={card.id}
            onClick={() => onCardClick && onCardClick(card.id)}
            className={`p-3.5 rounded-2xl border transition-all ${
              card.bgColor
            } ${card.borderColor} ${
              onCardClick ? 'cursor-pointer hover:shadow-md' : ''
            } ${isSelected ? 'ring-2 ring-blue-600 shadow-md' : 'shadow-sm'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider line-clamp-1">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-xl ${card.iconBg}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className={`text-2xl font-extrabold ${card.textColor}`}>
              {card.count}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
              {card.desc}
            </p>
          </div>
        );
      })}
    </div>
  );
}
