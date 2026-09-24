import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SuccessToast from './SuccessToast';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';

export default function ExcelUploadModal({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks', 'karyawan', 'bidang'
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const tabs = [
    { id: 'tasks', label: 'Tugas Batch', endpoint: 'tasks', templateType: 'tugas', templateFile: 'template_tugas.xlsx' },
    ...(user?.role === 'SUPER_ADMIN'
      ? [
          { id: 'karyawan', label: 'Master Karyawan', endpoint: 'karyawan', templateType: 'karyawan', templateFile: 'template_karyawan.xlsx' },
          { id: 'bidang', label: 'Master Bidang', endpoint: 'bidang', templateType: 'bidang', templateFile: 'template_bidang.xlsx' },
        ]
      : []),
  ];

  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setFile(null);
    setResult(null);
    setError('');
    setSuccess('');
  };

  const handleDownloadTemplate = () => {
    const url = api.getTemplateDownloadUrl(currentTab.templateType);
    window.open(url, '_blank');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Silakan pilih berkas Excel (.xlsx) terlebih dahulu.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResult(null);

      const res = await api.importFile(currentTab.endpoint, file);
      setResult(res);
      setSuccess(res.message || 'Data berhasil diimpor.');
      if (res.importedCount > 0 && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err.message || 'Gagal mengimpor berkas Excel.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <SuccessToast message={success} onClose={() => setSuccess('')} />
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Import & Export Data Excel
              </h3>
              <p className="text-xs text-slate-500">
                Unggah data massal atau unduh template Excel resmi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Step 1: Download Template */}
          <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                Langkah 1: Gunakan Format Resmi
              </span>
              <p className="text-slate-600 mt-0.5">
                Unduh template resmi: <strong className="text-slate-900">{currentTab.templateFile}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-sm transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Template</span>
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Success / Result Feedback */}
          {result && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center space-x-2 text-blue-700 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>{result.message}</span>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <span className="font-bold block mb-1">Catatan Peringatan:</span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {result.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>...dan {result.errors.length - 5} baris lainnya</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Upload */}
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Langkah 2: Pilih File Excel Yang Telah Diisi (.xlsx)
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-blue-500 transition-colors bg-slate-50/50">
                <FileSpreadsheet className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => {
                    setFile(e.target.files[0] || null);
                    setError('');
                    setResult(null);
                  }}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {file && (
                  <p className="text-blue-700 font-bold text-xs mt-2">
                    Berkas terpilih: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={loading || !file}
                className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold shadow-md shadow-blue-700/20 disabled:opacity-50 flex items-center space-x-1.5"
              >
                <Upload className="w-4 h-4" />
                <span>{loading ? 'Memproses...' : 'Mulai Import Data'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </>
  );
}
