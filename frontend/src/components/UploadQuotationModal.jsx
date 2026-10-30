import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { apiService } from '../services/api';

export default function UploadQuotationModal({ dealer, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    // Check size limit: 10MB
    if (selected.size > 10 * 1024 * 1024) {
      setError('File exceeds maximum size of 10MB.');
      setFile(null);
      return;
    }

    setError('');
    setFile(selected);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a quotation document to upload.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      const res = await apiService.uploadQuotation(dealer.dealer_id, file);
      
      // Update dealer quotation path or notes if needed
      await apiService.updateDealer(dealer.dealer_id, {
        verification_status: 'Verified',
      });

      setSuccess(`Quotation file '${res.original_name}' uploaded and verified successfully.`);
      if (onSuccess) onSuccess(res.file_path);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-sky-600" />
            <h3 className="text-base font-bold text-slate-800">Upload Formal Quotation</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-lg p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <p className="text-slate-600 mb-2">
              Supplier: <strong className="text-slate-800">{dealer.dealer_name}</strong>
            </p>
            <p className="text-slate-500 mb-3 text-[11px]">
              Supported formats: PDF (.pdf), Excel (.xlsx, .xls), Word (.docx), or image (.png, .jpg). Maximum file size: 10MB.
            </p>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-sky-500 transition-colors bg-slate-50/50 cursor-pointer">
              <input
                type="file"
                id="quote-upload"
                onChange={handleFileChange}
                accept=".pdf,.xlsx,.xls,.docx,.png,.jpg,.jpeg"
                className="hidden"
              />
              <label htmlFor="quote-upload" className="cursor-pointer flex flex-col items-center">
                <FileText className="w-10 h-10 text-slate-400 mb-2" />
                <span className="font-semibold text-slate-700">
                  {file ? file.name : 'Click to select quotation file'}
                </span>
                <span className="text-[11px] text-slate-400 mt-1">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Drop document here'}
                </span>
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || uploading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Uploading...' : 'Save & Attach to Dealer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
