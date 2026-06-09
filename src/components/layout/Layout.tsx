import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Bell } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { Link } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/properties': 'Properties',
  '/units': 'Units',
  '/tenants': 'Tenants',
  '/rent-payments': 'Rent Payments',
  '/utilities': 'Utilities',
  '/expenses': 'Expenses',
  '/documents': 'Documents',
  '/notifications': 'Notifications',
  '/reports': 'Reports',
  '/receipts': 'Receipts',
};

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Arkila';

  const unreadCount = useLiveQuery(
    () => db.notifications.filter(n => !n.isRead).count(),
    [],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:ml-64 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 lg:px-6 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden text-gray-500 hover:text-gray-700 cursor-pointer p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <h2 className="font-semibold text-gray-900 text-base">{title}</h2>
          </div>

          <Link
            to="/notifications"
            aria-label={unreadCount ? `Notifications — ${unreadCount} unread` : 'Notifications'}
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell size={19} aria-hidden="true" />
            {unreadCount != null && unreadCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
