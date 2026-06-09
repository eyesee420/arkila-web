import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Building2, DoorOpen, Users, Banknote,
  Zap, Wrench, FileText, Bell, BarChart2, Printer, X, ChevronDown,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useActiveProperty } from '@/contexts/ActivePropertyContext';
import { cn } from '@/lib/utils';

const nav = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Building2, label: 'Properties', path: '/properties' },
  { icon: DoorOpen, label: 'Units', path: '/units' },
  { icon: Users, label: 'Tenants', path: '/tenants' },
  { icon: Banknote, label: 'Rent Payments', path: '/rent-payments' },
  { icon: Zap, label: 'Utilities', path: '/utilities' },
  { icon: Wrench, label: 'Expenses', path: '/expenses' },
  { icon: FileText, label: 'Documents', path: '/documents' },
  { icon: Bell, label: 'Notifications', path: '/notifications' },
  { icon: BarChart2, label: 'Reports', path: '/reports' },
  { icon: Printer, label: 'Receipts', path: '/receipts' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const properties = useLiveQuery(() => db.properties.orderBy('name').toArray());
  const { activePropertyId, setActivePropertyId } = useActiveProperty();

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-slate-900 z-40 flex flex-col transition-transform duration-300',
          'lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-base leading-none">Arkila</h1>
              <p className="text-slate-400 text-xs mt-0.5">Property Manager</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden text-slate-400 hover:text-white cursor-pointer p-1 transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Property selector */}
        {(properties || []).length > 0 && (
          <div className="px-3 py-3 border-b border-white/8">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Property</p>
            <div className="relative">
              <select
                value={activePropertyId ?? ''}
                onChange={e => setActivePropertyId(e.target.value ? Number(e.target.value) : null)}
                className="w-full appearance-none bg-white/10 text-white text-sm rounded-lg pl-3 pr-8 py-2 border border-white/15 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-white">All Properties</option>
                {(properties || []).map(p => (
                  <option key={p.id} value={p.id!} className="bg-slate-900 text-white">{p.name}</option>
                ))}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {nav.map(({ icon: Icon, label, path }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={() => { if (window.innerWidth < 1024) onClose(); }}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5',
                )
              }
            >
              <Icon size={17} className="shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/8">
          <p className="text-slate-500 text-xs text-center">Arkila v1.0 · For Filipino Landlords</p>
        </div>
      </aside>
    </>
  );
}
