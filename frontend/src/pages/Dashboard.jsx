import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  ArrowRight,
  Search,
  PlusCircle,
  GitCompare,
  TrendingUp,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { apiService } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiService.getDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      setError('Failed to load dashboard metrics from backend. Ensure FastAPI server is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading procurement telemetry from Excel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3">
        <h3 className="font-bold text-sm">Dashboard Connection Error</h3>
        <p className="text-xs">{error}</p>
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/20 text-sky-300 border border-sky-400/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Excel Primary Data Store: Dealer_Sourcing_Tracker.xlsx</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Manufacturing Sourcing Command Center</h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Automating dealer discovery, technical specification matching, price benchmarking, and Request for Quotation (RFQ) follow-ups.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/requirements"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Requirement</span>
          </Link>
          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Discover Suppliers</span>
          </Link>
          <Link
            to="/comparison"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          >
            <GitCompare className="w-4 h-4" />
            <span>Compare Quotes</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Products */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Requirements</span>
            <FileSpreadsheet className="w-4 h-4 text-sky-600" />
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-900">{metrics?.total_products_submitted || 0}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Active BOM lines</span>
          </div>
        </div>

        {/* Total Dealers */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Suppliers Identified</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-900">{metrics?.total_dealers_discovered || 0}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Catalogued sources</span>
          </div>
        </div>

        {/* Exact Matches */}
        <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-semibold">Exact Matches</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-2xl font-bold text-emerald-700">{metrics?.exact_matches || 0}</span>
            <span className="text-[11px] text-emerald-600 block mt-0.5">100% Spec & Price fit</span>
          </div>
        </div>

        {/* Partial Matches */}
        <div className="bg-white p-4 rounded-xl border border-amber-100 bg-amber-50/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-xs font-semibold">Partial Matches</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <span className="text-2xl font-bold text-amber-700">{metrics?.partial_matches || 0}</span>
            <span className="text-[11px] text-amber-600 block mt-0.5">Within tolerance</span>
          </div>
        </div>

        {/* Quotations Received */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Quotes Received</span>
            <FileText className="w-4 h-4 text-sky-600" />
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-900">{metrics?.quotations_received || 0}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Formal quoted rates</span>
          </div>
        </div>

        {/* Pending Responses */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Pending RFQs</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-900">{metrics?.pending_dealer_responses || 0}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Awaiting submission</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Searches & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Searches */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Recent Supplier Searches
              </h3>
            </div>
            <Link to="/search" className="text-xs font-semibold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1">
              <span>Run Search</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {metrics?.recent_searches && metrics.recent_searches.length > 0 ? (
              metrics.recent_searches.map((s) => (
                <div key={s.search_id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{s.product_name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-600">
                        {s.search_id}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                      <span>Portal: <strong className="text-slate-700">{s.portal}</strong></span>
                      <span>•</span>
                      <span>{s.date}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                      {s.results_count} found
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                No recent searches logged yet. Launch a search to discover verified suppliers.
              </div>
            )}
          </div>
        </div>

        {/* Recent Dealer Activities */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Recent Supplier Activities
              </h3>
            </div>
            <Link to="/dealers" className="text-xs font-semibold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1">
              <span>View Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {metrics?.recent_dealer_activities && metrics.recent_dealer_activities.length > 0 ? (
              metrics.recent_dealer_activities.map((d) => (
                <div key={d.dealer_id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/dealers/${d.dealer_id}`}
                        className="text-xs font-bold text-slate-800 hover:text-sky-600 transition-colors"
                      >
                        {d.dealer_name}
                      </Link>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                        {d.dealer_id}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.product_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.match_status} type="match" />
                    <StatusBadge status={d.verification_status} type="verification" />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                No supplier records discovered yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
