import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Building2,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Info,
  Image as ImageIcon,
  UploadCloud,
  Sparkles,
  Key,
  X,
  FileText,
  Mail,
  ChevronDown,
  FileSpreadsheet
} from 'lucide-react';
import { apiService } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ManualSupplierModal from '../components/ManualSupplierModal';
import ContactSupplierModal from '../components/ContactSupplierModal';

const PORTALS = [
  {
    id: 'live_web',
    name: 'Live Web Search (Tavily AI)',
    desc: 'Real-time live search across public manufacturer websites, distributor catalogs, and industrial portals.',
    badge: 'Live Web API',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    id: 'local_directory',
    name: 'Verified Industrial Supplier Directory',
    desc: 'Pre-vetted industrial manufacturers, machine shops, and authorized distributors with authentic product catalogs.',
    badge: 'Permitted & Active',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200'
  },
  {
    id: 'thomasnet',
    name: 'ThomasNet Official API',
    desc: 'North American industrial supplier network. Requires active THOMASNET_API_KEY in backend/.env.',
    badge: 'Enterprise API',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200'
  },
  {
    id: 'indiamart',
    name: 'IndiaMART CRM API',
    desc: 'Asian industrial component manufacturers and raw material suppliers. Requires INDIAMART_API_KEY.',
    badge: 'Enterprise API',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    id: 'alibaba',
    name: 'Alibaba Open Platform',
    desc: 'Global B2B manufacturing hub. Requires developer OAuth credentials (ALIBABA_APP_KEY).',
    badge: 'Developer Portal',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
  }
];

const INDUSTRIAL_CATEGORIES = [
  'Industrial Components',
  'Precision Machined Parts',
  'Bearings & Power Transmission',
  'Fasteners & Hardware',
  'Process Instrumentation & Monitoring',
  'Electrical & Electronics',
  'Hydraulics & Pneumatics',
  'Polymers & Plastics',
  'Raw Materials & Fabrication',
  'Tooling, Jigs & Fixtures',
  'Pumps, Valves & Piping'
];

