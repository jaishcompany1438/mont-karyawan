import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Shield, Briefcase, Building2 } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';

export default function Navbar({ onMenuToggle }) {
  const { user, logout } = useAuth();

  const getRoleBadge = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Super Admin', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'MUDIR':
        return { label: 'Mudir (Pimpinan)', bg: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold' };
      case 'WAKIL_MUDIR':
        return { label: 'Wakil Mudir', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'WADIR_PEND':
        return { label: 'Wadir Pendidikan', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'WADIR_PENGS':
        return { label: 'Wadir Pengasuhan', bg: 'bg-cyan-100 text-cyan-800 border-cyan-200' };
      case 'KABID':
        return { label: 'Kepala Bidang', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'STAF':
        return { label: 'Staf Pelaksana', bg: 'bg-blue-100 text-blue-800 border-blue-200' };
      default:
        return { label: role, bg: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  const badge = getRoleBadge(user?.role);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-700/20">
              <img
                src="/logo.svg"
                alt="Logo PTQ Imam Ath Thobari"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                Monitoring Karyawan & Bidang
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                PTQ Imam Ath Thobari • Versi 2.0
              </p>
            </div>
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="hidden sm:flex flex-col items-end text-right">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-slate-800">{user?.nama}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.bg}`}>
                {badge.label}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
              {user?.nama_bidang && (
                <span className="flex items-center">
                  <Building2 className="w-3 h-3 mr-1 inline" />
                  {user.nama_bidang}
                </span>
              )}
              {user?.jabatan && <span>• {user.jabatan}</span>}
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2">
            <NotificationDropdown />
            <button
              onClick={logout}
              title="Keluar / Logout"
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Keluar</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
