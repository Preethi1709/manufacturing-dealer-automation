import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  Plus,
  Download,
  Search,
  CheckCircle,
  AlertCircle,
  Edit2,
  PackageCheck,
  RefreshCw
} from 'lucide-react';
import { apiService } from '../services/api';

const CATEGORIES = [
  'Precision Machined Parts',
  'Bearings & Power Transmission',
  'Fasteners & Hardware',
  'Polymers & Plastics',
  'Hydraulics & Pneumatics',
  'Raw Materials & Fabrication',
  'Electrical & Electronics',
  'Tooling, Jigs & Fixtures',
  'Pumps, Valves & Piping'
];

export default function ProductRequirements() {
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    product_name: '',
    category: 'Precision Machined Parts',
    specifications: '',
    material: '',
    size: '',
    grade: '',
    model: '',
    quantity: '',
    target_price: '',
    currency: 'USD',
    preferred_location: '',
    delivery_requirement: '',
    additional_requirements: '',
  });

  useEffect(() => {
    fetchRequirements();
  }, []);

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiService.getRequirements();
      setRequirements(data);
    } catch (err) {
      setError('Failed to load product requirements from Excel: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product_name.trim()) {
      setError('Product Name is required.');
      return;
    }
    if (!formData.specifications.trim()) {
      setError('Detailed technical specifications are required.');
      return;
    }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      setError('Required Quantity must be greater than 0.');
      return;
    }
    if (!formData.target_price || parseFloat(formData.target_price) < 0) {
      setError('Target Unit Price must be a non-negative number.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccessMsg('');

      const payload = {
        ...formData,
        quantity: parseFloat(formData.quantity),
        target_price: parseFloat(formData.target_price),
      };

      const res = await apiService.createRequirement(payload);
      setSuccessMsg(`Requirement ${res.requirement_id} successfully created and written to Product_Requirements worksheet.`);
      
      // Reset form
      setFormData({
        product_name: '',
        category: 'Precision Machined Parts',
        specifications: '',
        material: '',
        size: '',
        grade: '',
        model: '',
        quantity: '',
        target_price: '',
        currency: 'USD',
        preferred_location: '',
        delivery_requirement: '',
        additional_requirements: '',
      });
      setIsFormOpen(false);
      fetchRequirements();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save requirement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await apiService.exportRequirementsExcel();
    } catch (err) {
      alert('Export failed: ' + (err.message || ''));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Product Requirements Management</h2>
          <p className="text-xs text-slate-500">
            Define bill of materials (BOM) specifications and benchmark targets saved to Excel primary storage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{exporting ? 'Downloading...' : 'Export Requirements (.xlsx)'}</span>
          </button>
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isFormOpen ? 'Close Form' : 'New Product Requirement'}</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-700 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Collapsible New Requirement Form */}
      {isFormOpen && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Add New Manufacturing Requirement</h3>
              <p className="text-xs text-slate-500">
                Data will be validated and appended directly to the <span className="font-mono text-slate-700">Product_Requirements</span> sheet.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">* Required fields</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Product / Component Name *
                </label>
                <input
                  type="text"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Stainless Steel Linear Shaft"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Product Category *
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Material Composition / Alloy
                </label>
                <input
                  type="text"
                  name="material"
                  value={formData.material}
                  onChange={handleChange}
                  placeholder="e.g. SS 316L, 6061-T6, POM-C"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Size / Dimensions
                </label>
                <input
                  type="text"
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  placeholder="e.g. Dia 25mm x 300mm length"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Quality Grade / Standard
                </label>
                <input
                  type="text"
                  name="grade"
                  value={formData.grade}
                  onChange={handleChange}
                  placeholder="e.g. DIN 912, Class 12.9, ABEC-3"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Model / Part Number
                </label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  placeholder="e.g. PS-25-300-316"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Required Order Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  required
                  placeholder="e.g. 500"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Unit Price *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="target_price"
                  value={formData.target_price}
                  onChange={handleChange}
                  required
                  placeholder="e.g. 20.00"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Currency
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Preferred Supplier Location
                </label>
                <input
                  type="text"
                  name="preferred_location"
                  value={formData.preferred_location}
                  onChange={handleChange}
                  placeholder="e.g. Midwest USA, North America, Germany"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Required Delivery Timeline
                </label>
                <input
                  type="text"
                  name="delivery_requirement"
                  value={formData.delivery_requirement}
                  onChange={handleChange}
                  placeholder="e.g. 14 days, 3 weeks"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Additional Quality / Packaging Terms
                </label>
                <input
                  type="text"
                  name="additional_requirements"
                  value={formData.additional_requirements}
                  onChange={handleChange}
                  placeholder="e.g. MTR test certificate, ISO 9001, lot traceable"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">
                  Detailed Technical Specifications & Tolerances *
                </label>
                <textarea
                  name="specifications"
                  value={formData.specifications}
                  onChange={handleChange}
                  required
                  rows={3}
                  placeholder="e.g. CNC turned ground linear shaft, Material: SS 316L, Diameter: 25mm (+/-0.005mm), Length: 300mm, Ra 0.4 surface finish, Passivated"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{submitting ? 'Writing to Excel...' : 'Save Requirement to Excel'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Existing Requirements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Tracked Product Requirements ({requirements.length})
            </h3>
          </div>
          <button
            onClick={fetchRequirements}
            className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
            <span>Reading from Excel workbook...</span>
          </div>
        ) : requirements.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <PackageCheck className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700">No Product Requirements Saved</p>
            <p>Click "New Product Requirement" above to add your first part specification.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Req ID</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Specs / Material</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Target Price</th>
                  <th className="px-4 py-3">Delivery Lead Time</th>
                  <th className="px-4 py-3">Preferred Region</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {requirements.map((req) => (
                  <tr key={req.requirement_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-sky-700 whitespace-nowrap">
                      {req.requirement_id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      {req.product_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-600">
                        {req.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-[11px] text-slate-500" title={req.specifications}>
                      {req.material ? <strong className="text-slate-700">{req.material} - </strong> : ''}
                      {req.specifications}
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {req.quantity?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-700 whitespace-nowrap">
                      {req.currency} {req.target_price?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {req.delivery_requirement || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {req.preferred_location || 'Global'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/search?requirement_id=${req.requirement_id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold text-[11px] transition-colors"
                          title="Search dealers for this product"
                        >
                          <Search className="w-3 h-3" />
                          <span>Search</span>
                        </button>
                        <button
                          onClick={() => navigate(`/dealers?requirement_id=${req.requirement_id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-[11px] transition-colors"
                          title="View suppliers found"
                        >
                          <span>Dealers</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
