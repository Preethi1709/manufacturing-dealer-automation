import React, { useState } from 'react';
import { X, Plus, Building2 } from 'lucide-react';
import { apiService } from '../services/api';

export default function ManualSupplierModal({ requirementId, requirements = [], onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    requirement_id: requirementId || (requirements[0]?.requirement_id || ''),
    dealer_name: '',
    product_name: '',
    specifications: '',
    public_contact_number: '',
    business_email: '',
    location: '',
    source_portal: 'Manual Entry',
    product_url: '',
    listed_price: '',
    confirmed_quoted_price: '',
    currency: 'USD',
    moq: '',
    delivery_time: '',
    taxes: '',
    delivery_charges: '',
    verification_status: 'Pending Verification',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.dealer_name || !formData.product_name || !formData.location || !formData.requirement_id) {
      setError('Please fill in required fields: Supplier Name, Product Name, Requirement, and Location.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        ...formData,
        listed_price: formData.listed_price ? parseFloat(formData.listed_price) : null,
        confirmed_quoted_price: formData.confirmed_quoted_price ? parseFloat(formData.confirmed_quoted_price) : null,
        moq: formData.moq ? parseFloat(formData.moq) : null,
        taxes: formData.taxes ? parseFloat(formData.taxes) : null,
        delivery_charges: formData.delivery_charges ? parseFloat(formData.delivery_charges) : null,
      };

      await apiService.createDealer(payload);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save supplier to Excel.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-sky-600" />
            <h3 className="text-base font-bold text-slate-800">Add Supplier Listing</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Requirement *
              </label>
              <select
                name="requirement_id"
                value={formData.requirement_id}
                onChange={handleChange}
                required
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">-- Select Requirement --</option>
                {requirements.map((r) => (
                  <option key={r.requirement_id} value={r.requirement_id}>
                    {r.requirement_id} - {r.product_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier / Company Name *
              </label>
              <input
                type="text"
                name="dealer_name"
                value={formData.dealer_name}
                onChange={handleChange}
                required
                placeholder="e.g. Acme Precision Fasteners LLC"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Offered Product Name *
              </label>
              <input
                type="text"
                name="product_name"
                value={formData.product_name}
                onChange={handleChange}
                required
                placeholder="e.g. Ground Precision Linear Shaft SS316"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier Location (City, Country) *
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                placeholder="e.g. Chicago, IL, USA"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detailed Technical Specifications
              </label>
              <textarea
                name="specifications"
                value={formData.specifications}
                onChange={handleChange}
                rows={2}
                placeholder="e.g. Material: SS316L, 25mm dia x 300mm length, Ra 0.4, DIN 912 Class 12.9"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catalog / Listed Unit Price
              </label>
              <input
                type="number"
                step="0.01"
                name="listed_price"
                value={formData.listed_price}
                onChange={handleChange}
                placeholder="e.g. 19.50"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirmed Quoted Price (if received)
              </label>
              <input
                type="number"
                step="0.01"
                name="confirmed_quoted_price"
                value={formData.confirmed_quoted_price}
                onChange={handleChange}
                placeholder="e.g. 18.00"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Minimum Order Quantity (MOQ)
              </label>
              <input
                type="number"
                name="moq"
                value={formData.moq}
                onChange={handleChange}
                placeholder="e.g. 100"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quoted Lead Time / Delivery
              </label>
              <input
                type="text"
                name="delivery_time"
                value={formData.delivery_time}
                onChange={handleChange}
                placeholder="e.g. 10 days, 3 weeks"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Public Business Phone
              </label>
              <input
                type="text"
                name="public_contact_number"
                value={formData.public_contact_number}
                onChange={handleChange}
                placeholder="e.g. +1-800-555-0199"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Email
              </label>
              <input
                type="email"
                name="business_email"
                value={formData.business_email}
                onChange={handleChange}
                placeholder="e.g. sales@supplier.com"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Source Portal / Channel
              </label>
              <select
                name="source_portal"
                value={formData.source_portal}
                onChange={handleChange}
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="Manual Entry">Manual Entry / Direct Inquiry</option>
                <option value="Verified Industrial Directory">Verified Industrial Directory</option>
                <option value="ThomasNet">ThomasNet Portal</option>
                <option value="IndiaMART">IndiaMART Portal</option>
                <option value="Alibaba">Alibaba Portal</option>
                <option value="Direct Manufacturer">Direct Manufacturer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product / Catalog URL
              </label>
              <input
                type="url"
                name="product_url"
                value={formData.product_url}
                onChange={handleChange}
                placeholder="https://supplier.com/item"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? 'Evaluating & Saving...' : 'Save Supplier to Excel'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
