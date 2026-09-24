import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  FileCheck,
  Info,
  Check
} from 'lucide-react';

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.getNotifications();
      if (res.success) {
        setNotifications(res.data || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.error('Gagal mengambil data notifikasi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTypeConfig = (tipe) => {
    switch (tipe) {
      case 'REVISI_PEKERJAAN':
        return {
          icon: AlertTriangle,
          iconColor: 'text-rose-600',
          badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
          cardBg: 'bg-rose-50/50 hover:bg-rose-50/80',
          label: 'Revisi'
        };
      case 'PERINTAH_ATASAN':
        return {
          icon: CheckCircle2,
          iconColor: 'text-blue-600',
          badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
          cardBg: 'bg-blue-50/50 hover:bg-blue-50/80',
          label: 'Perintah Atasan'
        };
      case 'PENGAJUAN_LINTAS_BIDANG':
        return {
          icon: ArrowRightLeft,
          iconColor: 'text-amber-600',
          badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
          cardBg: 'bg-amber-50/50 hover:bg-amber-50/80',
          label: 'Lintas Bidang'
        };
      case 'REVIEW_PEKERJAAN':
        return {
          icon: FileCheck,
          iconColor: 'text-blue-600',
          badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
          cardBg: 'bg-blue-50/50 hover:bg-blue-50/80',
          label: 'Review'
        };
      default:
        return {
          icon: Info,
          iconColor: 'text-slate-600',
          badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
          cardBg: 'bg-slate-50 hover:bg-slate-100',
          label: 'Info'
        };
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Tombol Ikon Lonceng */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        title="Notifikasi"
        className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Konten Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header Dropdown */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Notifikasi</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  {unreadCount} baru
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-800"
              >
                <Check className="h-3 w-3" />
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* List Notifikasi */}
          <div className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto text-xs">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                Belum ada notifikasi.
              </div>
            ) : (
              notifications.map((item) => {
                const config = getTypeConfig(item.tipe);
                const Icon = config.icon;
                const isUnread = !item.is_read;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (isUnread) handleMarkAsRead(item.id);
                    }}
                    className={`cursor-pointer p-3.5 transition ${config.cardBg} ${
                      isUnread ? 'font-medium' : 'opacity-75'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 rounded-lg bg-white p-1.5 shadow-xs shrink-0 ${config.iconColor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${config.badgeBg}`}>
                            {config.label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(item.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 line-clamp-1">{item.judul}</p>
                        <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {item.pesan}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Dropdown */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-2 text-center text-[11px]">
            <span className="text-slate-500">Sistem Monitoring PTQ Imam Ath Thobari</span>
          </div>
        </div>
      )}
    </div>
  );
}