export default function DealerSearch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Search Mode: 'text' or 'image'
  const [searchMode, setSearchMode] = useState(searchParams.get('mode') === 'image' ? 'image' : 'text');

  const [requirements, setRequirements] = useState([]);
  const [selectedReqId, setSelectedReqId] = useState(searchParams.get('requirement_id') || '');
  const [directProductName, setDirectProductName] = useState('');
  const [selectedPortal, setSelectedPortal] = useState('live_web');
  const [locationFilter, setLocationFilter] = useState('');

  // Dropdown & Search Filter state
  const reqDropdownRef = useRef(null);
  const [isReqDropdownOpen, setIsReqDropdownOpen] = useState(false);
  const [reqSearchFilter, setReqSearchFilter] = useState('');

  // Manual Product Entry state
  const [manualCategory, setManualCategory] = useState('Industrial Components');
  const [manualSpecs, setManualSpecs] = useState('');
  const [manualQuantity, setManualQuantity] = useState('100');
  const [manualTargetPrice, setManualTargetPrice] = useState('50.00');
  const [manualCurrency, setManualCurrency] = useState('USD');
  const [manualLeadTime, setManualLeadTime] = useState('14 days');
  const [isSavingRequirement, setIsSavingRequirement] = useState(false);
  const [manualValidationError, setManualValidationError] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Image search states
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalysisResult, setImageAnalysisResult] = useState(null);
  const [identifiedProductName, setIdentifiedProductName] = useState('');
  const [identifiedCategory, setIdentifiedCategory] = useState('');
  const [identifiedSpecs, setIdentifiedSpecs] = useState('');
  const [identifiedBrand, setIdentifiedBrand] = useState('');
  const [identifiedModel, setIdentifiedModel] = useState('');
  const [identifiedProductType, setIdentifiedProductType] = useState('');
  const [identifiedReadableText, setIdentifiedReadableText] = useState('');
  const [identifiedPhysicalFeatures, setIdentifiedPhysicalFeatures] = useState('');
  const [visionNotice, setVisionNotice] = useState('');

  // General search states
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState('');
  const [searchResponse, setSearchResponse] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [activeContactItem, setActiveContactItem] = useState(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (reqDropdownRef.current && !reqDropdownRef.current.contains(event.target)) {
        setIsReqDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    loadRequirements();
  }, []);

  const loadRequirements = async (autoSelectId = null) => {
    try {
      const data = await apiService.getRequirements();
      setRequirements(data);
      if (autoSelectId) {
        setSelectedReqId(autoSelectId);
      } else if (searchParams.get('requirement_id')) {
        setSelectedReqId(searchParams.get('requirement_id'));
      }
    } catch (err) {
      setSearchError('Failed to load requirements from Excel: ' + (err.message || ''));
    }
  };

  const handleSelectRequirement = (r) => {
    setSelectedReqId(r.requirement_id);
    setDirectProductName('');
    setManualSpecs('');
    setManualValidationError('');
    setSaveSuccessMsg('');
    setIsReqDropdownOpen(false);
  };

  const handleClearSelectedReq = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setSelectedReqId('');
    setIsReqDropdownOpen(false);
  };

  const handleDirectProductNameChange = (value) => {
    setDirectProductName(value);
    setManualValidationError('');
    setSaveSuccessMsg('');
    if (selectedReqId) {
      setSelectedReqId('');
    }
  };

  const handleSaveManualRequirement = async () => {
    const trimmedName = directProductName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setManualValidationError('Please enter a valid product name (minimum 2 characters) before saving.');
      return;
    }

    try {
      setIsSavingRequirement(true);
      setManualValidationError('');
      setSaveSuccessMsg('');

      const qty = parseFloat(manualQuantity);
      const price = parseFloat(manualTargetPrice);

      const payload = {
        product_name: trimmedName,
        category: manualCategory.trim() || 'Industrial Components',
        specifications: manualSpecs.trim() || trimmedName,
        quantity: !isNaN(qty) && qty > 0 ? qty : 100,
        target_price: !isNaN(price) && price >= 0 ? price : 0.0,
        currency: manualCurrency || 'USD',
        delivery_requirement: manualLeadTime.trim() || '14 days',
      };

      const res = await apiService.createRequirement(payload);
      
      // Refresh requirements list from Excel and select newly saved requirement
      await loadRequirements(res.requirement_id);
      
      setSaveSuccessMsg(`Requirement saved to Excel: [${res.requirement_id}] ${res.product_name}. It is now selected and saved in BOM Tracker.`);
      setDirectProductName('');
      setManualSpecs('');
    } catch (err) {
      setManualValidationError('Failed to save product requirement: ' + (err.response?.data?.detail || err.message || 'Unknown error'));
    } finally {
      setIsSavingRequirement(false);
    }
  };

  const filteredRequirements = requirements.filter((r) => {
    if (!reqSearchFilter.trim()) return true;
    const q = reqSearchFilter.toLowerCase();
    return (
      r.requirement_id?.toLowerCase().includes(q) ||
      r.product_name?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q) ||
      r.specifications?.toLowerCase().includes(q)
    );
  });

  // Handle Image Selection
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageAnalysisResult(null);
    setSearchResponse(null);
    setSavedCount(0);
    setSearchError('');
    setVisionNotice('');

    // Trigger AI analysis on upload
    await analyzeImageFile(file);
  };

  // Analyze image with Vision AI service
  const analyzeImageFile = async (fileToAnalyze) => {
    const file = fileToAnalyze || imageFile;
    if (!file) {
      alert('Please select or upload a product image first.');
      return;
    }

    try {
      setIsAnalyzingImage(true);
      setSearchError('');
      setVisionNotice('Analyzing visual characteristics using Vision AI...');

      const result = await apiService.identifyProductImage(file);
      setImageAnalysisResult(result);
      setIdentifiedProductName(result.product_name || '');
      setIdentifiedCategory(result.category || 'Industrial Components');
      setIdentifiedSpecs(result.specifications || '');
      setIdentifiedBrand(result.brand || '');
      setIdentifiedModel(result.model_number || '');
      setIdentifiedProductType(result.product_type || '');
      setIdentifiedReadableText(result.readable_text || '');
      setIdentifiedPhysicalFeatures(result.physical_features || '');
      setVisionNotice(result.message || '');
    } catch (err) {
      setSearchError('Vision AI image analysis error: ' + (err.response?.data?.detail || err.message || 'Failed to analyze image.'));
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageAnalysisResult(null);
    setIdentifiedProductName('');
    setIdentifiedCategory('');
    setIdentifiedSpecs('');
    setIdentifiedBrand('');
    setIdentifiedModel('');
    setIdentifiedProductType('');
    setIdentifiedReadableText('');
    setIdentifiedPhysicalFeatures('');
    setVisionNotice('');
    setSearchResponse(null);
    setSavedCount(0);
    setSearchError('');
  };

  // Execute Supplier Search (Used by both Text & Image modes)
  const handleStartSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    let searchPayload = {
      portal: selectedPortal,
      filter_location: locationFilter.trim() || null,
      max_results: 15,
    };

    if (searchMode === 'image') {
      if (!identifiedProductName.trim()) {
        alert('Please enter or confirm the product name identified from the image before searching.');
        return;
      }
      searchPayload.product_name = identifiedProductName.trim();
      searchPayload.category = identifiedCategory.trim() || 'Industrial Components';
      searchPayload.specifications = identifiedSpecs.trim() || identifiedProductName.trim();
      if (identifiedBrand?.trim()) {
        searchPayload.brand = identifiedBrand.trim();
      }
      if (identifiedModel?.trim()) {
        searchPayload.model = identifiedModel.trim();
      }
      // If a matching requirement exists, attach its ID
      const matchingReq = requirements.find(
        (r) => r.product_name.toLowerCase() === identifiedProductName.trim().toLowerCase()
      );
      if (matchingReq) {
        searchPayload.requirement_id = matchingReq.requirement_id;
      }
    } else {
      // Text Search Mode
      if (directProductName.trim()) {
        searchPayload.product_name = directProductName.trim();
        searchPayload.category = manualCategory.trim() || 'Industrial Components';
        searchPayload.specifications = manualSpecs.trim() || directProductName.trim();
      } else if (selectedReqId) {
        searchPayload.requirement_id = selectedReqId;
      } else {
        alert('Please enter a product name or select an existing requirement.');
        return;
      }
    }

    try {
      setIsSearching(true);
      setSearchError('');
      setSearchResponse(null);
      setSavedCount(0);
      setSearchProgress('Connecting to authorized portal / verified supplier directory...');

      setTimeout(() => {
        setSearchProgress('Evaluating supplier technical specifications against product query...');
      }, 500);

      const res = await apiService.searchDealers(searchPayload);

      setSearchProgress('Processing match scores and updating Search_History in Excel...');
      setSearchResponse(res);
    } catch (err) {
      setSearchError(err.response?.data?.detail || err.message || 'Supplier search failed.');
    } finally {
      setIsSearching(false);
      setSearchProgress('');
    }
  };

  const handleSaveDiscoveredDealers = async () => {
    if (!searchResponse || !searchResponse.results || searchResponse.results.length === 0) return;

    try {
      setIsSearching(true);
      const reqIdToSave = searchResponse.requirement_id || selectedReqId || 'REQ-SEARCH';
      const prodNameToSave = searchMode === 'image' ? identifiedProductName : (directProductName || activeReq?.product_name);
      
      const saved = await apiService.saveSearchResults(reqIdToSave, searchResponse.results, prodNameToSave);
      setSavedCount(saved.length);
    } catch (err) {
      alert('Failed to save discovered dealers: ' + (err.message || ''));
    } finally {
      setIsSearching(false);
    }
  };

  const activeReq = requirements.find((r) => r.requirement_id === selectedReqId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Manual Entry Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Automated Dealer Sourcing</h2>
          <p className="text-xs text-slate-500">
            Search authorized supplier networks and verified directories by product name or product image.
          </p>
        </div>

        <button
          onClick={() => setIsManualModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 text-sky-600" />
          <span>Manual Supplier Entry</span>
        </button>
      </div>

      {/* Mode Selector Tabs: Text vs Image Search */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => {
            setSearchMode('text');
            setSearchResponse(null);
            setSearchError('');
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            searchMode === 'text'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Search by Product Name / Requirement</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSearchMode('image');
            setSearchResponse(null);
            setSearchError('');
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            searchMode === 'image'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Search by Product Image</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-200/40 text-sky-100">
            Vision AI
          </span>
        </button>
      </div>

      {/* Search Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Search Controls */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          {/* TAB 1: TEXT-BASED SEARCH */}
          {searchMode === 'text' && (
            <div className="space-y-5 text-xs">
              {/* Option A: Select Target Manufacturing Requirement from BOM Tracker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 text-xs">
                    1. Select Target Manufacturing Requirement (from BOM Tracker)
                  </label>
                  {selectedReqId && (
                    <button
                      type="button"
                      onClick={handleClearSelectedReq}
                      className="text-[11px] text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear Selection</span>
                    </button>
                  )}
                </div>

                {/* Custom Combobox Dropdown with Search & Click-Outside auto-closing */}
                <div className="relative" ref={reqDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsReqDropdownOpen((prev) => !prev)}
                    className={`w-full text-left text-xs rounded-lg border px-3 py-2.5 bg-white flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors ${
                      selectedReqId ? 'border-sky-400 bg-sky-50/20 text-slate-800 font-medium' : 'border-slate-300 text-slate-500'
                    }`}
                  >
                    <span className="truncate">
                      {activeReq ? (
                        <span>
                          <strong className="text-sky-700">[{activeReq.requirement_id}]</strong>{' '}
                          {activeReq.product_name} - Qty: {activeReq.quantity} {activeReq.currency} {activeReq.target_price}
                        </span>
                      ) : (
                        '-- Choose Existing Requirement from BOM Tracker --'
                      )}
                    </span>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      {selectedReqId && (
                        <span
                          onClick={handleClearSelectedReq}
                          className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                          title="Clear selection"
                        >
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isReqDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Floating Dropdown Menu */}
                  {isReqDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in duration-100">
                      {/* Search Filter input */}
                      <div className="p-2 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={reqSearchFilter}
                            onChange={(e) => setReqSearchFilter(e.target.value)}
                            placeholder="Filter by product name, ID, category..."
                            className="w-full text-xs pl-8 pr-3 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      {/* List of requirements */}
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReqId('');
                            setIsReqDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-slate-500 hover:bg-slate-50 text-xs italic"
                        >
                          -- Deselect / Enter Product Manually Below --
                        </button>

                        {filteredRequirements.length === 0 ? (
                          <div className="px-3 py-3 text-center text-slate-400 text-xs">
                            No matching requirements found in Excel.
                          </div>
                        ) : (
                          filteredRequirements.map((r) => (
                            <button
                              key={r.requirement_id}
                              type="button"
                              onClick={() => handleSelectRequirement(r)}
                              className={`w-full text-left px-3 py-2.5 hover:bg-sky-50/60 transition-colors flex items-start justify-between gap-2 text-xs ${
                                selectedReqId === r.requirement_id ? 'bg-sky-50 font-semibold' : ''
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                    {r.requirement_id}
                                  </span>
                                  <span className="font-bold text-slate-800 truncate">{r.product_name}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                  {r.category} • {r.specifications || 'Standard specifications'}
                                </div>
                              </div>
                              <div className="text-right shrink-0 text-[11px]">
                                <div className="font-semibold text-emerald-700">
                                  {r.currency} {parseFloat(r.target_price || 0).toFixed(2)}
                                </div>
                                <div className="text-slate-400">Qty: {r.quantity}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Visual Divider between Dropdown and Manual Product Entry */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  OR ENTER &amp; SOURCE NEW PRODUCT MANUALLY
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* Option B: Manual Product Entry Panel */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-sky-600" />
                    <span>Direct Product Entry &amp; Requirement Creator</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Search immediately or save to BOM Tracker</span>
                </div>

                {/* Product Name Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Product / Component Name *
                  </label>
                  <input
                    type="text"
                    value={directProductName}
                    onChange={(e) => handleDirectProductNameChange(e.target.value)}
                    placeholder="e.g. Digital Automatic Temperature Scanner 16 Channel, Ball Bearing 6205-2RS..."
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* Manual Validation Error Banner */}
                {manualValidationError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>{manualValidationError}</span>
                  </div>
                )}

                {/* Save Success Notice Banner */}
                {saveSuccessMsg && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{saveSuccessMsg}</span>
                  </div>
                )}

                {/* Relevant Optional Fields: Category, Specs, Quantity, Target Price, Lead Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {INDUSTRIAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Target Lead Time
                    </label>
                    <input
                      type="text"
                      value={manualLeadTime}
                      onChange={(e) => setManualLeadTime(e.target.value)}
                      placeholder="e.g. 14 days, 3 weeks"
                      className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Required Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={manualQuantity}
                      onChange={(e) => setManualQuantity(e.target.value)}
                      placeholder="100"
                      className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Target Unit Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={manualTargetPrice}
                        onChange={(e) => setManualTargetPrice(e.target.value)}
                        placeholder="50.00"
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Currency
                      </label>
                      <select
                        value={manualCurrency}
                        onChange={(e) => setManualCurrency(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="USD">USD</option>
                        <option value="INR">INR</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Technical Specifications (Tolerances, Channels, Dimensions, Materials)
                    </label>
                    <textarea
                      rows={2}
                      value={manualSpecs}
                      onChange={(e) => setManualSpecs(e.target.value)}
                      placeholder="e.g. 16-channel universal input RTD/TC scanner, 1/4 DIN panel mount, 85-265V AC power supply"
                      className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* Actions & Distinction */}
                <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-500 leading-tight">
                    <strong>Search Only:</strong> Search suppliers immediately without saving.<br />
                    <strong>Save to Excel:</strong> Store in Product Requirements for BOM reuse.
                  </p>

                  <button
                    type="button"
                    onClick={handleSaveManualRequirement}
                    disabled={isSavingRequirement || !directProductName.trim()}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isSavingRequirement ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving to Excel...</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Save Product Requirement</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMAGE-BASED SEARCH (Upload, Preview, Vision AI, Review & Edit) */}
          {searchMode === 'image' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 text-xs">
                  1. Upload Product Image for Visual Recognition
                </label>

                {!imagePreview ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-sky-500 transition-colors bg-slate-50/60 cursor-pointer">
                    <input
                      type="file"
                      id="product-image-upload"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <label htmlFor="product-image-upload" className="cursor-pointer flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 mb-2">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-slate-800 text-xs">
                        Click to upload or drag & drop product photo
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        Supported: JPG, PNG, WEBP (Max 10MB)
                      </span>
                    </label>
                  </div>
                ) : (
                  /* Image Preview Card */
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex items-start gap-4">
                      <img
                        src={imagePreview}
                        alt="Product Preview"
                        className="w-24 h-24 object-cover rounded-lg border border-slate-300 shrink-0 bg-white shadow-xs"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs truncate">
                            {imageFile?.name}
                          </span>
                          <button
                            type="button"
                            onClick={handleClearImage}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                            title="Remove Image"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Size: {(imageFile?.size / 1024).toFixed(1)} KB • Type: {imageFile?.type}
                        </p>

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => analyzeImageFile()}
                            disabled={isAnalyzingImage}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzingImage ? 'animate-spin text-sky-600' : 'text-slate-500'}`} />
                            <span>{isAnalyzingImage ? 'Analyzing...' : 'Re-Analyze with Vision AI'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Image Recognition Progress */}
              {isAnalyzingImage && (
                <div className="p-3.5 rounded-lg bg-sky-50 border border-sky-100 flex items-center gap-3 text-xs text-sky-800 animate-pulse">
                  <Sparkles className="w-4 h-4 text-sky-600 shrink-0 animate-spin" />
                  <span>Vision AI is inspecting component geometry, surface finish, markings, and standards...</span>
                </div>
              )}

              {/* Review & Edit Identified Product Name Section */}
              {imageAnalysisResult && !isAnalyzingImage && (
                <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-600" />
                      <h4 className="font-bold text-xs text-slate-800">
                        Review & Confirm Identified Product Details
                      </h4>
                    </div>
                    {imageAnalysisResult.confidence > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        {Math.round(imageAnalysisResult.confidence * 100)}% Confidence ({imageAnalysisResult.ai_provider})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3" />
                        User Input Required
                      </span>
                    )}
                  </div>

                  {/* Low Confidence / Fallback Prompt */}
                  {imageAnalysisResult.requires_user_input && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Manual Verification Required: </strong>
                        {imageAnalysisResult.message}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Identified Product Name * (Review / Edit)
                      </label>
                      <input
                        type="text"
                        value={identifiedProductName}
                        onChange={(e) => setIdentifiedProductName(e.target.value)}
                        placeholder="e.g. Digital Automatic Temperature Scanner 16 Channel"
                        className="w-full text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Model / Part Number (e.g. DP1001AM, 6205-2RS, 16-CH)
                      </label>
                      <input
                        type="text"
                        value={identifiedModel}
                        onChange={(e) => setIdentifiedModel(e.target.value)}
                        placeholder="e.g. DP1001AM or 6205-2RS"
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Brand / Manufacturer
                      </label>
                      <input
                        type="text"
                        value={identifiedBrand}
                        onChange={(e) => setIdentifiedBrand(e.target.value)}
                        placeholder="e.g. Dwyer Omega, Masibus, Radix, SKF"
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Category
                      </label>
                      <input
                        type="text"
                        value={identifiedCategory}
                        onChange={(e) => setIdentifiedCategory(e.target.value)}
                        placeholder="e.g. Process Instrumentation & Monitoring"
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Visible Specifications (Channels, Inputs, Ratings, Dimensions)
                      </label>
                      <textarea
                        rows={2}
                        value={identifiedSpecs}
                        onChange={(e) => setIdentifiedSpecs(e.target.value)}
                        placeholder="e.g. 16-channel digital scanner, RTD Pt100/TC universal inputs, 1/4 DIN panel mount, rear screw terminals"
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {identifiedPhysicalFeatures && (
                      <div className="md:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Distinguishing Physical Features
                        </label>
                        <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                          {identifiedPhysicalFeatures}
                        </p>
                      </div>
                    )}
                  </div>

                  {imageAnalysisResult.details && (
                    <p className="text-[11px] text-slate-500 italic">
                      Feature notes: {imageAnalysisResult.details}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Choose Portal (Shared across both modes) */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block font-bold text-slate-700 mb-2 text-xs">
              2. Choose Permitted Supplier Portal
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PORTALS.map((portal) => (
                <label
                  key={portal.id}
                  className={`flex flex-col justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedPortal === portal.id
                      ? 'border-sky-500 bg-sky-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800 text-xs">{portal.name}</span>
                      <input
                        type="radio"
                        name="portal"
                        value={portal.id}
                        checked={selectedPortal === portal.id}
                        onChange={(e) => setSelectedPortal(e.target.value)}
                        className="w-3.5 h-3.5 text-sky-600 focus:ring-sky-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-2">{portal.desc}</p>
                  </div>
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${portal.badgeColor}`}>
                      {portal.badge}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Step 3: Location Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 text-xs">
              3. Optional Geographic Region Filter
            </label>
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="e.g. USA, Germany, Ohio, China"
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Search Trigger Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleStartSearch}
              disabled={isSearching || isAnalyzingImage || (searchMode === 'image' ? !identifiedProductName.trim() : (!directProductName.trim() && !selectedReqId))}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Searching Authorized Sources...</span>
                </>
              ) : searchMode === 'image' ? (
                <>
                  <ImageIcon className="w-4 h-4" />
                  <span>
                    Search by Image: {identifiedProductName ? `"${identifiedProductName}"` : 'Upload & Identify Image First'}
                  </span>
                </>
              ) : selectedReqId && activeReq ? (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search Suppliers for [{activeReq.requirement_id}] {activeReq.product_name}</span>
                </>
              ) : directProductName.trim() ? (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search Suppliers for "{directProductName.trim()}" (Search Only)</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Initiate Supplier Search (Select Requirement or Enter Product)</span>
                </>
              )}
            </button>
          </div>

          {/* Real-time Progress Display */}
          {searchProgress && (
            <div className="p-3.5 rounded-lg bg-sky-50 border border-sky-100 flex items-center gap-3 text-xs text-sky-800 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-sky-600" />
              <span>{searchProgress}</span>
            </div>
          )}
        </div>

        {/* Right Col: Active Target Spec Summary & Vision AI Config Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-sky-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {searchMode === 'image' ? 'Visual Search Query' : 'Selected Target Spec'}
              </h3>
            </div>

            {searchMode === 'image' ? (
              <div className="space-y-3 text-xs">
                {imagePreview && (
                  <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <img
                      src={imagePreview}
                      alt="Uploaded reference"
                      className="w-12 h-12 object-contain rounded border border-slate-200 bg-white"
                    />
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Reference Image</span>
                      <span className="text-xs font-bold text-slate-800 line-clamp-1">{identifiedProductName || 'Uploaded image'}</span>
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Query Product</span>
                  <span className="font-bold text-slate-800">
                    {identifiedProductName || 'Upload an image on the left'}
                  </span>
                </div>
                {identifiedModel && (
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Model / Part No.</span>
                    <span className="font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">{identifiedModel}</span>
                  </div>
                )}
                {identifiedBrand && (
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Brand</span>
                    <span className="font-semibold text-slate-700">{identifiedBrand}</span>
                  </div>
                )}
                {identifiedCategory && (
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Category</span>
                    <span className="font-semibold text-slate-700">{identifiedCategory}</span>
                  </div>
                )}
                {identifiedSpecs && (
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Specifications</span>
                    <p className="text-[11px] text-slate-600 mt-0.5 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      {identifiedSpecs}
                    </p>
                  </div>
                )}
              </div>
            ) : selectedReqId && activeReq ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                    BOM Tracker: {activeReq.requirement_id}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSelectedReq}
                    className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" />
                    <span>Deselect</span>
                  </button>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Product</span>
                  <span className="font-bold text-slate-800">{activeReq.product_name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Category</span>
                    <span className="font-semibold text-slate-700">{activeReq.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Quantity</span>
                    <span className="font-semibold text-slate-700">{activeReq.quantity} units</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Target Unit Price</span>
                    <span className="font-semibold text-emerald-700">{activeReq.currency} {activeReq.target_price?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Target Lead Time</span>
                    <span className="font-semibold text-slate-700">{activeReq.delivery_requirement || 'Flexible'}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Specifications</span>
                  <p className="text-[11px] text-slate-600 mt-0.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {activeReq.specifications}
                  </p>
                </div>
              </div>
            ) : directProductName.trim() ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Direct Search (Unsaved)
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveManualRequirement}
                    disabled={isSavingRequirement}
                    className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Save to Excel</span>
                  </button>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Target Product Name</span>
                  <span className="font-bold text-slate-800">{directProductName.trim()}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Category</span>
                    <span className="font-semibold text-slate-700">{manualCategory || 'Industrial Components'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Quantity</span>
                    <span className="font-semibold text-slate-700">{manualQuantity || 100} units</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Target Unit Price</span>
                    <span className="font-semibold text-emerald-700">{manualCurrency || 'USD'} {parseFloat(manualTargetPrice || 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Target Lead Time</span>
                    <span className="font-semibold text-slate-700">{manualLeadTime || '14 days'}</span>
                  </div>
                </div>
                {manualSpecs.trim() && (
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Specifications</span>
                    <p className="text-[11px] text-slate-600 mt-0.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {manualSpecs.trim()}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Select a requirement from BOM Tracker or enter a product name on the left.</p>
            )}
          </div>

          {/* Secure Vision AI Configuration Guidance Card (Requirement 11) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Key className="w-4 h-4 text-sky-600" />
              <h3 className="font-bold text-slate-800 text-xs">Vision AI Security & Setup</h3>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              To keep your credentials secure, API keys are <strong>never exposed in frontend code</strong>.
            </p>
            <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg text-[10px] font-mono leading-relaxed">
              # In backend/.env<br />
              GEMINI_API_KEY=your_key_here<br />
              # or OPENAI_API_KEY=your_key
            </div>
            <p className="text-[10px] text-slate-500">
              Without cloud keys, the local intelligent component recognizer automatically identifies common manufacturing parts.
            </p>
          </div>
        </div>
      </div>

      {/* Discovered Supplier Listings Table */}
      {searchResponse && searchResponse.status === 'COMPLETED' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Discovered Suppliers ({searchResponse.results_count})
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{searchResponse.notes}</p>
            </div>

            {searchResponse.results_count > 0 && (
              <div className="flex items-center gap-2">
                {savedCount > 0 ? (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{savedCount} Suppliers Appended to Sourcing Tracker!</span>
                  </span>
                ) : (
                  <button
                    onClick={handleSaveDiscoveredDealers}
                    disabled={isSearching}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add All to Sourcing Tracker (Excel)</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    const q = searchMode === 'image' ? identifiedProductName : (directProductName || activeReq?.product_name || '');
                    navigate(`/dealers?search=${encodeURIComponent(q)}`);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span>View in Dealer Directory</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Reference Image Overview Bar (when visual search was performed) */}
          {searchMode === 'image' && imagePreview && (
            <div className="px-4 py-3 bg-sky-50/60 border-b border-sky-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={imagePreview}
                  alt="Target Reference"
                  className="w-12 h-12 object-contain rounded-lg border border-sky-200 bg-white p-0.5 shrink-0"
                />
                <div className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                      Reference Upload
                    </span>
                    <span className="font-bold text-slate-900">{identifiedProductName}</span>
                    {identifiedModel && (
                      <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                        Model: {identifiedModel}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                    {identifiedSpecs || 'Target specifications analyzed via Vision AI'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Alert when no exact match exists */}
          {searchResponse.results.length > 0 &&
            !searchResponse.results.some((r) => r.match_status === 'Exact Match') && (
              <div className="p-3.5 bg-amber-50/80 border-b border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">No Exact Model Match Verified from Supplier Listings</span>
                  <span className="text-[11px] text-amber-800">
                    No supplier listing matched 100% of exact model designation and technical specifications. Showing closest compatible alternatives, related product families, and listings requiring verification below.
                  </span>
                </div>
              </div>
            )}

          {searchResponse.results.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 space-y-2">
              <Info className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">No matching suppliers found in this query</p>
              <p>Try relaxing location filters or add a verified supplier via Manual Entry.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 w-16 text-center">Image</th>
                    <th className="px-4 py-3">Supplier & Source</th>
                    <th className="px-4 py-3">Offered Product</th>
                    <th className="px-4 py-3">Match Status</th>
                    <th className="px-4 py-3">Technical Match & Specifications</th>
                    <th className="px-4 py-3">Commercials</th>
                    <th className="px-3 py-3 text-center">Contact</th>
                    <th className="px-3 py-3 text-right">Listing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {searchResponse.results.map((item, idx) => {
                    const u = (item.product_url || '').toLowerCase();
                    const s = (item.source_portal || '').toLowerCase();
                    let portalLabel = 'Manufacturer';
                    let portalColor = 'bg-slate-100 text-slate-700 border-slate-200';

                    if (s.includes('indiamart') || u.includes('indiamart.com')) {
                      const isProd = u.includes('/proddetail/') || u.includes('/product/');
                      portalLabel = isProd ? 'IndiaMART Product Page' : 'IndiaMART Directory';
                      portalColor = 'bg-amber-50 text-amber-700 border-amber-200';
                    } else if (u.endsWith('.pdf') || s.includes('datasheet')) {
                      portalLabel = 'Technical Datasheet';
                      portalColor = 'bg-purple-50 text-purple-700 border-purple-200';
                    } else if (s.includes('distributor')) {
                      portalLabel = 'Authorized Distributor';
                      portalColor = 'bg-sky-50 text-sky-700 border-sky-200';
                    } else if (s.includes('verified') || s.includes('local')) {
                      portalLabel = 'Verified Directory';
                      portalColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors align-top">
                        {/* Candidate Product Image */}
                        <td className="px-3 py-3 text-center">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.product_name}
                              className="w-12 h-12 object-contain rounded-lg border border-slate-200 bg-white p-0.5 mx-auto"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 mx-auto">
                              <ImageIcon className="w-4 h-4 opacity-40" />
                              <span className="text-[8px] mt-0.5">No img</span>
                            </div>
                          )}
                        </td>

                        {/* Supplier Name & Source Portal Badge */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-xs">{item.dealer_name}</div>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${portalColor}`}>
                            {portalLabel}
                          </span>
                          <div className="text-[11px] text-slate-500 mt-1">{item.location}</div>
                        </td>

                        {/* Offered Product */}
                        <td className="px-4 py-3 max-w-xs">
                          {item.product_url ? (
                            <a
                              href={item.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-slate-900 hover:text-sky-600 transition-colors inline-flex items-center gap-1 group text-xs"
                            >
                              <span>{item.product_name}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-sky-600 shrink-0" />
                            </a>
                          ) : (
                            <span className="font-semibold text-slate-900 text-xs">{item.product_name}</span>
                          )}
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed" title={item.specifications}>
                            {item.specifications}
                          </p>
                        </td>

                        {/* Match Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={item.match_status} type="match" />
                        </td>

                        {/* Technical Evaluation & Specs Breakdown */}
                        <td className="px-4 py-3 max-w-sm space-y-1.5">
                          {item.matching_specs && item.matching_specs.length > 0 && (
                            <div className="flex items-start gap-1 text-[11px] text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span>
                                <strong>Matching: </strong>
                                {item.matching_specs.join(' • ')}
                              </span>
                            </div>
                          )}
                          {item.missing_specs && item.missing_specs.length > 0 && (
                            <div className="flex items-start gap-1 text-[11px] text-amber-800">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span>
                                <strong>Unconfirmed / Differing: </strong>
                                {item.missing_specs.join(' • ')}
                              </span>
                            </div>
                          )}
                          {item.match_evidence && (
                            <div className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100 italic">
                              {item.match_evidence}
                            </div>
                          )}
                        </td>

                        {/* Commercials */}
                        <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                          <div className="font-bold text-slate-900 text-xs">
                            {item.listed_price ? `$${item.listed_price.toFixed(2)}` : 'RFQ Required'}
                          </div>
                          <div className="text-slate-500 mt-0.5">MOQ: {item.moq || 'N/A'}</div>
                          <div className="text-slate-500">Lead: {item.delivery_time || 'N/A'}</div>
                        </td>

                        {/* Contact Action */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setActiveContactItem(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 font-semibold text-[11px] transition-colors"
                            title="Contact Supplier (Email / WhatsApp / Portal)"
                          >
                            <Mail className="w-3 h-3 text-sky-600" />
                            <span>Contact</span>
                          </button>
                        </td>

                        {/* Direct Listing Link */}
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {item.product_url ? (
                            <a
                              href={item.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-semibold text-[11px]"
                            >
                              <span>Listing</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400">Direct</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Manual Entry Modal */}
      {isManualModalOpen && (
        <ManualSupplierModal
          requirementId={selectedReqId}
          requirements={requirements}
          onClose={() => setIsManualModalOpen(false)}
          onSuccess={() => {
            navigate(`/dealers?requirement_id=${selectedReqId}`);
          }}
        />
      )}

      {/* Contact Supplier Modal */}
      {activeContactItem && (
        <ContactSupplierModal
          supplier={activeContactItem}
          requirement={activeReq || {
            requirement_id: searchResponse?.requirement_id || selectedReqId || 'REQ-SEARCH',
            product_name: searchMode === 'image' ? identifiedProductName : (directProductName || 'Industrial Part'),
            category: searchMode === 'image' ? identifiedCategory : 'Industrial Components',
            specifications: searchMode === 'image' ? identifiedSpecs : directProductName,
            quantity: 100,
            currency: 'USD'
          }}
          onClose={() => setActiveContactItem(null)}
          onLogged={() => {}}
        />
      )}
    </div>
  );
}
