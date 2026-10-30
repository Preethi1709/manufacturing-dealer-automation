import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  Send,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
  MessageSquare,
  RefreshCw,
  Building2,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react';
import { apiService } from '../services/api';
import {
  normalizePhoneForWhatsApp,
  generateWhatsAppUrl,
  generateWhatsAppWebUrl
} from '../services/whatsappUtils';
import StatusBadge from './StatusBadge';

// Cache for extracted public supplier contacts to avoid repeating lookups
const contactLookupCache = new Map();

export default function ContactSupplierModal({ requirement, supplier, onClose, onLogged }) {
  // Navigation / Channel Selection: 'email' | 'whatsapp' | 'portal'
  const [activeChannel, setActiveChannel] = useState('email');

  // Supplier contact fields (editable with fallback to "Not available")
  const rawEmail = supplier?.business_email || supplier?.email || '';
  const rawPhone = supplier?.public_contact_number || supplier?.phone || '';
  const [email, setEmail] = useState(rawEmail);
  const [phone, setPhone] = useState(rawPhone);

  // User edit tracking so late lookup responses never overwrite user typing
  const [isEmailEditedByUser, setIsEmailEditedByUser] = useState(false);
  const [isPhoneEditedByUser, setIsPhoneEditedByUser] = useState(false);

  // Public Contact Extraction & Provenance State
  const [isLookingUpContact, setIsLookingUpContact] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [contactProvenance, setContactProvenance] = useState(null);

  // RFQ Content
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [loadingRFQ, setLoadingRFQ] = useState(true);

  // User Approval Checkbox (mandatory for outbound action)
  const [userApproved, setUserApproved] = useState(false);

  // Action status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState(false);

  // Match Assessment
  const matchStatus = supplier?.match_status || 'Needs Verification';
  const matchReason = supplier?.match_reason || 'Preliminary assessment based on catalog search.';
  const isMatchConfirmed = matchStatus === 'Exact Match' || matchStatus === 'Partial Match';
  const isNeedsVerification = matchStatus === 'Needs Verification';
  const isNotMatch = matchStatus === 'Not a Match';

  // Identify missing specifications from requirement vs supplier
  const getMissingSpecs = () => {
    if (!requirement) return [];
    const missing = [];
    if (requirement.grade && (!supplier.specifications || !supplier.specifications.toLowerCase().includes(requirement.grade.toLowerCase()))) {
      missing.push(`Material Grade / Standard: ${requirement.grade}`);
    }
    if (requirement.size && (!supplier.specifications || !supplier.specifications.toLowerCase().includes(requirement.size.toLowerCase()))) {
      missing.push(`Dimensions / Size: ${requirement.size}`);
    }
    if (requirement.model && (!supplier.specifications || !supplier.specifications.toLowerCase().includes(requirement.model.toLowerCase()))) {
      missing.push(`Exact Model Number: ${requirement.model}`);
    }
    if (requirement.delivery_requirement && !supplier.delivery_time) {
      missing.push(`Lead Time confirmation (Requirement: ${requirement.delivery_requirement})`);
    }
    if (!supplier.listed_price && !supplier.confirmed_quoted_price) {
      missing.push('Unit pricing and commercial terms (FOB/CIF)');
    }
    return missing;
  };

  const missingSpecs = getMissingSpecs();

  // Automatically extract public business contact information (email & phone)
  useEffect(() => {
    let isMounted = true;

    const runContactExtraction = async () => {
      const cacheKey = supplier?.product_url || supplier?.dealer_name || supplier?.supplier_name || 'default';

      // 1. If both email and phone are already available in search result, use them immediately
      if (rawEmail && rawPhone) {
        setContactProvenance({
          supplier_name: supplier?.dealer_name || supplier?.supplier_name,
          business_email: rawEmail,
          public_contact_number: rawPhone,
          source_page_url: supplier?.product_url,
          contact_source_url: supplier?.product_url,
          contact_type: 'Supplier',
          verification_status: 'Verified',
          extraction_notes: 'Verified contact details provided in supplier directory registry.'
        });
        return;
      }

      // 2. Check if details are already in the cache
      if (contactLookupCache.has(cacheKey)) {
        const cached = contactLookupCache.get(cacheKey);
        setContactProvenance(cached);
        if (cached.business_email && !isEmailEditedByUser) {
          setEmail(cached.business_email);
        }
        if (cached.public_contact_number && !isPhoneEditedByUser) {
          setPhone(cached.public_contact_number);
        }
        return;
      }

      // 3. Otherwise, perform live public extraction from product page & official contact pages
      try {
        setIsLookingUpContact(true);
        setLookupError('');

        const res = await apiService.extractPublicContact({
          supplier_name: supplier?.dealer_name || supplier?.supplier_name || '',
          product_name: requirement?.product_name || supplier?.product_name || '',
          product_url: supplier?.product_url || '',
          dealer_id: supplier?.dealer_id || '',
          requirement_id: requirement?.requirement_id || '',
          category: requirement?.category || supplier?.category || '',
          specifications: requirement?.specifications || supplier?.specifications || '',
          existing_email: rawEmail,
          existing_phone: rawPhone,
        });

        if (!isMounted) return;

        contactLookupCache.set(cacheKey, res);
        setContactProvenance(res);

        // Do not overwrite user-edited values with late lookup responses
        if (res.business_email && !isEmailEditedByUser) {
          setEmail(res.business_email);
        }
        if (res.public_contact_number && !isPhoneEditedByUser) {
          setPhone(res.public_contact_number);
        }
      } catch (err) {
        if (!isMounted) return;
        setLookupError('Could not auto-retrieve contact details: ' + (err.response?.data?.detail || err.message || ''));
      } finally {
        if (isMounted) setIsLookingUpContact(false);
      }
    };

    runContactExtraction();

    return () => {
      isMounted = false;
    };
  }, [supplier?.product_url, supplier?.dealer_name]);

  // Load RFQ Message from backend
  useEffect(() => {
    generateRFQ();
  }, [customNotes]);

  const generateRFQ = async () => {
    try {
      setLoadingRFQ(true);
      setActionError('');
      const dealerId = supplier?.dealer_id || 'TEMP-DLR';
      const reqId = requirement?.requirement_id || 'TEMP-REQ';

      const res = await apiService.generateInquiry({
        requirement_id: reqId,
        dealer_id: dealerId,
        supplier_name: supplier?.dealer_name || supplier?.supplier_name || '',
        product_name: requirement?.product_name || supplier?.product_name || '',
        category: requirement?.category || supplier?.category || '',
        specifications: requirement?.specifications || supplier?.specifications || '',
        quantity: requirement?.quantity,
        target_price: requirement?.target_price,
        currency: requirement?.currency || 'USD',
        delivery_requirement: requirement?.delivery_requirement || '',
        business_email: supplier?.business_email || supplier?.email || '',
        public_contact_number: supplier?.public_contact_number || supplier?.phone || '',
        product_url: supplier?.product_url || '',
        image_url: supplier?.image_url || '',
        model: supplier?.model_number || supplier?.model || requirement?.model || '',
        brand: supplier?.brand || requirement?.brand || '',
        sender_name: 'Industrial Procurement Team',
        sender_company: 'Apex Manufacturing Corp.',
        custom_notes: customNotes,
      });

      setSubject(res.subject || `Inquiry for ${requirement?.product_name || supplier?.product_name || 'Industrial Product'}`);
      setMessageBody(res.message || '');
      if (!email && res.business_email) setEmail(res.business_email);
      if (!phone && res.public_contact_number) setPhone(res.public_contact_number);
    } catch (err) {
      setActionError('Failed to generate customized RFQ message: ' + (err.message || ''));
    } finally {
      setLoadingRFQ(false);
    }
  };

  // Copy RFQ letter
  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${messageBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // 1. Send Email Action
  const handleSendEmail = async () => {
    if (!userApproved) {
      setActionError('Please review specifications and check the authorization confirmation before sending.');
      return;
    }
    const trimmedEmail = email ? email.trim() : '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setActionError('Please enter a valid supplier business email address (e.g. name@company.com).');
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError('');
      setActionSuccess(null);

      const payload = {
        requirement_id: requirement?.requirement_id || 'REQ-N/A',
        dealer_id: supplier?.dealer_id || 'DLR-SEARCH',
        supplier_name: supplier?.dealer_name || supplier?.supplier_name || 'Supplier',
        product_name: requirement?.product_name || supplier?.product_name || 'Part',
        recipient_email: trimmedEmail,
        subject: subject.trim(),
        message_body: messageBody.trim(),
        sender_name: 'Apex Procurement Team',
        approved: true,
      };

      const res = await apiService.sendRfqEmail(payload);

      if (res.success) {
        setActionSuccess({
          title: 'RFQ Email Sent Successfully!',
          details: `Accepted by SMTP mail server. Provider Message ID: ${res.provider_message_id || 'N/A'}. Logged to Excel Contact_Log with status "Sent/Accepted".`,
        });
        if (onLogged) onLogged();
      } else {
        setActionError(res.error || 'Failed to dispatch email. Please check SMTP configuration.');
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Error sending email.';
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Send WhatsApp Action
  const handleSendWhatsApp = async () => {
    setActionError('');
    setActionSuccess(null);

    // 1. Authorization check
    if (!userApproved) {
      setActionError('Please review specifications and check the authorization confirmation before initiating WhatsApp contact.');
      return;
    }

    // 2. Asynchronous state check (prevent sending before RFQ generation completes)
    if (loadingRFQ) {
      setActionError('Please wait a moment for the RFQ inquiry message to finish generating.');
      return;
    }

    // 3. Message body check
    const cleanMessage = (messageBody || '').trim();
    if (!cleanMessage) {
      setActionError('RFQ message body is empty. Please enter or generate the inquiry message before opening WhatsApp.');
      return;
    }

    // 4. Phone number check & normalization
    const trimmedPhone = phone ? phone.trim() : '';
    if (!trimmedPhone) {
      setActionError('Supplier WhatsApp phone number is required. Please enter a valid business phone number with country code.');
      return;
    }

    const norm = normalizePhoneForWhatsApp(trimmedPhone);
    if (!norm.isValid) {
      setActionError(norm.error);
      return;
    }

    // 5. Generate official click-to-chat URL using JavaScript encodeURIComponent
    // Format: https://wa.me/INTERNATIONAL_NUMBER?text=ENCODED_MESSAGE
    const waUrl = generateWhatsAppUrl(norm.digits, cleanMessage);

    // 6. CRITICAL POPUP-BLOCKER FIX:
    // Open WhatsApp synchronously directly inside the user's click gesture!
    // Never delay window.open behind an await network request.
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    // Sync normalized number back to state if appropriate
    if (trimmedPhone !== `+${norm.digits}` && !isPhoneEditedByUser) {
      setPhone(`+${norm.digits}`);
    }

    try {
      setIsSubmitting(true);

      const payload = {
        requirement_id: requirement?.requirement_id || 'REQ-N/A',
        dealer_id: supplier?.dealer_id || 'DLR-SEARCH',
        supplier_name: supplier?.dealer_name || supplier?.supplier_name || 'Supplier',
        product_name: requirement?.product_name || supplier?.product_name || 'Part',
        recipient_phone: `+${norm.digits}`,
        message_body: cleanMessage,
        approved: true,
      };

      const res = await apiService.sendRfqWhatsApp(payload);

      if (res.success) {
        setActionSuccess({
          title: 'WhatsApp Chat Opened & Logged in Excel',
          details: `Opened prefilled chat for +${norm.digits}. Please review the inquiry in WhatsApp and click Send. Outreach recorded in Excel Contact_Log sheet (status: "Draft / Link Opened").`,
          waUrl,
          directDigits: norm.digits,
        });
        if (onLogged) onLogged();
      } else {
        setActionError(res.error || 'Failed to record WhatsApp outreach in Excel.');
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Error recording WhatsApp outreach.';
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Portal / Manual Log Action
  const handleLogPortalOutreach = async () => {
    if (!userApproved) {
      setActionError('Please review specifications and check the authorization confirmation before recording.');
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError('');

      const contactPayload = {
        dealer_id: supplier?.dealer_id || 'DLR-SEARCH',
        requirement_id: requirement?.requirement_id || 'REQ-N/A',
        supplier_name: supplier?.dealer_name || supplier?.supplier_name || 'Supplier',
        product_name: requirement?.product_name || supplier?.product_name || 'Part',
        contact_method: 'Portal Inquiry',
        recipient_contact: supplier?.product_url || 'Direct Portal',
        subject: subject,
        inquiry_message: messageBody,
        contact_date: new Date().toISOString().split('T')[0],
        response_status: 'Pending',
        communication_status: 'Pending',
        approval_timestamp: new Date().toISOString(),
        notes: `Outreach conducted via supplier portal (${supplier?.source_portal || 'Web'}). Direct RFQ copy recorded.`,
      };

      await apiService.createContact(contactPayload);
      setActionSuccess({
        title: 'Portal Outreach Recorded in Excel',
        details: 'Outreach entry created in Contact_Log sheet. Follow-up scheduled.',
      });
      if (onLogged) onLogged();
    } catch (err) {
      setActionError('Failed to record in Excel: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Contact Supplier & RFQ Outreach
                </h3>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                  {supplier?.dealer_id || 'NEW SUPPLIER'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                To: <strong className="text-white">{supplier?.dealer_name || 'Supplier Representative'}</strong> | Re: {requirement?.product_name} ({requirement?.requirement_id})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-lg p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Match Status & Specification Verification Banner */}
          {isNotMatch ? (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Not a Match — Outbound RFQ Transmission Restricted</span>
              </div>
              <p className="text-[11px] text-rose-700">
                {matchReason || 'Technical specifications do not match product requirements. Per manufacturing procurement policy, RFQs cannot be sent to non-matching listings.'}
              </p>
            </div>
          ) : isNeedsVerification ? (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Needs Verification — Missing Specifications Require Supplier Confirmation</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {matchReason}
              </p>
              {missingSpecs.length > 0 && (
                <div className="pt-1 border-t border-amber-200/80">
                  <span className="font-semibold text-[10px] uppercase tracking-wider text-amber-900">
                    Unverified Items to Confirm in RFQ:
                  </span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-amber-800 font-medium">
                    {missingSpecs.map((spec, i) => (
                      <li key={i}>{spec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Confirmed Match — Eligible for Formal RFQ Outreach</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                {matchReason || 'Product conforms to technical specifications.'}
              </p>
            </div>
          )}

          {/* Product Overview & Image Preview Card */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {supplier?.image_url ? (
              <div className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs flex items-center justify-center">
                <img
                  src={supplier.image_url}
                  alt={supplier?.product_name || requirement?.product_name || 'Product'}
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            ) : null}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-xs">
                  {supplier?.product_name || requirement?.product_name}
                </span>
                {(supplier?.model_number || supplier?.model || requirement?.model) && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                    Model: {supplier?.model_number || supplier?.model || requirement?.model}
                  </span>
                )}
                {(supplier?.brand || requirement?.brand) && (
                  <span className="font-semibold text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                    Brand: {supplier?.brand || requirement?.brand}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 line-clamp-2">
                {supplier?.specifications || requirement?.specifications || 'Standard specifications'}
              </p>
              {supplier?.image_url && (
                <div className="flex items-center gap-1 text-[10px] text-sky-600 font-medium">
                  <ImageIcon className="w-3 h-3" />
                  <span>Product image URL included in inquiry</span>
                </div>
              )}
            </div>
          </div>

          {/* Supplier Contact Info & Portal Link Grid */}
          <div className="space-y-3">
            {/* Lookup Status Indicator */}
            {isLookingUpContact && (
              <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-xs flex items-center gap-2 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin shrink-0" />
                <span>Extracting publicly listed business email &amp; phone from supplier product page...</span>
              </div>
            )}

            {lookupError && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{lookupError} (You can enter contact details manually below)</span>
              </div>
            )}

            {/* Manufacturer vs Supplier Distinction Banner */}
            {contactProvenance?.manufacturer_name && (contactProvenance?.manufacturer_email || contactProvenance?.manufacturer_phone) && (
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold flex items-center gap-1.5 text-indigo-950">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Manufacturer Contact ({contactProvenance.manufacturer_name}):</span>
                  </div>
                  <div className="text-[11px] text-indigo-800 mt-0.5 flex flex-wrap items-center gap-3">
                    {contactProvenance.manufacturer_email && (
                      <span>Email: <strong className="font-mono">{contactProvenance.manufacturer_email}</strong></span>
                    )}
                    {contactProvenance.manufacturer_phone && (
                      <span>Phone: <strong className="font-mono">{contactProvenance.manufacturer_phone}</strong></span>
                    )}
                    {contactProvenance.manufacturer_source_url && (
                      <a
                        href={contactProvenance.manufacturer_source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-0.5"
                      >
                        <span>Source</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (contactProvenance.manufacturer_email) {
                      setEmail(contactProvenance.manufacturer_email);
                      setIsEmailEditedByUser(true);
                    }
                    if (contactProvenance.manufacturer_phone) {
                      setPhone(contactProvenance.manufacturer_phone);
                      setIsPhoneEditedByUser(true);
                    }
                  }}
                  className="px-2.5 py-1 rounded bg-white text-indigo-700 font-semibold border border-indigo-300 hover:bg-indigo-100 shadow-xs text-[11px] shrink-0 transition-colors"
                >
                  Use Manufacturer Contact
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
              {/* Email Address */}
              <div className="space-y-1">
                <label className="flex items-center gap-1 font-semibold text-slate-800 text-[11px]">
                  <Mail className="w-3.5 h-3.5 text-sky-600" />
                  <span>Supplier Email</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setIsEmailEditedByUser(true);
                  }}
                  placeholder="Enter supplier email (or 'Not available')"
                  className="w-full text-xs rounded border border-slate-300 px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                />
                <div className="flex flex-col gap-0.5">
                  {email ? (
                    <span className="text-[10px] text-emerald-600 font-medium">Ready for SMTP dispatch</span>
                  ) : !isLookingUpContact ? (
                    <span className="text-[10px] text-amber-600">Not found on accessible public pages.</span>
                  ) : null}

                  {contactProvenance?.contact_source_url && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-0.5">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        contactProvenance.verificationStatus === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {contactProvenance.contact_type || 'Supplier'} ({contactProvenance.verificationStatus})
                      </span>
                      <a
                        href={contactProvenance.contact_source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:text-sky-800 underline inline-flex items-center gap-0.5"
                        title="Inspect public source page"
                      >
                        <span>Source Link</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Phone / WhatsApp */}
              <div className="space-y-1">
                <label className="flex items-center gap-1 font-semibold text-slate-800 text-[11px]">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp / Phone (E.164)</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setIsPhoneEditedByUser(true);
                  }}
                  placeholder="e.g. +919876543210 or +15551234567"
                  className="w-full text-xs rounded border border-slate-300 px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                />
                <div className="flex flex-col gap-0.5">
                  {phone ? (
                    <span className="text-[10px] text-emerald-600 font-medium">Ready for WhatsApp outreach</span>
                  ) : !isLookingUpContact ? (
                    <span className="text-[10px] text-amber-600">Not found on accessible public pages.</span>
                  ) : null}

                  {contactProvenance?.contact_source_url && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-0.5">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        contactProvenance.verificationStatus === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {contactProvenance.contact_type || 'Supplier'} ({contactProvenance.verificationStatus})
                      </span>
                      <a
                        href={contactProvenance.contact_source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:text-sky-800 underline inline-flex items-center gap-0.5"
                        title="Inspect public source page"
                      >
                        <span>Source Link</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Listing URL / Portal */}
              <div className="space-y-1">
                <label className="flex items-center gap-1 font-semibold text-slate-800 text-[11px]">
                  <Globe className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Catalog / Portal URL</span>
                </label>
                <div className="pt-1.5 truncate">
                  {supplier?.product_url ? (
                    <a
                      href={supplier.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-semibold truncate"
                    >
                      <span className="truncate max-w-[200px]">{supplier.product_url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-slate-400">Direct Portal / Directory listing</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Portal: {supplier?.source_portal || 'Live Web Directory'}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Method Channel Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <span className="font-semibold text-slate-700 text-xs mr-2">Contact Method:</span>
            <button
              type="button"
              onClick={() => setActiveChannel('email')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeChannel === 'email'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email (SMTP)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveChannel('whatsapp')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeChannel === 'whatsapp'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveChannel('portal')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeChannel === 'portal'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Supplier Portal</span>
            </button>
          </div>

          {/* Feedback alerts */}
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold">Transmission / Configuration Notice:</span>
                <p className="text-[11px] leading-relaxed">{actionError}</p>
              </div>
            </div>
          )}

          {actionSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <span className="font-semibold">{actionSuccess.title}</span>
                <p className="text-[11px] leading-relaxed">{actionSuccess.details}</p>
                {actionSuccess.waUrl && (
                  <div className="pt-1 flex items-center gap-3 text-[11px]">
                    <a
                      href={actionSuccess.waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-emerald-800 underline hover:text-emerald-950 inline-flex items-center gap-1"
                    >
                      <span>Re-open WhatsApp Chat</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {actionSuccess.directDigits && (
                      <a
                        href={generateWhatsAppWebUrl(actionSuccess.directDigits, messageBody)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 underline hover:text-emerald-900 inline-flex items-center gap-1"
                      >
                        <span>Open in WhatsApp Web</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custom Engineering Notes input */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Custom Engineering Notes / Commercial Instructions (Optional)
            </label>
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g. Please confirm if FOB Chicago terms apply. Include Material Test Report (MTR)."
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Subject Line (Email & Portal) */}
          {activeChannel !== 'whatsapp' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Inquiry Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          )}

          {/* Message Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">
                {activeChannel === 'whatsapp' ? 'WhatsApp Inquiry Message' : 'Product Inquiry Message Body'}
              </label>
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
              rows={activeChannel === 'whatsapp' ? 8 : 11}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="w-full text-xs font-mono rounded-lg border border-slate-300 p-3 text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Compliance & Authorization Checkbox */}
          <div className="p-3.5 rounded-lg bg-sky-50/60 border border-sky-200/60 text-slate-700 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-slate-800">Procurement Governance & Authorization</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Bulk automated unsolicited messaging is strictly prohibited. Outbound contact must be explicitly approved by procurement staff after reviewing technical specifications.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={userApproved}
                onChange={(e) => setUserApproved(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
              />
              <span className="font-semibold text-xs text-slate-900">
                I have reviewed the technical specifications and approve initiating contact with this supplier.
              </span>
            </label>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
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

            {/* Dynamic Action Button based on Active Channel */}
            {activeChannel === 'email' && (
              <button
                type="button"
                disabled={!userApproved || isSubmitting || isNotMatch || !email}
                onClick={handleSendEmail}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Sending Email via SMTP...' : 'Send RFQ Email'}</span>
              </button>
            )}

            {activeChannel === 'whatsapp' && (
              <button
                type="button"
                disabled={!userApproved || isSubmitting || isNotMatch || !phone || loadingRFQ || !messageBody}
                onClick={handleSendWhatsApp}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageSquare className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Recording in Excel...'
                    : (loadingRFQ
                      ? 'Generating Inquiry...'
                      : 'Open WhatsApp / Send')}
                </span>
              </button>
            )}

            {activeChannel === 'portal' && (
              <button
                type="button"
                disabled={!userApproved || isSubmitting || isNotMatch}
                onClick={handleLogPortalOutreach}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Globe className="w-4 h-4" />
                <span>{isSubmitting ? 'Recording in Excel...' : 'Record Portal Outreach in Excel'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
