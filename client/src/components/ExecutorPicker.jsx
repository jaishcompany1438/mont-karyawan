import React from 'react';

export default function ExecutorPicker({ options, selectedIds, onChange, loading, helpText }) {
  return (
    <div>
      <span className="mb-1 block font-bold text-slate-700">Pelaksana Tugas *</span>
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-300 bg-white p-2">
        {options.map((item) => {
          const id = String(item.id);
          return (
            <label key={id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-blue-50">
              <input
                type="checkbox"
                checked={selectedIds.includes(id)}
                onChange={(event) => onChange(id, event.target.checked)}
                className="mt-0.5 accent-blue-700"
              />
              <span>{item.nama}{item.jabatan ? ` · ${item.jabatan}` : ''}{item.nama_bidang ? ` (${item.nama_bidang})` : ''}</span>
            </label>
          );
        })}
        {!options.length && (
          <p className="p-2 text-xs text-slate-400">
            {loading ? 'Memuat daftar pengguna...' : 'Belum ada pengguna untuk dipilih.'}
          </p>
        )}
      </div>
      <p className="mt-1 text-[10px] text-slate-500">
        {helpText || 'Pilih satu atau beberapa orang yang tercatat melaksanakan tugas.'}
      </p>
    </div>
  );
}
