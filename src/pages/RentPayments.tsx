import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Banknote, Plus, Pencil, Trash2 } from 'lucide-react';
import { db, type RentPayment } from '@/db/database';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { statusBadge } from '@/components/ui/Badge';
import { useToast } from '@/contexts/ToastContext';
import { useActiveProperty } from '@/contexts/ActivePropertyContext';
import { formatCurrency, formatDate, formatMonth, monthOptions, currentMonth, currentYear } from '@/lib/utils';

type Form = {
  tenantId: string;
  unitId: string;
  propertyId: string;
  amountDue: string;
  amountPaid: string;
  month: string;
  year: string;
  paymentMethod: 'cash' | 'gcash' | 'bank_transfer';
  paymentDate: string;
  notes: string;
};

const empty: Form = {
  tenantId: '', unitId: '', propertyId: '',
  amountDue: '', amountPaid: '',
  month: String(currentMonth()), year: String(currentYear()),
  paymentMethod: 'cash', paymentDate: new Date().toISOString().split('T')[0],
  notes: '',
};

export default function RentPayments() {
  const { showToast } = useToast();
  const { activePropertyId } = useActiveProperty();
  const filterPropertyId = activePropertyId ? String(activePropertyId) : '';
  const [filterMonth, setFilterMonth] = useState(String(currentMonth()));
  const [filterYear, setFilterYear] = useState(String(currentYear()));
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const properties = useLiveQuery(() => db.properties.orderBy('name').toArray());
  const tenants = useLiveQuery(() => db.tenants.toArray());
  const allUnits = useLiveQuery(() => db.units.toArray());
  const payments = useLiveQuery(async () => {
    return db.rentPayments.orderBy('id').reverse().toArray();
  });

  // const propOptions = (properties || []).map(p => ({ value: p.id!, label: p.name }));
  // const propMap = Object.fromEntries((properties || []).map(p => [p.id!, p.name]));
  const tenantMap = Object.fromEntries((tenants || []).map(t => [t.id!, t]));
  const unitMap = Object.fromEntries((allUnits || []).map(u => [u.id!, u]));

  const tenantOptions = (tenants || []).map(t => ({
    value: t.id!,
    label: `${t.firstName} ${t.lastName}`,
  }));

  const filtered = (payments || []).filter(p => {
    const mMatch = !filterMonth || p.month === Number(filterMonth);
    const yMatch = !filterYear || p.year === Number(filterYear);
    const pMatch = !filterPropertyId || p.propertyId === Number(filterPropertyId);
    return mMatch && yMatch && pMatch;
  });

  const totalCollected = filtered.filter(p => p.status === 'paid' || p.status === 'partial').reduce((s, p) => s + p.amount, 0);
  const totalBalance = filtered.reduce((s, p) => s + p.balance, 0);

  function openAdd() {
    setEditId(null);
    setForm(empty);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(p: RentPayment) {
    setEditId(p.id!);
    setForm({
      tenantId: String(p.tenantId),
      unitId: String(p.unitId),
      propertyId: String(p.propertyId),
      amountDue: String(unitMap[p.unitId]?.monthlyRent || 0),
      amountPaid: String(p.amount),
      month: String(p.month),
      year: String(p.year),
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : '',
      notes: '',
    });
    setErrors({});
    setModalOpen(true);
  }

  function handleTenantChange(tenantId: string) {
    const tenant = (tenants || []).find(t => t.id === Number(tenantId));
    const unit = tenant ? unitMap[tenant.unitId] : undefined;
    setForm(f => ({
      ...f,
      tenantId,
      unitId: tenant ? String(tenant.unitId) : '',
      propertyId: tenant ? String(tenant.propertyId) : '',
      amountDue: unit ? String(unit.monthlyRent) : '',
    }));
  }

  const amountDue = Number(form.amountDue) || 0;
  const amountPaid = Number(form.amountPaid) || 0;
  const balance = Math.max(0, amountDue - amountPaid);
  const status: RentPayment['status'] = amountPaid <= 0 ? 'unpaid' : balance <= 0 ? 'paid' : 'partial';

  function validate(): boolean {
    const e: Partial<Form> = {};
    if (!form.tenantId) e.tenantId = 'Select a tenant';
    if (!form.month) e.month = 'Select month';
    if (!form.year || isNaN(Number(form.year))) e.year = 'Enter year';
    if (form.amountPaid === '' || isNaN(Number(form.amountPaid))) e.amountPaid = 'Enter amount paid';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const data: Omit<RentPayment, 'id' | 'createdAt'> = {
        tenantId: Number(form.tenantId),
        unitId: Number(form.unitId),
        propertyId: Number(form.propertyId),
        amount: amountPaid,
        balance,
        month: Number(form.month),
        year: Number(form.year),
        status,
        paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate ? new Date(form.paymentDate) : undefined,
      };
      if (editId) {
        await db.rentPayments.update(editId, data);
        showToast('Payment record updated');
      } else {
        await db.rentPayments.add({ ...data, createdAt: new Date() });
        showToast('Payment recorded successfully');
      }
      setModalOpen(false);
    } catch {
      showToast('Something went wrong', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await db.rentPayments.delete(deleteId);
      showToast('Payment record deleted');
    } catch {
      showToast('Failed to delete', 'error');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear() - 2 + i;
    return { value: y, label: String(y) };
  });

  if (!properties || !tenants || !allUnits || !payments) return <Spinner />;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <SelectField options={monthOptions()} placeholder="All Months" value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)} className="w-36" />
          <SelectField options={yearOptions} placeholder="All Years" value={filterYear}
            onChange={e => setFilterYear(e.target.value)} className="w-28" />
        </div>
        {filtered.length > 0 && (
          <Button onClick={openAdd}>
            <Plus size={16} /> Record Payment
          </Button>
        )}
      </div>


      {/* Summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-xs text-green-600 font-medium">Total Collected</p>
            <p className="text-xl font-bold text-green-800 mt-0.5">{formatCurrency(totalCollected)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-xs text-red-600 font-medium">Total Balance</p>
            <p className="text-xl font-bold text-red-800 mt-0.5">{formatCurrency(totalBalance)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600 font-medium">Records</p>
            <p className="text-xl font-bold text-gray-800 mt-0.5">{filtered.length}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader title="Rent Payment Records" subtitle={`${filtered.length} record${filtered.length !== 1 ? 's' : ''}`} />
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Banknote size={32} />}
              title="No payment records"
              description="Record your first rent payment."
              action={<Button onClick={openAdd}><Plus size={16} />Record Payment</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Tenant</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Unit</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Period</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Amount Paid</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Balance</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Method</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Date</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const tenant = tenantMap[p.tenantId];
                    const unit = unitMap[p.unitId];
                    return (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {tenant ? `${tenant.firstName} ${tenant.lastName}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-600">{unit?.unitNumber || '—'}</td>
                        <td className="px-5 py-3 text-gray-600">{formatMonth(p.month, p.year)}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(p.amount)}</td>
                        <td className={`px-5 py-3 text-right font-medium ${p.balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {p.balance > 0 ? formatCurrency(p.balance) : '—'}
                        </td>
                        <td className="px-5 py-3">{statusBadge(p.status)}</td>
                        <td className="px-5 py-3 text-gray-600 capitalize">{p.paymentMethod.replace('_', ' ')}</td>
                        <td className="px-5 py-3 text-gray-500">{p.paymentDate ? formatDate(p.paymentDate) : '—'}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                              <Pencil size={14} />
                            </Button>
                            <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteId(p.id!)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Payment Record' : 'Record Rent Payment'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editId ? 'Save Changes' : 'Save Payment'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField
            label="Tenant"
            options={tenantOptions}
            placeholder="Select tenant"
            value={form.tenantId}
            onChange={e => handleTenantChange(e.target.value)}
            error={errors.tenantId}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Month"
              options={monthOptions()}
              placeholder="Select month"
              value={form.month}
              onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
              error={errors.month}
              required
            />
            <SelectField
              label="Year"
              options={yearOptions}
              value={form.year}
              onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
              error={errors.year}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Monthly Rent Due (₱)"
              type="number"
              value={form.amountDue}
              onChange={e => setForm(f => ({ ...f, amountDue: e.target.value }))}
              hint="Auto-filled from unit rate"
            />
            <Input
              label="Amount Paid (₱)"
              type="number"
              min="0"
              placeholder="0.00"
              value={form.amountPaid}
              onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))}
              error={errors.amountPaid}
              required
            />
          </div>
          {/* Balance preview */}
          {form.amountDue && (
            <div className={`rounded-lg p-3 text-sm ${balance > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
              <div className="flex justify-between">
                <span className={balance > 0 ? 'text-amber-700' : 'text-green-700'}>
                  Remaining Balance: <strong>{formatCurrency(balance)}</strong>
                </span>
                {statusBadge(status)}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Payment Method"
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'gcash', label: 'GCash' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
              ]}
              value={form.paymentMethod}
              onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value as Form['paymentMethod'] }))}
            />
            <Input
              label="Payment Date"
              type="date"
              value={form.paymentDate}
              onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
