import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Search,
  Users,
  GitCompare,
  Mail,
  ShieldCheck,
  FileText
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Product Requirements', path: '/requirements', icon: FileSpreadsheet },
  { name: 'Dealer Search', path: '/search', icon: Search },
  { name: 'Dealer Results', path: '/dealers', icon: Users },
  { name: 'Quotation Comparison', path: '/comparison', icon: GitCompare },
  { name: 'Contact & Follow-up', path: '/contacts', icon: Mail },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-lg">
            ⚙️
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide uppercase">Mfg Sourcing</h1>
            <p className="text-xs text-slate-400">Dealer Automation Suite</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Procurement Pipeline
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Primary Data Store Status */}
      <div className="p-4 border-t border-slate-800">
        <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Excel Data Store
            </span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            Dealer_Sourcing_Tracker.xlsx
          </p>
          <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-700/50 pt-1.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-sky-400" />
            <span>Thread-Safe File Sync</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
