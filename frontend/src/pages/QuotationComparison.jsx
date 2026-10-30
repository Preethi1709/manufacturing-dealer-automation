import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  GitCompare,
  Download,
  Award,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  TrendingDown,
  Building2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { apiService } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function QuotationComparison() {
  const [searchParams] = useSearchParams();
  const initialReqId = searchParams.get('requirement_id');

  const [requirements, setRequirements] = useState([]);
  const [selectedReqId, setSelectedReqId] = useState(initialReqId || '');
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRequirements();
  }, []);

  useEffect(() => {
    if (selectedReqId) {
      runComparison(selectedReqId);
    }
  }, [selectedReqId]);

  const loadRequirements = async () => {
    try {
      const data = await apiService.getRequirements();
      setRequirements(data);
      if (!selectedReqId && data.length > 0) {
        setSelectedReqId(data[0].requirement_id);
      }
    } catch (err) {
      setError('Failed to load product requirements: ' + (err.message || ''));
    }
  };

  const runComparison = async (reqId) => {
    try {
      setLoading(true);
      setError('');
      const res = await apiService.compareQuotations(reqId);
      setCompareData(res);
    } catch (err) {
      setCompareData(null);
      setError(err.response?.data?.detail || err.message || 'Comparison failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportComparison = async () => {
    if (!selectedReqId) return;
    try {
      setExporting(true);
      await apiService.exportComparisonExcel(selectedReqId);
    } catch (err) {
      alert('Export failed: ' + (err.message || ''));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quotation Comparison Matrix</h2>
          <p className="text-xs text-slate-500">
            Multi-attribute decision matrix evaluating price competitiveness, technical specification compliance, and lead times.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportComparison}
            disabled={exporting || !compareData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{exporting ? 'Exporting...' : 'Export Comparison (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Requirement Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-xl">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Select Product Requirement to Compare Suppliers:
          </label>
          <select
            value={selectedReqId}
            onChange={(e) => setSelectedReqId(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {requirements.map((r) => (
              <option key={r.requirement_id} value={r.requirement_id}>
                [{r.requirement_id}] {r.product_name} - Target: {r.currency} {r.target_price?.toFixed(2)} (Qty: {r.quantity})
              </option>
            ))}
          </select>
        </div>

        {compareData?.requirement && (
          <div className="text-right text-xs bg-slate-50 p-3 rounded-lg border border-slate-100 hidden md:block">
            <span className="text-[11px] text-slate-400 block font-medium">Requirement Target Benchmark:</span>
            <span className="font-bold text-emerald-700">
              {compareData.requirement.currency} {compareData.requirement.target_price?.toFixed(2)} / unit
            </span>
            <span className="text-slate-500 text-[11px] block">
              Volume: {compareData.requirement.quantity?.toLocaleString()} units • Max Lead: {compareData.requirement.delivery_requirement || 'N/A'}
            </span>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Link
            to={`/search?requirement_id=${selectedReqId}`}
            className="px-3 py-1 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors"
          >
            Search Suppliers
          </Link>
        </div>
      )}

      {/* Multi-attribute Recommendation Banner */}
      {compareData?.recommendation_summary && (
        <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-900 to-slate-900 text-white shadow-md flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/30 text-emerald-300 uppercase tracking-wide">
                Intelligent Procurement Recommendation
              </span>
              <span className="text-xs text-slate-300 font-mono">
                [Balanced Spec Match + Delivery Schedule + Cost]
              </span>
            </div>
            <h4 className="text-sm font-bold text-white">
              {compareData.recommendation_summary}
            </h4>
            <p className="text-[11px] text-slate-300">
              Notice: The lowest unit price is not automatically selected if specifications do not align with engineering requirements or lead times jeopardize production.
            </p>
          </div>
        </div>
      )}

      {/* Quotation Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Supplier Quotation & Cost Breakdown Matrix ({compareData?.comparisons?.length || 0})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Primary storage sync: Quotation_Comparison worksheet
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
            <span>Calculating comparative cost components...</span>
          </div>
        ) : !compareData || compareData.comparisons.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <GitCompare className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700">No Suppliers Available for this Requirement</p>
            <p>Add discovered dealers or initiate a search to run supplier comparisons.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">Unit Price</th>
                  <th className="px-4 py-3">Target Diff</th>
                  <th className="px-4 py-3">Order Qty</th>
                  <th className="px-4 py-3">Taxes / VAT</th>
                  <th className="px-4 py-3">Delivery Charges</th>
                  <th className="px-4 py-3">Estimated Total Cost</th>
                  <th className="px-4 py-3">MOQ</th>
                  <th className="px-4 py-3">Lead Time</th>
                  <th className="px-4 py-3">Spec Match</th>
                  <th className="px-4 py-3">Score / Fit</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {compareData.comparisons.map((c) => {
                  const isRecommended = c.dealer_id === compareData.recommended_dealer_id;
                  const targetPrice = compareData.requirement?.target_price || 0;
                  const priceDiff = c.unit_price ? c.unit_price - targetPrice : null;

                  return (
                    <tr
                      key={c.dealer_id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isRecommended ? 'bg-emerald-50/40 border-l-4 border-l-emerald-500' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isRecommended && <Award className="w-4 h-4 text-emerald-600 shrink-0" />}
                          <Link to={`/dealers/${c.dealer_id}`} className="hover:text-sky-600">
                            {c.dealer_name}
                          </Link>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {c.dealer_id}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-bold whitespace-nowrap">
                        {c.unit_price !== null && c.unit_price !== undefined ? (
                          <span className="text-slate-900">
                            {c.currency} {c.unit_price.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unquoted</span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                        {priceDiff !== null ? (
                          priceDiff <= 0 ? (
                            <span className="text-emerald-700 font-semibold">
                              -${Math.abs(priceDiff).toFixed(2)} (Savings)
                            </span>
                          ) : (
                            <span className="text-rose-600 font-semibold">
                              +${priceDiff.toFixed(2)} (Over)
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap font-medium">
                        {c.quantity?.toLocaleString()}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {c.taxes !== null && c.taxes !== undefined ? (
                          `${c.currency} ${c.taxes.toFixed(2)}`
                        ) : (
                          <span className="text-amber-600 font-medium text-[11px] flex items-center gap-1">
                            <HelpCircle className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>Unconfirmed</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {c.delivery_charges !== null && c.delivery_charges !== undefined ? (
                          `${c.currency} ${c.delivery_charges.toFixed(2)}`
                        ) : (
                          <span className="text-amber-600 font-medium text-[11px] flex items-center gap-1">
                            <HelpCircle className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>Unconfirmed</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.estimated_total_cost !== null && c.estimated_total_cost !== undefined ? (
                          <div>
                            <span className="font-bold text-slate-900 text-sm">
                              {c.currency} {c.estimated_total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {c.has_unconfirmed_costs && (
                              <span className="text-[10px] text-amber-600 block flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>Partial (Excl. missing costs)</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pending Quotes</span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {c.moq ? c.moq.toLocaleString() : 'N/A'}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {c.delivery_time || 'Standard'}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={c.match_status} type="match" />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.recommendation_score ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${
                                  c.recommendation_score > 75
                                    ? 'bg-emerald-500'
                                    : c.recommendation_score > 50
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(c.recommendation_score, 100)}%` }}
                              />
                            </div>
                            <span className="font-bold text-[11px] text-slate-700">
                              {c.recommendation_score}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          to={`/dealers/${c.dealer_id}`}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
