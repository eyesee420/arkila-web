import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Printer, Eye } from 'lucide-react';
import { db, type RentPayment } from '@/db/database';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { statusBadge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, formatMonth, amountToWords, monthOptions, currentMonth, currentYear } from '@/lib/utils';
import { useActiveProperty } from '@/contexts/ActivePropertyContext';

interface ReceiptData {
  payment: RentPayment;
  tenantName: string;
  unitNumber: string;
  propertyName: string;
  propertyAddress: string;
}

export default function Receipts() {
  const { activePropertyId } = useActiveProperty();
  const [filterTenantId, setFilterTenantId] = useState('');
  const [filterMonth, setFilterMonth] = useState(String(currentMonth()));
  const [filterYear, setFilterYear] = useState(String(currentYear()));
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const properties = useLiveQuery(() => db.properties.toArray());
  const allUnits = useLiveQuery(() => db.units.toArray());
  const tenants = useLiveQuery(async () => {
    const all = await db.tenants.toArray();
    return all.sort((a, b) => a.firstName.localeCompare(b.firstName));
  });
  const payments = useLiveQuery(async () => {
    const all = await db.rentPayments
      .where('status').anyOf(['paid', 'partial'])
      .toArray();
    return all.sort((a, b) => b.id! - a.id!); // newest first via auto-increment id
  });

  const propMap = Object.fromEntries((properties || []).map(p => [p.id!, p]));
  const unitMap = Object.fromEntries((allUnits || []).map(u => [u.id!, u]));
  const tenantMap = Object.fromEntries((tenants || []).map(t => [t.id!, t]));
  const tenantOptions = (tenants || [])
    .filter(t => !activePropertyId || t.propertyId === activePropertyId)
    .map(t => ({ value: t.id!, label: `${t.firstName} ${t.lastName}` }));

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear() - 2 + i;
    return { value: y, label: String(y) };
  });

  const filtered = (payments || []).filter(p => {
    const pMatch = !activePropertyId || p.propertyId === activePropertyId;
    const tMatch = !filterTenantId || p.tenantId === Number(filterTenantId);
    const mMatch = !filterMonth || p.month === Number(filterMonth);
    const yMatch = !filterYear || p.year === Number(filterYear);
    return pMatch && tMatch && mMatch && yMatch;
  });

  function openReceipt(payment: RentPayment) {
    const tenant = tenantMap[payment.tenantId];
    const unit = unitMap[payment.unitId];
    const property = propMap[payment.propertyId];
    if (!tenant || !unit || !property) return;
    setReceiptData({
      payment,
      tenantName: `${tenant.firstName} ${tenant.lastName}`,
      unitNumber: unit.unitNumber,
      propertyName: property.name,
      propertyAddress: property.address,
    });
  }

  function handlePrint() {
    window.print();
  }

  if (!properties || !allUnits || !tenants || !payments) return <Spinner />;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <SelectField options={tenantOptions} placeholder="All Tenants" value={filterTenantId}
          onChange={e => setFilterTenantId(e.target.value)} className="w-48" />
        <SelectField options={monthOptions()} placeholder="All Months" value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)} className="w-36" />
        <SelectField options={yearOptions} placeholder="All Years" value={filterYear}
          onChange={e => setFilterYear(e.target.value)} className="w-28" />
      </div>

      <Card>
        <CardHeader title="Payment Receipts" subtitle={`${filtered.length} paid record${filtered.length !== 1 ? 's' : ''}`} />
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={<Printer size={32} />} title="No receipts found"
              description="Receipts are available for paid and partial payments." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-500">OR No.</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Tenant</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Unit</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Period</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Amount Paid</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Method</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Date</th>
                    <th className="text-center px-5 py-3 font-medium text-gray-500">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const tenant = tenantMap[p.tenantId];
                    const unit = unitMap[p.unitId];
                    return (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-500 font-mono text-xs">OR-{String(p.id).padStart(6, '0')}</td>
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {tenant ? `${tenant.firstName} ${tenant.lastName}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-600">{unit?.unitNumber || '—'}</td>
                        <td className="px-5 py-3 text-gray-600">{formatMonth(p.month, p.year)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                        <td className="px-5 py-3">{statusBadge(p.status)}</td>
                        <td className="px-5 py-3 text-gray-600 capitalize">{p.paymentMethod.replace('_', ' ')}</td>
                        <td className="px-5 py-3 text-gray-500">{p.paymentDate ? formatDate(p.paymentDate) : '—'}</td>
                        <td className="px-5 py-3 text-center">
                          <Button variant="ghost" size="sm" onClick={() => openReceipt(p)} className="text-blue-600 hover:text-blue-700">
                            <Eye size={14} />View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt modal */}
      <Modal
        open={receiptData !== null}
        onClose={() => setReceiptData(null)}
        title="Official Receipt"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceiptData(null)}>Close</Button>
            <Button onClick={handlePrint}><Printer size={14} />Print Receipt</Button>
          </>
        }
      >
        {receiptData && (
          <div ref={printRef} className="print-receipt">
            {/* Receipt content */}
            <div className="border-2 border-gray-800 rounded-lg p-6 font-mono">
              {/* Header */}
              <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
                <h2 className="text-xl font-bold uppercase tracking-widest">Official Receipt</h2>
                <p className="text-sm font-semibold mt-1">{receiptData.propertyName}</p>
                <p className="text-xs text-gray-600 mt-0.5">{receiptData.propertyAddress}</p>
              </div>

              {/* OR Number + Date */}
              <div className="flex justify-between text-xs mb-4">
                <div>
                  <span className="text-gray-500">OR No.: </span>
                  <span className="font-bold">OR-{String(receiptData.payment.id).padStart(6, '0')}</span>
                </div>
                <div>
                  <span className="text-gray-500">Date: </span>
                  <span className="font-bold">
                    {receiptData.payment.paymentDate ? formatDate(receiptData.payment.paymentDate) : formatDate(receiptData.payment.createdAt)}
                  </span>
                </div>
              </div>

              {/* Received from */}
              <div className="mb-3">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="text-gray-500 whitespace-nowrap">Received from:</span>
                  <span className="flex-1 border-b border-gray-400 font-bold pb-0.5">{receiptData.tenantName}</span>
                </div>
              </div>

              {/* Unit */}
              <div className="mb-3">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="text-gray-500 whitespace-nowrap">Unit / Room:</span>
                  <span className="flex-1 border-b border-gray-400 font-bold pb-0.5">
                    {receiptData.unitNumber} — {receiptData.propertyName}
                  </span>
                </div>
              </div>

              {/* Amount in words */}
              <div className="mb-3">
                <div className="text-sm">
                  <span className="text-gray-500">The sum of: </span>
                  <span className="font-bold italic">{amountToWords(receiptData.payment.amount)}</span>
                </div>
              </div>

              {/* Amount box */}
              <div className="border-2 border-gray-800 rounded p-3 text-center my-4">
                <p className="text-3xl font-black tracking-tight">{formatCurrency(receiptData.payment.amount)}</p>
              </div>

              {/* Payment for */}
              <div className="mb-3 text-sm">
                <span className="text-gray-500">In payment of: </span>
                <span className="font-bold">
                  Monthly Rent — {formatMonth(receiptData.payment.month, receiptData.payment.year)}
                </span>
              </div>

              {/* Payment method */}
              <div className="mb-4 text-sm">
                <span className="text-gray-500">Payment via: </span>
                <span className="font-bold capitalize">{receiptData.payment.paymentMethod.replace('_', ' ')}</span>
              </div>

              {/* Balance note */}
              {receiptData.payment.balance > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded p-2 mb-4 text-xs text-center">
                  <span className="text-amber-800">Remaining Balance: <strong>{formatCurrency(receiptData.payment.balance)}</strong></span>
                </div>
              )}

              {/* Signature */}
              <div className="flex justify-between items-end mt-6 pt-4 border-t border-gray-400">
                <div className="text-center">
                  <div className="w-36 border-b border-gray-600 mb-1" style={{ height: 40 }} />
                  <p className="text-xs text-gray-500">Tenant's Signature</p>
                </div>
                <div className="text-center">
                  <div className="w-36 border-b border-gray-600 mb-1" style={{ height: 40 }} />
                  <p className="text-xs text-gray-500">Received by (Landlord)</p>
                </div>
              </div>

              <p className="text-center text-xs text-gray-400 mt-4">
                Generated by Arkila Property Manager · {new Date().toLocaleDateString('en-PH')}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-receipt, .print-receipt * { visibility: visible !important; }
          .print-receipt { position: fixed !important; inset: 0 !important; padding: 20px !important; }
        }
      `}</style>
    </div>
  );
}
