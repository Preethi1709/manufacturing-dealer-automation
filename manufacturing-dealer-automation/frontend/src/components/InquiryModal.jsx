import React, { useState, useEffect } from 'react';
import { X, Send, Copy, Check, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { apiService } from '../services/api';

export default function InquiryModal({ requirement, dealer, onClose, onLogged }) {
  const [loading, setLoading] = useState(true);
  const [inquiryData, setInquiryData] = useState({ subject: '', message: '', business_email: '' });
  const [customNotes, setCustomNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [approved, setApproved] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    generateMessage();
  }, [customNotes]);

  const generateMessage = async () => {
    try {
      setLoading(true);
      const res = await apiService.generateInquiry({
        requirement_id: requirement.requirement_id,
        dealer_id: dealer.dealer_id,
        sender_name: 'Industrial Procurement Team',
        sender_company: 'Apex Manufacturing Corp.',
        custom_notes: customNotes,
      });
      setInquiryData(res);
    } catch (err) {
      setError('Failed to generate customized inquiry message: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${inquiryData.subject}\n\n${inquiryData.message}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleApproveAndLog = async () => {
    if (!approved) {
      alert('Please check the user approval confirmation box before recording transmission.');
      return;
    }

    try {
      setIsLogging(true);
      setError('');
      
      // Log outreach in Excel Contact_Log sheet
      const contactPayload = {
        dealer_id: dealer.dealer_id,
        requirement_id: requirement.requirement_id,
        contact_method: inquiryData.business_email ? 'Email' : 'Portal Inquiry',
        inquiry_message: inquiryData.message,
        contact_date: new Date().toISOString().split('T')[0],
        response_status: 'Pending',
        dealer_response: null,
        follow_up_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days out
        notes: `User-approved inquiry generated. Recipient: ${dealer.dealer_name} (${inquiryData.business_email || 'Portal Inquiry'}).`,
      };

      await apiService.createContact(contactPayload);
      setLogSuccess(true);
      if (onLogged) onLogged();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError('Failed to record inquiry in Excel: ' + (err.message || ''));
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-600" />
            <div>
              <h3 className="text-base font-bold text-slate-800">Generate Supplier RFQ Inquiry</h3>
              <p className="text-xs text-slate-500">
                To: <span className="font-semibold text-slate-700">{dealer.dealer_name}</span> | Re: {requirement.product_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
              {error}
            </div>
          )}

          {logSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Inquiry successfully logged to Contact_Log worksheet in Excel!</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Custom Engineering Notes / Commercial Instructions (Optional)
            </label>
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g. Please confirm if FOB Chicago or CIF Detroit terms apply. MTR must accompany shipment."
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">Formal Inquiry Letter Subject</label>
              <span className="text-[11px] text-slate-400">
                Target Email: {dealer.business_email || 'Direct Portal Messaging'}
              </span>
            </div>
            <input
              type="text"
              readOnly
              value={inquiryData.subject}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">Formal RFQ Message Body</label>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:text-sky-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Letter'}</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={12}
              value={inquiryData.message}
              className="w-full text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-800 leading-relaxed"
            />
          </div>

          {/* Compliance & Approval Notice */}
          <div className="p-3.5 rounded-lg bg-sky-50/60 border border-sky-200/60 text-slate-700 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-800">Procurement Governance & Authorization</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Per manufacturing compliance policies, unsolicited bulk automated messaging is prohibited. 
                  Inquiries must be reviewed and approved by procurement staff. You may copy the text directly to your email client or supplier portal, and record the outreach in the Excel audit log.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
              />
              <span className="font-semibold text-xs">
                I have reviewed the technical specifications and approve sending/recording this RFQ.
              </span>
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!approved || isLogging}
              onClick={handleApproveAndLog}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isLogging ? 'Recording in Excel...' : 'Approve & Record Outreach'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
