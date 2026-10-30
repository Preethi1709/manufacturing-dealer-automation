import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Phone,
  Globe,
  Upload,
  FileText,
  Clock,
  Download,
  Edit2,
  Save,
  X,
  ShieldCheck,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { apiService } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import InquiryModal from '../components/InquiryModal';
import UploadQuotationModal from '../components/UploadQuotationModal';

export default function DealerDetails() {
  const { dealerId } = useParams();
  const navigate = useNavigate();

  const [dealer, setDealer] = useState(null);
  const [requirement, setRequirement] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Modals
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    loadDealerData();
  }, [dealerId]);

  const loadDealerData = async () => {
    try {
      setLoading(true);
      setError('');
      const d = await apiService.getDealerById(dealerId);
      setDealer(d);
      setEditForm({
        dealer_name: d.dealer_name,
        product_name: d.product_name,
        specifications: d.specifications,
        public_contact_number: d.public_contact_number || '',
        business_email: d.business_email || '',
        location: d.location,
        listed_price: d.listed_price !== null ? d.listed_price : '',
        confirmed_quoted_price: d.confirmed_quoted_price !== null ? d.confirmed_quoted_price : '',
        moq: d.moq !== null ? d.moq : '',
        delivery_time: d.delivery_time || '',
        verification_status: d.verification_status,
        product_url: d.product_url || '',
      });

      // Load associated requirement
      if (d.requirement_id) {
        try {
          const req = await apiService.getRequirementById(d.requirement_id);
          setRequirement(req);
        } catch {
          // Keep null if not found
        }
      }

      // Load associated contact history
      const contactLog = await apiService.getContacts(dealerId);
      setContacts(contactLog);
    } catch (err) {
      setError('Failed to load dealer profile: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveUpdates = async (e) => {
    e.preventDefault();
    try {
      setSaveSuccess('');
      const payload = {
        ...editForm,
        listed_price: editForm.listed_price ? parseFloat(editForm.listed_price) : null,
        confirmed_quoted_price: editForm.confirmed_quoted_price ? parseFloat(editForm.confirmed_quoted_price) : null,
        moq: editForm.moq ? parseFloat(editForm.moq) : null,
      };

      const updated = await apiService.updateDealer(dealerId, payload);
      setDealer(updated);
      setIsEditing(false);
      setSaveSuccess('Supplier details and Excel record updated successfully.');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      alert('Failed to update dealer: ' + (err.message || ''));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Fetching supplier profile from Excel...</p>
      </div>
    );
  }

  if (error || !dealer) {
    return (
      <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3">
        <h3 className="font-bold text-sm">Supplier Not Found</h3>
        <p className="text-xs">{error || `No supplier found with ID '${dealerId}'`}</p>
        <button
          onClick={() => navigate('/dealers')}
          className="px-4 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dealers')}
            className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
            title="Back to Directory"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">{dealer.dealer_name}</h2>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                {dealer.dealer_id}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Discovered via {dealer.source_portal} • Created on {dealer.created_at}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsInquiryModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Generate RFQ</span>
              </button>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
              >
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Upload Quote</span>
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white shadow-sm transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Main Grid: Details + Verification + Match Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Profile Information / Edit Form */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Supplier Profile & Commercial Terms
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={dealer.match_status} type="match" />
              <StatusBadge status={dealer.verification_status} type="verification" />
            </div>
          </div>

          {!isEditing ? (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Product / Component</span>
                  <span className="text-sm font-bold text-slate-800">{dealer.product_name}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Manufacturing Location</span>
                  <span className="font-semibold text-slate-700">{dealer.location}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block font-medium mb-1">
                  Catalog Specifications & Tolerances
                </span>
                <p className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-700 leading-relaxed font-mono">
                  {dealer.specifications}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50/70 border border-slate-200/60">
                <div>
                  <span className="text-[11px] text-slate-400 block">Catalog Listed Price</span>
                  <span className="font-semibold text-slate-700">
                    {dealer.listed_price !== null ? `${dealer.currency} ${dealer.listed_price?.toFixed(2)}` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Confirmed Quoted Price</span>
                  <span className="font-bold text-emerald-700">
                    {dealer.confirmed_quoted_price !== null
                      ? `${dealer.currency} ${dealer.confirmed_quoted_price?.toFixed(2)}`
                      : 'Pending RFQ'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Minimum Order Qty</span>
                  <span className="font-semibold text-slate-700">
                    {dealer.moq ? dealer.moq.toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Quoted Lead Time</span>
                  <span className="font-semibold text-slate-700">
                    {dealer.delivery_time || 'Standard'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5">Verified Contact Email</span>
                  {dealer.business_email ? (
                    <a href={`mailto:${dealer.business_email}`} className="text-sky-600 hover:underline flex items-center gap-1 font-semibold">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{dealer.business_email}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400">Not provided</span>
                  )}
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5">Public Business Telephone</span>
                  {dealer.public_contact_number ? (
                    <span className="text-slate-700 flex items-center gap-1 font-semibold">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dealer.public_contact_number}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">Not provided</span>
                  )}
                </div>
              </div>

              {dealer.product_url && (
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5">Official Product / Catalog Webpage</span>
                  <a
                    href={dealer.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    <span>{dealer.product_url}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            /* Editing Form */
            <form onSubmit={handleSaveUpdates} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Dealer Name</label>
                  <input
                    type="text"
                    name="dealer_name"
                    value={editForm.dealer_name}
                    onChange={handleEditChange}
                    required
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Offered Product Name</label>
                  <input
                    type="text"
                    name="product_name"
                    value={editForm.product_name}
                    onChange={handleEditChange}
                    required
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Manufacturing Location</label>
                  <input
                    type="text"
                    name="location"
                    value={editForm.location}
                    onChange={handleEditChange}
                    required
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Verification Status</label>
                  <select
                    name="verification_status"
                    value={editForm.verification_status}
                    onChange={handleEditChange}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white"
                  >
                    <option value="Verified">Verified</option>
                    <option value="Pending Verification">Pending Verification</option>
                    <option value="Unverified">Unverified</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catalog Listed Price</label>
                  <input
                    type="number"
                    step="0.01"
                    name="listed_price"
                    value={editForm.listed_price}
                    onChange={handleEditChange}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Confirmed Quoted Price</label>
                  <input
                    type="number"
                    step="0.01"
                    name="confirmed_quoted_price"
                    value={editForm.confirmed_quoted_price}
                    onChange={handleEditChange}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Minimum Order Qty (MOQ)</label>
                  <input
                    type="number"
                    name="moq"
                    value={editForm.moq}
                    onChange={handleEditChange}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Delivery Lead Time</label>
                  <input
                    type="text"
                    name="delivery_time"
                    value={editForm.delivery_time}
                    onChange={handleEditChange}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business Contact Email</label>
                  <input
                    type="email"
                    name="business_email"
                    value={editForm.business_email}
                    onChange={handleEditChange}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Public Telephone</label>
                  <input
                    type="text"
                    name="public_contact_number"
                    value={editForm.public_contact_number}
                    onChange={handleEditChange}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Detailed Technical Specs</label>
                  <textarea
                    rows={2}
                    name="specifications"
                    value={editForm.specifications}
                    onChange={handleEditChange}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes to Excel</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Col: Requirement Match Analysis & Target Comparison */}
        <div className="space-y-6">
          {/* Match Analysis Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Technical Match Analysis
              </h3>
              <StatusBadge status={dealer.match_status} type="match" />
            </div>

            <div className="text-xs space-y-2">
              <span className="text-[11px] text-slate-400 block font-medium">Evaluation Breakdown</span>
              <p className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-slate-700 leading-relaxed">
                {dealer.match_reason || 'Matching evaluation pending detailed specification review.'}
              </p>
            </div>

            {requirement && (
              <div className="pt-3 border-t border-slate-100 text-xs space-y-2">
                <span className="text-[11px] text-slate-400 block font-medium">Comparing with Requirement:</span>
                <div className="p-3 rounded-lg bg-sky-50/50 border border-sky-100 space-y-1">
                  <div className="font-bold text-slate-800">{requirement.product_name}</div>
                  <div className="text-[11px] text-slate-600">ID: {requirement.requirement_id}</div>
                  <div className="text-[11px] text-slate-600">
                    Target Budget: {requirement.currency} {requirement.target_price?.toFixed(2)} | Qty: {requirement.quantity}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quotation Documents Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Quotation Documents
                </h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>
            </div>

            {/* Check if any contact log has a quotation file attached */}
            {contacts.some((c) => c.quotation_file_path) ? (
              <div className="space-y-2">
                {contacts
                  .filter((c) => c.quotation_file_path)
                  .map((c) => (
                    <div
                      key={c.contact_id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <span className="font-semibold text-slate-800 block truncate">{c.quotation_file_path}</span>
                        <span className="text-[10px] text-slate-400">Attached on {c.contact_date}</span>
                      </div>
                      <a
                        href={apiService.getQuotationDownloadUrl(c.quotation_file_path)}
                        download
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-300 text-sky-600 hover:text-sky-700 text-xs font-semibold"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 text-center text-xs text-slate-400">
                No quotation documents uploaded yet. Upload formal supplier proposal to verify rates.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact & Follow-up Timeline for this Dealer */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Communication & Outreach History ({contacts.length})
            </h3>
          </div>
          <button
            onClick={() => setIsInquiryModalOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
          >
            <span>Draft New RFQ</span>
          </button>
        </div>

        {contacts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No inquiries recorded yet for this supplier. Click "Generate RFQ" to prepare a customized inquiry.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {contacts.map((c) => (
              <div key={c.contact_id} className="p-4 hover:bg-slate-50 transition-colors text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{c.contact_method} Outreach</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      {c.contact_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.response_status} type="response" />
                    <span className="text-[11px] text-slate-400">{c.contact_date}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                  {c.inquiry_message}
                </p>

                {c.dealer_response && (
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-emerald-800 text-[11px]">
                    <strong className="block text-emerald-900 mb-0.5">Supplier Response:</strong>
                    {c.dealer_response}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inquiry RFQ Modal */}
      {isInquiryModalOpen && requirement && (
        <InquiryModal
          dealer={dealer}
          requirement={requirement}
          onClose={() => setIsInquiryModalOpen(false)}
          onLogged={loadDealerData}
        />
      )}

      {/* Upload Quotation Modal */}
      {isUploadModalOpen && (
        <UploadQuotationModal
          dealer={dealer}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={loadDealerData}
        />
      )}
    </div>
  );
}
