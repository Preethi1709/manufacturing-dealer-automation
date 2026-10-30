import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { apiService } from '../services/api';

const TITLE_MAP = {
  '/': 'Manufacturing Procurement Dashboard',
  '/requirements': 'Product Requirements Management',
  '/search': 'Automated Dealer Sourcing & Portal Discovery',
  '/dealers': 'Discovered Supplier Results & Matching Directory',
  '/comparison': 'Multi-Supplier Quotation Matrix & Evaluation',
  '/contacts': 'Supplier Outreach & Follow-up Communications',
};

export default function Navbar({ onRefresh }) {
  const location = useLocation();
  const [healthy, setHealthy] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      await apiService.getHealth();
      setHealthy(true);
    } catch {
      setHealthy(false);
    }
  };

  const handleExportTracker = async () => {
    try {
      setExporting(true);
      await apiService.exportDealersExcel();
    } catch (err) {
      alert('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  const currentTitle = TITLE_MAP[location.pathname] || 'Manufacturing Dealer Automation';

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h2 className="text-base font-bold text-slate-800">{currentTitle}</h2>
        <p className="text-xs text-slate-500">Production Sourcing & Supply Chain Operations</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Backend Connectivity Status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          {healthy ? (
            <>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>FastAPI Connected</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Backend Offline</span>
            </>
          )}
        </div>

        {/* Global Export Button */}
        <button
          onClick={handleExportTracker}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50"
          title="Export current Dealer_Results sheet to formatted Excel workbook"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
        </button>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Refresh current view"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
