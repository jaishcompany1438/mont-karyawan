import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  CheckSquare,
  FileSpreadsheet,
  Building,
  Users,
  PlusCircle,
  Upload,
  FileDown
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  onOpenCreateTask,
  onOpenUploadExcel,
  isOpen,
  onClose
}) {
  const { user } = useAuth();
  const role = user?.role;

  const canCreateTask = ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'KABID'].includes(role);
  const canManageBidang = ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR'].includes(role);
  const canManageUsers = ['SUPER_ADMIN', 'MUDIR'].includes(role);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard Utama', icon: LayoutDashboard },
    { id: 'tasks', label: 'Manajemen Tugas', icon: CheckSquare },
    { id: 'reports', label: 'Laporan & Rekap', icon: FileSpreadsheet },
  ];

  if (canManageBidang) {
    navItems.push({ id: 'departments', label: 'Struktur Bidang', icon: Building });
  }

  if (canManageUsers) {
    navItems.push({ id: 'users', label: 'Data Pengguna', icon: Users });
  }

  const handleSelect = (id) => {
    setActiveTab(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:sticky top-0 md:top-[61px] z-40 md:z-20 h-full md:h-[calc(100vh-61px)] w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Quick Actions Header */}
        <div className="p-4 border-b border-slate-800 space-y-2">
          {canCreateTask && (
            <button
              onClick={() => {
                if (onClose) onClose();
                onOpenCreateTask();
              }}
              className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-4 rounded-xl shadow-md shadow-emerald-900/30 transition-all text-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Buat Tugas Baru</span>
            </button>
          )}

          {canCreateTask && (
            <button
              onClick={() => {
                if (onClose) onClose();
                onOpenUploadExcel();
              }}
              className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium py-2 px-4 rounded-xl transition-all text-xs"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Import via Excel</span>
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Menu Utama
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-700 text-white font-semibold shadow-sm shadow-emerald-900/50'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400">
          <p className="font-semibold text-slate-300">Aplikasi Monitoring</p>
          <p className="text-slate-500">PTQ Imam Ath Thobari</p>
        </div>
      </aside>
    </>
  );
}
