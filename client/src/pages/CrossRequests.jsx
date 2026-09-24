import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CrossDepartmentTaskForm from '../components/CrossDepartmentTaskForm';
import {
  ArrowRightLeft,
  PlusCircle,
  Paperclip,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Calendar,
  AlertCircle,
  Filter,
  RefreshCw
} from 'lucide-react';

export default function CrossRequests({ refreshKey, onRefresh }) {
  const { user } = useAuth();
  const role = user?.role;
  const userBidangId = user?.bidang_id;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'INCOMING', 'OUTGOING'
  const [filterStatus, setFilterStatus] = useState(''); // '', 'PENDING', 'APPROVED', 'REJECTED'

  // Modal Respond (Approve / Reject)
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [respondAction, setRespondAction] = useState(''); // 'APPROVED' or 'REJECTED'
  const [respondNotes, setRespondNotes] = useState('');
  const [respondLoading, setRespondLoading] = useState(false);

  // Bawahan bidang (STAF) tidak memiliki izin mengakses fitur ini
  const isBawahan = role === 'STAF';

  const loadRequests = async () => {
    if (isBawahan) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.getCrossRequests();
      if (res.success) {
        setRequests(res.data || []);
      }
    } catch (err) {
      setError(err.message || 'Gagal mengambil data pengajuan tugas lintas bidang.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [refreshKey, isBawahan]);

  const handleRespondSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !respondAction) return;

    try {
      setRespondLoading(true);
      await api.respondCrossRequest(selectedRequest.id, {
        status: respondAction,
        catatan_tanggapan: respondNotes.trim() || null
      });

      setSelectedRequest(null);
      setRespondAction('');
      setRespondNotes('');
      loadRequests();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Gagal memproses tanggapan.');
    } finally {
      setRespondLoading(false);
    }
  };

  if (isBawahan) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-800">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-600 mb-2" />
        <h3 className="text-base font-bold">Akses Terbatas</h3>
        <p className="mt-1 text-xs text-rose-700 max-w-md mx-auto">
          Fitur pengajuan tugas lintas bidang hanya dapat diakses oleh Kepala Bidang (Kabid) dan Pimpinan Lembaga.
          Bawahan bidang / staf tidak memiliki izin untuk mengakses halaman ini.
        </p>
      </div>
    );
  }

  // Filtering
  const filteredRequests = requests.filter((req) => {
    if (filterType === 'INCOMING' && req.target_bidang_id !== userBidangId) return false;
    if (filterType === 'OUTGOING' && req.from_user_id !== user.id && req.from_bidang_id !== userBidangId) return false;
    if (filterStatus && req.status !== filterStatus) return false;
    return true;
  });

  const getUrgencyBadge = (u) => {
    switch (u) {
      case 'URGEN': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'TINGGI': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SEDANG': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case 'APPROVED': return { label: 'Disetujui', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'REJECTED': return { label: 'Ditolak', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
      default: return { label: 'Menunggu Tanggapan', cls: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Kolaborasi Antar Divisi</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Tugas Lintas Bidang</h2>
          <p className="mt-1 text-xs text-slate-500">
            Kelola permohonan pengerjaan tugas dan koordinasi antar bidang di lingkungan PTQ Imam Ath Thobari.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFormModal(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-700/20 hover:bg-blue-600 transition"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Buat Pengajuan Tugas</span>
          </button>
          <button
            onClick={loadRequests}
            title="Segarkan data"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterType === 'ALL' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua ({requests.length})
          </button>
          <button
            onClick={() => setFilterType('INCOMING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterType === 'INCOMING' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pengajuan Masuk
          </button>
          <button
            onClick={() => setFilterType('OUTGOING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterType === 'OUTGOING' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pengajuan Terkirim
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Status</option>
            <option value="PENDING">Menunggu</option>
            <option value="APPROVED">Disetujui</option>
            <option value="REJECTED">Ditolak</option>
          </select>
        </div>
      </div>

      {/* Grid of Requests */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">
          Memuat data pengajuan tugas lintas bidang...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
          Tidak ada pengajuan tugas lintas bidang yang sesuai dengan filter.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRequests.map((item) => {
            const urgencyBadge = getUrgencyBadge(item.urgensi);
            const statusBadge = getStatusBadge(item.status);
            const canRespond =
              item.status === 'PENDING' &&
              (['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS'].includes(role) ||
                (role === 'KABID' && item.target_bidang_id === userBidangId));

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-1 mb-2.5">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${urgencyBadge}`}>
                      Urgensi: {item.urgensi}
                    </span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${statusBadge.cls}`}>
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h4 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug mb-1.5">
                    {item.judul}
                  </h4>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-3">
                    {item.deskripsi}
                  </p>

                  {/* Catatan Tanggapan if any */}
                  {item.catatan_tanggapan && (
                    <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-700">
                      <span className="font-bold text-slate-900 block mb-0.5">Catatan Tanggapan:</span>
                      {item.catatan_tanggapan}
                    </div>
                  )}

                  {/* Route: From -> To */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-[11px] space-y-1.5 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Pengaju:</span>
                      <strong className="text-slate-800">{item.from_user_nama}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Bidang Asal:</span>
                      <span className="font-semibold text-slate-700">{item.from_bidang_nama}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-1">
                      <span className="text-slate-400">Bidang Tujuan:</span>
                      <strong className="text-blue-800">{item.target_bidang_nama}</strong>
                    </div>
                  </div>

                  {/* Meta: Due Date & Attachment */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      <span>{new Date(item.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>

                    {item.file_attachment && (
                      <a
                        href={item.file_attachment}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                      >
                        <Paperclip className="h-3 w-3" /> Berkas
                      </a>
                    )}
                  </div>
                </div>

                {/* Respond Action Buttons */}
                {canRespond && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedRequest(item);
                        setRespondAction('APPROVED');
                      }}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Setujui</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRequest(item);
                        setRespondAction('REJECTED');
                      }}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Tolak</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form Buat Pengajuan */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xl w-full">
            <CrossDepartmentTaskForm
              onSubmitSuccess={() => {
                setShowFormModal(false);
                loadRequests();
                if (onRefresh) onRefresh();
              }}
              onCancel={() => setShowFormModal(false)}
            />
          </div>
        </div>
      )}

      {/* Modal Tanggapan (Approve / Reject) */}
      {selectedRequest && respondAction && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {respondAction === 'APPROVED' ? 'Setujui Pengajuan Tugas' : 'Tolak Pengajuan Tugas'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Tugas: <strong>{selectedRequest.judul}</strong> (dari {selectedRequest.from_bidang_nama})
            </p>

            <form onSubmit={handleRespondSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Tanggapan / Arahan Pengerjaan (Opsional)
                </label>
                <textarea
                  rows="3"
                  placeholder="Berikan catatan kepada pemohon..."
                  value={respondNotes}
                  onChange={(e) => setRespondNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRequest(null);
                    setRespondAction('');
                  }}
                  className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={respondLoading}
                  className={`rounded-xl px-4 py-2 font-bold text-white transition ${
                    respondAction === 'APPROVED'
                      ? 'bg-blue-700 hover:bg-blue-600 shadow-md shadow-blue-700/20'
                      : 'bg-rose-700 hover:bg-rose-600 shadow-md shadow-rose-700/20'
                  }`}
                >
                  {respondLoading ? 'Menyimpan...' : respondAction === 'APPROVED' ? 'Konfirmasi Setujui' : 'Konfirmasi Tolak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
