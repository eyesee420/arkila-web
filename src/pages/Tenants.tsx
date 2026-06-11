import { useState } from 'react';
import { Users, Plus, Pencil, Trash2, Phone, Mail, CalendarClock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { db, type Tenant } from '@/db/database';
import { useProperties, useUnits, useTenants, useRentPayments } from '@/hooks/useDbQueries';
import { useToastStore } from '@/stores/useToastStore';
import { usePropertyFilterStore } from '@/stores/usePropertyFilterStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, currentMonth, currentYear } from '@/lib/utils';

type Form = {
  propertyId: string;
  unitId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  emergencyContact: string;
  emergencyPhone: string;
  moveInDate: string;
  depositPaid: string;
  depositStatus: 'active' | 'consumed' | 'refunded';
};

const empty: Form = {
  propertyId: '', unitId: '', firstName: '', lastName: '',
  phone: '', email: '', emergencyContact: '', emergencyPhone: '',
  moveInDate: '', depositPaid: '', depositStatus: 'active',
};

export default function Tenants() {
  const showToast = useToastStore((s) => s.showToast);
  const queryClient = useQueryClient();
  const activePropertyId = usePropertyFilterStore((s) => s.activePropertyId);
  const filterPropertyId = activePropertyId ? String(activePropertyId) : '';
  const [modalOpen, setModalOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: properties } = useProperties();
  const { data: allUnits } = useUnits();
  const { data: tenants } = useTenants();
  const { data: payments } = useRentPayments();

  const propOptions = (properties || []).map((p) => ({ value: p.id!, label: p.name }));
  const propMap = Object.fromEntries((properties || []).map((p) => [p.id!, p.name]));
  const unitMap = Object.fromEntries((allUnits || []).map((u) => [u.id!, u]));

  const filteredUnits = (allUnits || []).filter((u) =>
    form.propertyId ? u.propertyId === Number(form.propertyId) : true,
  );
  const unitOptions = filteredUnits.map((u) => ({ value: u.id!, label: u.unitNumber }));

  const filtered = (tenants || []).filter((t) =>
    filterPropertyId ? t.propertyId === Number(filterPropertyId) : true,
  );

  const viewTenant = viewId !== null ? (tenants || []).find((t) => t.id === viewId) : null;

  const month = currentMonth();
  const year = currentYear();
  const paidThisMonth = new Set(
    (payments || [])
      .filter((p) => p.month === month && p.year === year && (p.status === 'paid' || p.status === 'partial'))
      .map((p) => p.tenantId),
  );
  const clearedMonths = new Map<number, Set<string>>();
  for (const p of (payments || [])) {
    if (p.status === 'paid' || p.status === 'partial') {
      if (!clearedMonths.has(p.tenantId)) clearedMonths.set(p.tenantId, new Set());
      clearedMonths.get(p.tenantId)!.add(`${p.month}-${p.year}`);
    }
  }

  function nextPaymentDate(moveInDate: Date): Date {
    const day = new Date(moveInDate).getDate();
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, day);
  }

  function avatarColor(firstName: string, lastName: string): string {
    const palette = ['bg-blue-500','bg-indigo-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-teal-500'];
    const code = (firstName.charCodeAt(0) || 0) + (lastName.charCodeAt(0) || 0);
    return palette[code % palette.length];
  }

  function rentStatus(t: Tenant): 'paid' | 'overdue' | 'unpaid' {
    if (paidThisMonth.has(t.id!)) return 'paid';
    const moveIn = new Date(t.moveInDate);
    const cleared = clearedMonths.get(t.id!) || new Set<string>();
    for (let i = 1; i <= 2; i++) {
      let cm = month - i; let cy = year;
      if (cm <= 0) { cm += 12; cy--; }
      const wasTenant = cy > moveIn.getFullYear() || (cy === moveIn.getFullYear() && cm >= moveIn.getMonth() + 1);
      if (wasTenant && !cleared.has(`${cm}-${cy}`)) return 'overdue';
    }
    return 'unpaid';
  }

  function openAdd() {
    setEditId(null);
    setForm({ ...empty, propertyId: filterPropertyId });
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(t: Tenant) {
    setEditId(t.id!);
    setForm({
      propertyId: String(t.propertyId),
      unitId: String(t.unitId),
      firstName: t.firstName,
      lastName: t.lastName,
      phone: t.phone,
      email: t.email || '',
      emergencyContact: t.emergencyContact,
      emergencyPhone: t.emergencyPhone,
      moveInDate: new Date(t.moveInDate).toISOString().split('T')[0],
      depositPaid: String(t.depositPaid),
      depositStatus: t.depositStatus,
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const e: Partial<Form> = {};
    if (!form.propertyId) e.propertyId = 'Select a property';
    if (!form.unitId) e.unitId = 'Select a unit';
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    if (!form.emergencyContact.trim()) e.emergencyContact = 'Emergency contact is required';
    if (!form.emergencyPhone.trim()) e.emergencyPhone = 'Emergency phone is required';
    if (!form.moveInDate) e.moveInDate = 'Move-in date is required';
    if (!form.depositPaid || isNaN(Number(form.depositPaid))) e.depositPaid = 'Enter a valid deposit amount';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const data: Omit<Tenant, 'id' | 'createdAt'> = {
        propertyId: Number(form.propertyId),
        unitId: Number(form.unitId),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        emergencyContact: form.emergencyContact.trim(),
        emergencyPhone: form.emergencyPhone.trim(),
        moveInDate: new Date(form.moveInDate),
        depositPaid: Number(form.depositPaid),
        depositStatus: form.depositStatus,
      };
      if (editId) {
        await db.tenants.update(editId, data);
        await db.units.update(Number(form.unitId), { status: 'occupied' });
        showToast('Tenant updated successfully');
      } else {
        await db.tenants.add({ ...data, createdAt: new Date() });
        await db.units.update(Number(form.unitId), { status: 'occupied' });
        showToast('Tenant added successfully');
      }
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
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
      const tenant = (tenants || []).find((t) => t.id === deleteId);
      await db.tenants.delete(deleteId);
      if (tenant) await db.units.update(tenant.unitId, { status: 'vacant' });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      showToast('Tenant removed. Unit is now vacant.');
    } catch {
      showToast('Failed to remove tenant', 'error');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  if (!properties || !allUnits || !tenants || !payments) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        {filtered.length > 0 && (
          <Button onClick={openAdd}>
            <Plus size={16} /> Add Tenant
          </Button>
        )}
      </div>

      <Card>
        <CardHeader
          title="Tenants"
          subtitle={`${filtered.length} tenant${filtered.length !== 1 ? 's' : ''}`}
        />
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Users size={32} />}
              title="No tenants found"
              description="Add your first tenant to start tracking."
              action={<Button onClick={openAdd}><Plus size={16} />Add Tenant</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Tenant</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Unit</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Property</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Contact</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Move-in</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Next Payment</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Deposit</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Deposit Status</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Rent Status</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full ${avatarColor(t.firstName, t.lastName)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                            {t.firstName[0]}{t.lastName[0]}
                          </div>
                          <button
                            onClick={() => setViewId(t.id!)}
                            className="font-semibold underline text-blue-700 hover:text-blue-900 cursor-pointer text-left"
                          >
                            {t.firstName} {t.lastName}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{unitMap[t.unitId]?.unitNumber || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{propMap[t.propertyId] || '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Phone size={12} className="text-gray-400" />
                          {t.phone}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{formatDate(t.moveInDate)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <CalendarClock size={13} className="text-gray-400" />
                          {formatDate(nextPaymentDate(t.moveInDate))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(t.depositPaid)}</td>
                      <td className="px-5 py-3">{statusBadge(t.depositStatus)}</td>
                      <td className="px-5 py-3">
                        {(() => {
                          const s = rentStatus(t);
                          if (s === 'paid') return <Badge variant="green">Paid</Badge>;
                          if (s === 'overdue') return <Badge variant="red">Overdue</Badge>;
                          return <Badge variant="amber">Due</Badge>;
                        })()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteId(t.id!)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {viewTenant && (
        <Modal
          open={viewId !== null}
          onClose={() => setViewId(null)}
          title="Tenant Profile"
          footer={
            <>
              <Button variant="secondary" onClick={() => setViewId(null)}>Close</Button>
              <Button onClick={() => { setViewId(null); openEdit(viewTenant); }}>
                <Pencil size={14} />Edit
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full ${avatarColor(viewTenant.firstName, viewTenant.lastName)} flex items-center justify-center text-white text-base font-bold shrink-0`}>
                  {viewTenant.firstName[0]}{viewTenant.lastName[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-blue-900">{viewTenant.firstName} {viewTenant.lastName}</h3>
                  <div className="mt-1 space-y-0.5 text-sm text-blue-700">
                    <div className="flex items-center gap-2"><Phone size={14} />{viewTenant.phone}</div>
                    {viewTenant.email && <div className="flex items-center gap-2"><Mail size={14} />{viewTenant.email}</div>}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-500">Unit</p><p className="font-medium">{unitMap[viewTenant.unitId]?.unitNumber || '—'}</p></div>
              <div><p className="text-gray-500">Property</p><p className="font-medium">{propMap[viewTenant.propertyId] || '—'}</p></div>
              <div><p className="text-gray-500">Move-in Date</p><p className="font-medium">{formatDate(viewTenant.moveInDate)}</p></div>
              <div><p className="text-gray-500">Next Payment</p><p className="font-medium text-blue-700">{formatDate(nextPaymentDate(viewTenant.moveInDate))}</p></div>
              <div><p className="text-gray-500">Monthly Rent</p><p className="font-medium">{formatCurrency(unitMap[viewTenant.unitId]?.monthlyRent || 0)}</p></div>
              <div><p className="text-gray-500">Deposit Paid</p><p className="font-medium">{formatCurrency(viewTenant.depositPaid)}</p></div>
              <div><p className="text-gray-500">Deposit Status</p>{statusBadge(viewTenant.depositStatus)}</div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Emergency Contact</p>
              <div className="text-sm space-y-1">
                <p className="text-gray-800">{viewTenant.emergencyContact}</p>
                <div className="flex items-center gap-2 text-gray-600"><Phone size={12} />{viewTenant.emergencyPhone}</div>
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-amber-800">Refundable Deposit</p>
              <p className="text-amber-700 mt-0.5">
                {viewTenant.depositStatus === 'active'
                  ? `${formatCurrency(viewTenant.depositPaid)} is refundable upon move-out`
                  : viewTenant.depositStatus === 'consumed'
                  ? 'Deposit has been consumed'
                  : 'Deposit has been refunded'}
              </p>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Tenant' : 'Add Tenant'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editId ? 'Save Changes' : 'Add Tenant'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Property" options={propOptions} placeholder="Select property" value={form.propertyId}
              onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value, unitId: '' }))}
              error={errors.propertyId} required />
            <SelectField label="Unit" options={unitOptions} placeholder="Select unit" value={form.unitId}
              onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
              error={errors.unitId} disabled={!form.propertyId} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" placeholder="Juan" value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} error={errors.firstName} required />
            <Input label="Last Name" placeholder="Dela Cruz" value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} error={errors.lastName} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone Number" placeholder="09XX XXX XXXX" value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} error={errors.phone} required />
            <Input label="Email Address" type="email" placeholder="optional" value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Emergency Contact</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Contact Name" placeholder="Full name" value={form.emergencyContact}
                onChange={(e) => setForm((f) => ({ ...f, emergencyContact: e.target.value }))} error={errors.emergencyContact} required />
              <Input label="Contact Phone" placeholder="09XX XXX XXXX" value={form.emergencyPhone}
                onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))} error={errors.emergencyPhone} required />
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Move-in & Deposit</p>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Move-in Date" type="date" value={form.moveInDate}
                onChange={(e) => setForm((f) => ({ ...f, moveInDate: e.target.value }))} error={errors.moveInDate} required />
              <Input label="Deposit Paid (₱)" type="number" min="0" placeholder="e.g., 10000" value={form.depositPaid}
                onChange={(e) => setForm((f) => ({ ...f, depositPaid: e.target.value }))} error={errors.depositPaid} required />
              <SelectField label="Deposit Status"
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'consumed', label: 'Consumed' },
                  { value: 'refunded', label: 'Refunded' },
                ]}
                value={form.depositStatus}
                onChange={(e) => setForm((f) => ({ ...f, depositStatus: e.target.value as Form['depositStatus'] }))}
              />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Remove Tenant"
        message="Remove this tenant? The unit will be marked as vacant. Payment history will be kept."
        confirmLabel="Remove"
      />
    </div>
  );
}
