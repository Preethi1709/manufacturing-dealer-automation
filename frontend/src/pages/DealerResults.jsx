import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  Download,
  Plus,
  ExternalLink,
  Mail,
  Phone,
  FileText,
  Upload,
  ArrowUpDown,
  RefreshCw
} from 'lucide-react';
import { apiService } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ManualSupplierModal from '../components/ManualSupplierModal';
import InquiryModal from '../components/InquiryModal';
import ContactSupplierModal from '../components/ContactSupplierModal';
import UploadQuotationModal from '../components/UploadQuotationModal';

export default function DealerResults() {
  const [searchParams] = useSearchParams();
  const filterReqId = searchParams.get('requirement_id');
  const initialSearchQuery = searchParams.get('search') || searchParams.get('product_name') || '';

  const [dealers, setDealers] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedReqFilter, setSelectedReqFilter] = useState(filterReqId || 'ALL');
  const [selectedMatchFilter, setSelectedMatchFilter] = useState('ALL');
  const [selectedVerifFilter, setSelectedVerifFilter] = useState('ALL');
  const [locationSearch, setLocationSearch] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortField, setSortField] = useState('dealer_name');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    const q = searchParams.get('search') || searchParams.get('product_name');
    if (q) setSearchQuery(q);
    const req = searchParams.get('requirement_id');
    if (req) setSelectedReqFilter(req);
  }, [searchParams]);

  // Modals state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [activeInquiryDealer, setActiveInquiryDealer] = useState(null);
  const [activeUploadDealer, setActiveUploadDealer] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedReqFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const reqParam = selectedReqFilter === 'ALL' ? null : selectedReqFilter;
      const [dealerData, reqData] = await Promise.all([
        apiService.getDealers(reqParam),
        apiService.getRequirements(),
      ]);
      setDealers(dealerData);
      setRequirements(reqData);
    } catch (err) {
      setError('Failed to load dealer results from Excel: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const reqParam = selectedReqFilter === 'ALL' ? null : selectedReqFilter;
      await apiService.exportDealersExcel(reqParam);
    } catch (err) {
      alert('Export failed: ' + (err.message || ''));
    } finally {
      setExporting(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter & Sort Logic
  const filteredDealers = useMemo(() => {
    return dealers
      .filter((d) => {
        // Text search across name, product, specifications, email
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchText = `${d.dealer_name} ${d.product_name} ${d.specifications} ${d.business_email || ''}`.toLowerCase();
          if (!matchText.includes(q)) return false;
        }

        // Match status filter
        if (selectedMatchFilter !== 'ALL' && d.match_status !== selectedMatchFilter) {
          return false;
        }

        // Verification filter
        if (selectedVerifFilter !== 'ALL' && d.verification_status !== selectedVerifFilter) {
          return false;
        }

        // Location filter
        if (locationSearch.trim() && !d.location.toLowerCase().includes(locationSearch.toLowerCase())) {
          return false;
        }

        // Max price filter
        if (maxPrice && !isNaN(parseFloat(maxPrice))) {
          const price = d.confirmed_quoted_price ?? d.listed_price;
          if (price !== null && price !== undefined && price > parseFloat(maxPrice)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'price') {
          valA = a.confirmed_quoted_price ?? a.listed_price ?? 999999;
          valB = b.confirmed_quoted_price ?? b.listed_price ?? 999999;
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [dealers, searchQuery, selectedMatchFilter, selectedVerifFilter, locationSearch, maxPrice, sortField, sortDirection]);

  const activeReqForInquiry = activeInquiryDealer
    ? requirements.find((r) => r.requirement_id === activeInquiryDealer.requirement_id) || {
        requirement_id: activeInquiryDealer.requirement_id,
        product_name: activeInquiryDealer.product_name,
      }
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Discovered Dealer Directory</h2>
          <p className="text-xs text-slate-500">
            Searchable, sortable, and filterable registry of all manufacturing dealers tracked in Excel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{exporting ? 'Exporting...' : 'Export Dealer Results (.xlsx)'}</span>
          </button>
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Keyword Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dealer, part, specs, email..."
              className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Requirement Filter */}
          <div>
            <select
              value={selectedReqFilter}
              onChange={(e) => setSelectedReqFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">All Requirements</option>
              {requirements.map((r) => (
                <option key={r.requirement_id} value={r.requirement_id}>
                  {r.requirement_id} - {r.product_name}
                </option>
              ))}
            </select>
          </div>

          {/* Match Status Filter */}
          <div>
            <select
              value={selectedMatchFilter}
              onChange={(e) => setSelectedMatchFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">All Match Statuses</option>
              <option value="Exact Match">Exact Match</option>
              <option value="Partial Match">Partial Match</option>
              <option value="Needs Verification">Needs Verification</option>
              <option value="Not a Match">Not a Match</option>
            </select>
          </div>

          {/* Verification Status Filter */}
          <div>
            <select
              value={selectedVerifFilter}
              onChange={(e) => setSelectedVerifFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">All Verifications</option>
              <option value="Verified">Verified</option>
              <option value="Pending Verification">Pending Verification</option>
              <option value="Unverified">Unverified</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Max Price Filter */}
          <div>
            <input
              type="number"
              step="0.01"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max Unit Price ($)"
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Applied filters bar & clear action */}
        <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1">
          <span>
            Showing <strong className="text-slate-800">{filteredDealers.length}</strong> of{' '}
            <strong className="text-slate-800">{dealers.length}</strong> suppliers
          </span>
          {(searchQuery || selectedReqFilter !== 'ALL' || selectedMatchFilter !== 'ALL' || selectedVerifFilter !== 'ALL' || maxPrice) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedReqFilter('ALL');
                setSelectedMatchFilter('ALL');
                setSelectedVerifFilter('ALL');
                setLocationSearch('');
                setMaxPrice('');
              }}
              className="text-sky-600 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Dealers Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
            <span>Loading records from Dealer_Results sheet...</span>
          </div>
        ) : filteredDealers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700">No Dealer Results Found</p>
            <p>Try clearing filters or initiate a supplier search to populate the directory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th onClick={() => handleSort('dealer_id')} className="px-4 py-3 cursor-pointer hover:bg-slate-100">
                    <div className="flex items-center gap-1">
                      <span>Dealer ID</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('dealer_name')} className="px-4 py-3 cursor-pointer hover:bg-slate-100">
                    <div className="flex items-center gap-1">
                      <span>Dealer Name</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3">Product Name & Specifications</th>
                  <th className="px-4 py-3">Location</th>
                  <th onClick={() => handleSort('price')} className="px-4 py-3 cursor-pointer hover:bg-slate-100">
                    <div className="flex items-center gap-1">
                      <span>Quoted Price</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3">MOQ</th>
                  <th className="px-4 py-3">Lead Time</th>
                  <th className="px-4 py-3">Match Status</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredDealers.map((d) => (
                  <tr key={d.dealer_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-sky-700 whitespace-nowrap">
                      <Link to={`/dealers/${d.dealer_id}`} className="hover:underline">
                        {d.dealer_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      <Link to={`/dealers/${d.dealer_id}`} className="hover:text-sky-600 transition-colors">
                        {d.dealer_name}
                      </Link>
                      <div className="text-[10px] text-slate-400 font-normal">
                        Via: {d.source_portal}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate" title={d.specifications}>
                      <div className="font-medium text-slate-800">{d.product_name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{d.specifications}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {d.location}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.confirmed_quoted_price !== null && d.confirmed_quoted_price !== undefined ? (
                        <div>
                          <span className="font-bold text-emerald-700">
                            {d.currency} {d.confirmed_quoted_price.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-emerald-600 block">Confirmed RFQ</span>
                        </div>
                      ) : d.listed_price !== null && d.listed_price !== undefined ? (
                        <div>
                          <span className="font-semibold text-slate-800">
                            {d.currency} {d.listed_price.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">Listed Rate</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">RFQ Required</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {d.moq ? d.moq.toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {d.delivery_time || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={d.match_status} type="match" />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={d.verification_status} type="verification" />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                      {d.business_email && (
                        <div className="flex items-center gap-1 text-slate-600 truncate max-w-[140px]" title={d.business_email}>
                          <Mail className="w-3 h-3 text-sky-600 shrink-0" />
                          <span className="truncate">{d.business_email}</span>
                        </div>
                      )}
                      {d.public_contact_number && (
                        <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{d.public_contact_number}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActiveInquiryDealer(d)}
                          className="p-1.5 rounded-md hover:bg-sky-50 text-sky-600 hover:text-sky-700 transition-colors"
                          title="Generate Formal RFQ Inquiry"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setActiveUploadDealer(d)}
                          className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-colors"
                          title="Upload Quotation Document"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        <Link
                          to={`/dealers/${d.dealer_id}`}
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 font-semibold text-[11px] text-slate-700 transition-colors"
                        >
                          Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Supplier Entry Modal */}
      {isManualModalOpen && (
        <ManualSupplierModal
          requirementId={selectedReqFilter === 'ALL' ? null : selectedReqFilter}
          requirements={requirements}
          onClose={() => setIsManualModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {/* Contact Supplier / RFQ Outreach Modal */}
      {activeInquiryDealer && activeReqForInquiry && (
        <ContactSupplierModal
          supplier={activeInquiryDealer}
          requirement={activeReqForInquiry}
          onClose={() => setActiveInquiryDealer(null)}
          onLogged={loadData}
        />
      )}

      {/* Upload Quotation Modal */}
      {activeUploadDealer && (
        <UploadQuotationModal
          dealer={activeUploadDealer}
          onClose={() => setActiveUploadDealer(null)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
