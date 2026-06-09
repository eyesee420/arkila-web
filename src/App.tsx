import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './contexts/ToastContext';
import { ActivePropertyProvider } from './contexts/ActivePropertyContext';
import { Layout } from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import Units from './pages/Units';
import Tenants from './pages/Tenants';
import RentPayments from './pages/RentPayments';
import Utilities from './pages/Utilities';
import Expenses from './pages/Expenses';
import Documents from './pages/Documents';
import NotificationsPage from './pages/NotificationsPage';
import Reports from './pages/Reports';
import Receipts from './pages/Receipts';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ActivePropertyProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="properties" element={<Properties />} />
              <Route path="units" element={<Units />} />
              <Route path="tenants" element={<Tenants />} />
              <Route path="rent-payments" element={<RentPayments />} />
              <Route path="utilities" element={<Utilities />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="documents" element={<Documents />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="reports" element={<Reports />} />
              <Route path="receipts" element={<Receipts />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
      </ActivePropertyProvider>
    </QueryClientProvider>
  );
}
