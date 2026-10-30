import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import ProductRequirements from './pages/ProductRequirements';
import DealerSearch from './pages/DealerSearch';
import DealerResults from './pages/DealerResults';
import DealerDetails from './pages/DealerDetails';
import QuotationComparison from './pages/QuotationComparison';
import ContactLog from './pages/ContactLog';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="requirements" element={<ProductRequirements />} />
          <Route path="search" element={<DealerSearch />} />
          <Route path="dealers" element={<DealerResults />} />
          <Route path="dealers/:dealerId" element={<DealerDetails />} />
          <Route path="comparison" element={<QuotationComparison />} />
          <Route path="contacts" element={<ContactLog />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
