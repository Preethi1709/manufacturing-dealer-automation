import React, { useState, useEffect } from 'react';
import {
  Mail,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  Plus,
  AlertCircle,
  MessageSquare,
  Edit2,
  Save,
  X,
  RefreshCw,
  Search,
  Sparkles,
  DollarSign,
  Package,
  Truck,
  ExternalLink,
  ShieldAlert,
  ChevronRight,
  CheckCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ContactSupplierModal from '../components/ContactSupplierModal';

export default function ContactLog() {
  const [contacts, setContacts] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [metrics, setMetrics] = useState({
    due_today: 0,
    overdue: 0,
    waiting_response: 0,
    reply_received: 0,
    quotation_received: 0,
    failed_attempts: 0,
    closed: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeFollowUpTab, setActiveFollowUpTab] = useState('ALL'); // 'ALL', 'DUE_TODAY', 'OVERDUE', 'WAITING', 'QUOTED', 'CLOSED'

  // Modals / Drafting
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [selectedDealerForDraft, setSelectedDealerForDraft] = useState(null);

  // Inbound Supplier Reply & Quotation Modal
  const [replyModalContact, setReplyModalContact] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [quotedPrice, setQuotedPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [moq, setMoq] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [validity, setValidity] = useState('');
  const [techDetails, setTechDetails] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [replyStatus, setReplyStatus] = useState('Reply Received');
  const [notes, setNotes] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSavingReply, setIsSavingReply] = useState(false);
  const [replySuccessMessage, setReplySuccessMessage] = useState('');

  // Quick Follow-up Date Update Modal
  const [editingFollowUpContact, setEditingFollowUpContact] = useState(null);
  const [quickFollowUpDate, setQuickFollowUpDate] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [isSavingQuick, setIsSavingQuick] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [contactsData, dealersData, reqsData, metricsData] = await Promise.all([
        apiService.getContacts(),
        apiService.getDealers(),
        apiService.getRequirements(),
        apiService.getFollowUpMetrics().catch(() => null),
      ]);
      setContacts(contactsData || []);
      setDealers(dealersData || []);
      setRequirements(reqsData || []);
      if (metricsData) setMetrics(metricsData);
    } catch (err) {
      setError('Failed to load contact and follow-up data from Excel: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // Open Inbound Reply Dialog
  const handleOpenReplyDialog = (contact) => {
    setReplyModalContact(contact);
    setReplyText(contact.supplier_response || contact.dealer_response || '');
    setQuotedPrice(contact.quoted_price ? String(contact.quoted_price) : '');
    setCurrency(contact.currency || 'USD');
    setMoq(contact.moq ? String(contact.moq) : '');
    setDeliveryTime(contact.delivery_time || '');
    setValidity(contact.quotation_validity || '');
    setTechDetails(contact.technical_details || '');
    setNextFollowUpDate(contact.next_follow_up_date || contact.follow_up_date || '');
    setReplyStatus(contact.communication_status === 'Quotation Received' ? 'Quotation Received' : 'Reply Received');
    setNotes(contact.notes || '');
    setReplySuccessMessage('');
  };

  // Auto-Extract Commercial Terms via heuristic parser
  const handleAutoExtract = async () => {
    if (!replyText.trim()) {
      alert('Please enter or paste supplier reply text first.');
      return;
    }
    try {
      setIsExtracting(true);
      const extracted = await apiService.extractReplyData(replyText);
      if (extracted.quoted_price !== null && extracted.quoted_price !== undefined) {
        setQuotedPrice(String(extracted.quoted_price));
        setReplyStatus('Quotation Received');
      }
      if (extracted.currency) setCurrency(extracted.currency);
      if (extracted.moq !== null && extracted.moq !== undefined) setMoq(String(extracted.moq));
      if (extracted.delivery_time) setDeliveryTime(extracted.delivery_time);
    } catch (err) {
      alert('Failed to extract quotation data: ' + (err.message || ''));
    } finally {
      setIsExtracting(false);
    }
  };

  // Save Supplier Reply & Quotation
  const handleSaveReply = async (e) => {
    e.preventDefault();
    if (!replyModalContact) return;

    try {
      setIsSavingReply(true);
      const payload = {
        supplier_response: replyText.trim(),
        response_date: new Date().toISOString().split('T')[0],
        quoted_price: quotedPrice ? parseFloat(quotedPrice) : null,
        currency: currency,
        moq: moq ? parseFloat(moq) : null,
        delivery_time: deliveryTime.trim() || null,
        quotation_validity: validity.trim() || null,
        technical_details: techDetails.trim() || null,
        next_follow_up_date: nextFollowUpDate || null,
        communication_status: replyStatus,
        notes: notes.trim() || null,
      };

      await apiService.recordSupplierReply(replyModalContact.contact_id, payload);
      setReplySuccessMessage('Supplier response and quotation recorded in Excel Contact_Log!');
      setTimeout(() => {
        setReplyModalContact(null);
        loadData();
      }, 1200);
    } catch (err) {
      alert('Failed to record reply in Excel: ' + (err.message || ''));
    } finally {
      setIsSavingReply(false);
    }
  };

  // Quick Close Inquiry
  const handleCloseInquiry = async (contact) => {
    if (!window.confirm(`Are you sure you want to close inquiry ${contact.contact_id} with ${contact.dealer_name}?`)) {
      return;
    }
    try {
      await apiService.updateContact(contact.contact_id, {
        communication_status: 'Closed',
        response_status: 'Closed',
        notes: (contact.notes ? contact.notes + ' ' : '') + '[Closed by user]',
      });
      loadData();
    } catch (err) {
      alert('Failed to close inquiry: ' + (err.message || ''));
    }
  };

  // Quick Update Follow-up Date
  const handleSaveQuickFollowUp = async (e) => {
    e.preventDefault();
    if (!editingFollowUpContact) return;
    try {
      setIsSavingQuick(true);
      await apiService.updateContact(editingFollowUpContact.contact_id, {
        follow_up_date: quickFollowUpDate || null,
        next_follow_up_date: quickFollowUpDate || null,
        notes: quickNotes.trim() ? (editingFollowUpContact.notes ? `${editingFollowUpContact.notes} | ${quickNotes.trim()}` : quickNotes.trim()) : editingFollowUpContact.notes,
      });
      setEditingFollowUpContact(null);
      loadData();
    } catch (err) {
      alert('Failed to update follow-up date: ' + (err.message || ''));
    } finally {
      setIsSavingQuick(false);
    }
  };

  // Filtering Logic
  const todayStr = new Date().toISOString().split('T')[0];
  const filteredContacts = contacts.filter((c) => {
    const status = (c.communication_status || c.response_status || '').toLowerCase();
    const followUp = (c.next_follow_up_date || c.follow_up_date || '').slice(0, 10);

    // Tab Filter
    if (activeFollowUpTab === 'DUE_TODAY') {
      if (followUp !== todayStr || status.includes('closed') || status.includes('quot')) return false;
    } else if (activeFollowUpTab === 'OVERDUE') {
      if (!followUp || followUp >= todayStr || status.includes('closed') || status.includes('quot')) return false;
    } else if (activeFollowUpTab === 'WAITING') {
      if (status.includes('closed') || status.includes('quot') || status.includes('reply') || status.includes('respond')) return false;
    } else if (activeFollowUpTab === 'QUOTED') {
      if (!status.includes('quot')) return false;
    } else if (activeFollowUpTab === 'CLOSED') {
      if (!status.includes('closed')) return false;
    }

    // Status Dropdown Filter
    if (statusFilter !== 'ALL') {
      if (c.communication_status !== statusFilter && c.response_status !== statusFilter) return false;
    }

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const combined = `${c.dealer_name} ${c.supplier_name || ''} ${c.product_name || ''} ${c.inquiry_message} ${c.dealer_response || ''} ${c.subject || ''} ${c.contact_method} ${c.contact_id}`.toLowerCase();
      if (!combined.includes(q)) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Supplier Contact & Follow-up Tracking</h2>
          <p className="text-xs text-slate-500">
            Lifecycle tracking of supplier RFQs, emails, WhatsApp outreach, inbound quotations, and scheduled follow-ups stored in Excel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dealers.length > 0 && (
            <button
              onClick={() => {
                setSelectedDealerForDraft(dealers[0]);
                setIsDraftModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Draft Supplier RFQ</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Due Today */}
        <div
          onClick={() => setActiveFollowUpTab('DUE_TODAY')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            activeFollowUpTab === 'DUE_TODAY'
              ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400'
              : 'bg-white hover:bg-amber-50/50 border-amber-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${activeFollowUpTab === 'DUE_TODAY' ? 'text-amber-100' : 'text-amber-700'}`}>
              Due Today
            </span>
            <Clock className={`w-3.5 h-3.5 ${activeFollowUpTab === 'DUE_TODAY' ? 'text-white' : 'text-amber-600'}`} />
          </div>
          <div className="text-xl font-bold mt-1">{metrics.due_today}</div>
        </div>

        {/* Overdue */}
        <div
          onClick={() => setActiveFollowUpTab('OVERDUE')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            activeFollowUpTab === 'OVERDUE'
              ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-400'
              : 'bg-white hover:bg-rose-50/50 border-rose-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${activeFollowUpTab === 'OVERDUE' ? 'text-rose-100' : 'text-rose-700'}`}>
              Overdue
            </span>
            <AlertCircle className={`w-3.5 h-3.5 ${activeFollowUpTab === 'OVERDUE' ? 'text-white' : 'text-rose-600'}`} />
          </div>
          <div className="text-xl font-bold mt-1">{metrics.overdue}</div>
        </div>

        {/* Waiting for Response */}
        <div
          onClick={() => setActiveFollowUpTab('WAITING')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            activeFollowUpTab === 'WAITING'
              ? 'bg-sky-600 text-white border-sky-700 shadow-md ring-2 ring-sky-400'
              : 'bg-white hover:bg-sky-50/50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${activeFollowUpTab === 'WAITING' ? 'text-sky-100' : 'text-slate-600'}`}>
              Waiting Response
            </span>
            <Mail className={`w-3.5 h-3.5 ${activeFollowUpTab === 'WAITING' ? 'text-white' : 'text-sky-600'}`} />
          </div>
          <div className="text-xl font-bold mt-1">{metrics.waiting_response}</div>
        </div>

        {/* Reply Received */}
        <div
          onClick={() => setActiveFollowUpTab('ALL')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            activeFollowUpTab === 'ALL' && statusFilter === 'Reply Received'
              ? 'bg-teal-600 text-white border-teal-700 shadow-md ring-2 ring-teal-400'
              : 'bg-white hover:bg-teal-50/50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-teal-700">Reply Received</span>
            <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-xl font-bold mt-1">{metrics.reply_received}</div>
        </div>

        {/* Quotation Received */}
        <div
          onClick={() => setActiveFollowUpTab('QUOTED')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            activeFollowUpTab === 'QUOTED'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400'
              : 'bg-white hover:bg-emerald-50/50 border-emerald-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${activeFollowUpTab === 'QUOTED' ? 'text-emerald-100' : 'text-emerald-700'}`}>
              Quotation Rcvd
            </span>
            <CheckCircle2 className={`w-3.5 h-3.5 ${activeFollowUpTab === 'QUOTED' ? 'text-white' : 'text-emerald-600'}`} />
          </div>
          <div className="text-xl font-bold mt-1">{metrics.quotation_received}</div>
        </div>

        {/* Failed Attempts */}
        <div
          onClick={() => setStatusFilter('Failed')}
          className="p-3.5 rounded-xl border bg-white hover:bg-slate-50 border-slate-200 text-slate-800 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Failed Outreach</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-bold mt-1 text-rose-600">{metrics.failed_attempts}</div>
        </div>

        {/* Closed */}
        <div
          onClick={() => setActiveFollowUpTab('CLOSED')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            activeFollowUpTab === 'CLOSED'
              ? 'bg-slate-700 text-white border-slate-800 shadow-md'
              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${activeFollowUpTab === 'CLOSED' ? 'text-slate-200' : 'text-slate-500'}`}>
              Closed
            </span>
            <CheckCircle className={`w-3.5 h-3.5 ${activeFollowUpTab === 'CLOSED' ? 'text-white' : 'text-slate-400'}`} />
          </div>
          <div className="text-xl font-bold mt-1">{metrics.closed}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search supplier, requirement, message, quote..."
              className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setActiveFollowUpTab('ALL');
            }}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">All Communication Statuses</option>
            <option value="Sent/Accepted">Sent / Accepted</option>
            <option value="Draft / Link Opened">Draft / Link Opened (WhatsApp)</option>
            <option value="Pending">Pending Outreach</option>
            <option value="Reply Received">Reply Received</option>
            <option value="Quotation Received">Quotation Received</option>
            <option value="Failed">Failed Attempt</option>
            <option value="Closed">Closed</option>
          </select>

          {activeFollowUpTab !== 'ALL' && (
            <button
              onClick={() => setActiveFollowUpTab('ALL')}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 bg-sky-50 px-2 py-1 rounded border border-sky-200"
            >
              <span>Clear Filter ({activeFollowUpTab})</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <span className="text-slate-500 text-[11px] whitespace-nowrap">
          Showing <strong className="text-slate-800">{filteredContacts.length}</strong> of{' '}
          <strong className="text-slate-800">{contacts.length}</strong> logged communications
        </span>
      </div>

      {/* Communication Records List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Communication History & Follow-up Log (Contact_Log sheet)
            </h3>
          </div>
          <button onClick={loadData} className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
            <span>Reading contact log from Excel...</span>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <Mail className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700">No Matching Communication Records</p>
            <p>Initiate supplier outreach via the Dealer Results or Search pages to track communications.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredContacts.map((c) => {
              const isDueToday = c.next_follow_up_date === todayStr;
              const isOverdue = c.next_follow_up_date && c.next_follow_up_date < todayStr && !['Closed', 'Quotation Received'].includes(c.communication_status);

              return (
                <div key={c.contact_id} className="p-5 hover:bg-slate-50/70 transition-colors space-y-3 text-xs">
                  {/* Top Row: Supplier Name, Product, Method, Status, Dates */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{c.dealer_name || c.supplier_name}</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {c.contact_id}
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
                        {c.requirement_id}
                      </span>
                      {c.product_name && (
                        <span className="text-slate-600 font-medium text-[11px]">
                          ({c.product_name})
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {c.contact_method}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={c.communication_status || c.response_status} type="response" />
                      <span className="text-slate-400 text-[11px] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{c.contact_date}</span>
                      </span>
                    </div>
                  </div>

                  {/* Contact Metadata Bar */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                    {c.recipient_contact && (
                      <span>
                        <strong className="text-slate-700">Target:</strong> {c.recipient_contact}
                      </span>
                    )}
                    {c.subject && (
                      <span className="truncate max-w-md">
                        <strong className="text-slate-700">Subject:</strong> {c.subject}
                      </span>
                    )}
                    {c.provider_message_id && (
                      <span className="font-mono text-[10px]">
                        <strong className="text-slate-700">ID:</strong> {c.provider_message_id}
                      </span>
                    )}
                    {c.next_follow_up_date && (
                      <span className={`inline-flex items-center gap-1 font-semibold ${
                        isOverdue ? 'text-rose-600' : isDueToday ? 'text-amber-600' : 'text-slate-700'
                      }`}>
                        <Calendar className="w-3 h-3" />
                        <span>Follow-up: {c.next_follow_up_date}</span>
                        {isOverdue && <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[9px]">OVERDUE</span>}
                        {isDueToday && <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 text-[9px]">DUE TODAY</span>}
                      </span>
                    )}
                  </div>

                  {/* Message / RFQ Excerpt */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Outbound RFQ Transmission:
                    </span>
                    <p className="text-slate-600 bg-white p-2.5 rounded border border-slate-200 font-mono text-[11px] whitespace-pre-wrap max-h-24 overflow-y-auto leading-relaxed">
                      {c.inquiry_message}
                    </p>
                  </div>

                  {/* Failed Attempt Notice */}
                  {c.error_details && (
                    <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold">Delivery Failure / Config Alert:</strong>{' '}
                        <span>{c.error_details}</span>
                      </div>
                    </div>
                  )}

                  {/* Recorded Supplier Reply & Quotation Terms */}
                  {(c.supplier_response || c.dealer_response || c.quoted_price) && (
                    <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Supplier Response Received {c.response_date ? `(${c.response_date})` : ''}</span>
                        </div>
                        {c.quoted_price && (
                          <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-emerald-600 text-white shadow-xs">
                            Quoted: {c.currency || '$'} {c.quoted_price.toFixed(2)} / unit
                          </span>
                        )}
                      </div>

                      {c.supplier_response && (
                        <p className="text-emerald-950 font-sans text-xs whitespace-pre-wrap leading-relaxed">
                          {c.supplier_response}
                        </p>
                      )}

                      {/* Commercial Details Pills */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-emerald-200/60 text-[11px] text-emerald-900">
                        {c.moq && (
                          <span className="inline-flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-emerald-700" />
                            <strong>MOQ:</strong> {c.moq} units
                          </span>
                        )}
                        {c.delivery_time && (
                          <span className="inline-flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-emerald-700" />
                            <strong>Lead Time:</strong> {c.delivery_time}
                          </span>
                        )}
                        {c.quotation_validity && (
                          <span>
                            <strong>Validity:</strong> {c.quotation_validity}
                          </span>
                        )}
                        {c.technical_details && (
                          <span className="truncate max-w-sm">
                            <strong>Specs:</strong> {c.technical_details}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="text-[11px] text-slate-500 italic">
                      {c.notes ? `Note: ${c.notes}` : 'No notes attached.'}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Record Supplier Reply button */}
                      <button
                        type="button"
                        onClick={() => handleOpenReplyDialog(c)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Record Supplier Reply</span>
                      </button>

                      {/* Update Follow-up date */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFollowUpContact(c);
                          setQuickFollowUpDate(c.next_follow_up_date || c.follow_up_date || '');
                          setQuickNotes('');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Reschedule</span>
                      </button>

                      {/* Close Inquiry */}
                      {c.communication_status !== 'Closed' && (
                        <button
                          type="button"
                          onClick={() => handleCloseInquiry(c)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Mark inquiry closed"
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Record Inbound Supplier Reply & Quotation Modal */}
      {replyModalContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold">Record Supplier Reply & Inbound Quotation</h3>
                  <p className="text-xs text-slate-300">
                    Supplier: <strong className="text-white">{replyModalContact.dealer_name}</strong> | Ref: {replyModalContact.contact_id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReplyModalContact(null)}
                className="text-slate-400 hover:text-white rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReply} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {replySuccessMessage && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>{replySuccessMessage}</span>
                </div>
              )}

              {/* Paste Supplier Reply Text */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    Paste Raw Supplier Reply Text / Email Body:
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoExtract}
                    disabled={isExtracting || !replyText.trim()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isExtracting ? 'Analyzing...' : 'Auto-Extract Commercial Terms'}</span>
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Paste reply message from supplier containing price, MOQ, lead time, or technical clarifications..."
                  className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Extracted Commercial Terms Section */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                  Commercial Quotation Details (Review & Confirm):
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 text-[11px] mb-1">Quoted Unit Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={quotedPrice}
                      onChange={(e) => setQuotedPrice(e.target.value)}
                      placeholder="e.g. 45.50"
                      className="w-full text-xs rounded border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 text-[11px] mb-1">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 text-[11px] mb-1">Minimum Order Qty (MOQ)</label>
                    <input
                      type="number"
                      value={moq}
                      onChange={(e) => setMoq(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full text-xs rounded border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 text-[11px] mb-1">Quoted Lead Time / Delivery</label>
                    <input
                      type="text"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      placeholder="e.g. 2-3 weeks ARO"
                      className="w-full text-xs rounded border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 text-[11px] mb-1">Quotation Validity</label>
                    <input
                      type="text"
                      value={validity}
                      onChange={(e) => setValidity(e.target.value)}
                      placeholder="e.g. 30 days"
                      className="w-full text-xs rounded border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 text-[11px] mb-1">Technical Specs / Compliance Notes</label>
                  <input
                    type="text"
                    value={techDetails}
                    onChange={(e) => setTechDetails(e.target.value)}
                    placeholder="e.g. Meets ASTM A36 standard, MTR provided with shipment."
                    className="w-full text-xs rounded border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Status and Next Follow-up Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 text-[11px] mb-1">Inquiry Status</label>
                  <select
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value)}
                    className="w-full text-xs rounded border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Reply Received">Reply Received (Clarifications Pending)</option>
                    <option value="Quotation Received">Quotation Received (Ready for Comparison)</option>
                    <option value="Closed">Closed / Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 text-[11px] mb-1">Next Follow-up Date (Optional)</label>
                  <input
                    type="date"
                    value={nextFollowUpDate}
                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                    className="w-full text-xs rounded border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 text-[11px] mb-1">Internal Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional internal remarks..."
                  className="w-full text-xs rounded border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReplyModalContact(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingReply || !replyText.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingReply ? 'Saving to Excel...' : 'Save Reply & Update Quotation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Reschedule Follow-up Modal */}
      {editingFollowUpContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Reschedule Follow-up</h3>
              <button onClick={() => setEditingFollowUpContact(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickFollowUp} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Next Follow-up Date</label>
                <input
                  type="date"
                  required
                  value={quickFollowUpDate}
                  onChange={(e) => setQuickFollowUpDate(e.target.value)}
                  className="w-full text-xs rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Add Note / Reminder</label>
                <input
                  type="text"
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  placeholder="e.g. Call sales rep if quotation is not received by noon."
                  className="w-full text-xs rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingFollowUpContact(null)}
                  className="px-3 py-1.5 rounded text-xs text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuick}
                  className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-xs"
                >
                  {isSavingQuick ? 'Saving...' : 'Update Date'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual RFQ Drafting Modal */}
      {isDraftModalOpen && selectedDealerForDraft && (
        <ContactSupplierModal
          supplier={selectedDealerForDraft}
          requirement={requirements[0] || {
            requirement_id: 'REQ-5001',
            product_name: 'Industrial Part',
            category: 'Components',
            quantity: 100,
            currency: 'USD'
          }}
          onClose={() => setIsDraftModalOpen(false)}
          onLogged={loadData}
        />
      )}
    </div>
  );
}
