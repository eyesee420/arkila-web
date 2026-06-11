import { useState, useMemo } from 'react';
import { DoorOpen, Plus, Pencil, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { db, type Unit } from '@/db/database';
import { useProperties, useUnits, useTenants } from '@/hooks/useDbQueries';
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
import { formatCurrency } from '@/lib/utils';

type Form = {
  propertyId: string;
  unitNumber: string;
  monthlyRent: string;
  status: 'occupied' | 'vacant';
};
type Errors = Partial<Form>;

const empty: Form = { propertyId: '', unitNumber: '', monthlyRent: '', status: 'vacant' };

export default function Units() {
  const showToast = useToastStore((s) => s.showToast);
  const queryClient = useQueryClient();
  const activePropertyId = usePropertyFilterStore((s) => s.activePropertyId);
  const filterPropertyId = activePropertyId ? String(activePropertyId) : '';
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: properties } = useProperties();
  const { data: unitsRaw } = useUnits();
  const { data: tenants } = useTenants();

  const units = useMemo(() => {
    if (!unitsRaw || !tenants) return undefined;
    const tenantMap = Object.fromEntries(tenants.map((t) => [t.unitId, t]));
    return unitsRaw.map((u) => ({ ...u, tenant: tenantMap[u.id!] }));
  }, [unitsRaw, tenants]);

  const propOptions = (properties || []).map((p) => ({ value: p.id!, label: p.name }));
  const propMap = Object.fromEntries((properties || []).map((p) => [p.id!, p.name]));

  const filtered = (units || []).filter((u) =>
    filterPropertyId ? u.propertyId === Number(filterPropertyId) : true,
  );

  function openAdd() {
    setEditId(null);
    setForm({ ...empty, propertyId: filterPropertyId });
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(u: Unit) {
    setEditId(u.id!);
    setForm({
      propertyId: String(u.propertyId),
      unitNumber: u.unitNumber,
      monthlyRent: String(u.monthlyRent),
      status: u.status,
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const e: Errors = {};
    if (!form.propertyId) e.propertyId = 'Select a property';
    if (!form.unitNumber.trim()) e.unitNumber = 'Unit number is required';
    if (!form.monthlyRent || isNaN(Number(form.monthlyRent)) || Number(form.monthlyRent) <= 0)
      e.monthlyRent = 'Enter a valid monthly rent';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = {
        propertyId: Number(form.propertyId),
        unitNumber: form.unitNumber.trim(),
        monthlyRent: Number(form.monthlyRent),
        status: form.status,
      };
      if (editId) {
        await db.units.update(editId, data);
        showToast('Unit updated successfully');
      } else {
        await db.units.add({ ...data, createdAt: new Date() });
        showToast('Unit added successfully');
      }
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
      const hasTenant = await db.tenants.where('unitId').equals(deleteId).count();
      if (hasTenant > 0) {
        showToast('Cannot delete: unit has an active tenant.', 'error');
        setDeleteId(null);
        return;
      }
      await db.units.delete(deleteId);
      queryClient.invalidateQueries({ queryKey: ['units'] });
      showToast('Unit deleted');
    } catch {
      showToast('Failed to delete unit', 'error');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  if (!properties || !units) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        {filtered.length > 0 && (
          <Button onClick={openAdd}>
            <Plus size={16} /> Add Unit
          </Button>
        )}
      </div>

      <Card>
        <CardHeader
          title="Units"
          subtitle={`${filtered.length} unit${filtered.length !== 1 ? 's' : ''}`}
        />
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<DoorOpen size={32} />}
              title="No units found"
              description={filterPropertyId ? 'No units for this property.' : 'Add your first unit to get started.'}
              action={<Button onClick={openAdd}><Plus size={16} />Add Unit</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Unit</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Property</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Monthly Rent</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Current Tenant</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-gray-900">{u.unitNumber}</td>
                      <td className="px-5 py-3 text-gray-600">{propMap[u.propertyId] || '—'}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(u.monthlyRent)}</td>
                      <td className="px-5 py-3">{statusBadge(u.status)}</td>
                      <td className="px-5 py-3 text-gray-600">
                        {u.tenant ? `${u.tenant.firstName} ${u.tenant.lastName}` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteId(u.id!)}>
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

      {filtered.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <Badge variant="blue">{filtered.filter((u) => u.status === 'occupied').length} Occupied</Badge>
          <Badge variant="gray">{filtered.filter((u) => u.status === 'vacant').length} Vacant</Badge>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Unit' : 'Add Unit'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editId ? 'Save Changes' : 'Add Unit'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField
            label="Property"
            options={propOptions}
            placeholder="Select property"
            value={form.propertyId}
            onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
            error={errors.propertyId}
            required
          />
          <Input
            label="Unit Number / Name"
            placeholder="e.g., Unit 1, Room 2A, Door 3"
            value={form.unitNumber}
            onChange={(e) => setForm((f) => ({ ...f, unitNumber: e.target.value }))}
            error={errors.unitNumber}
            required
          />
          <Input
            label="Monthly Rent (₱)"
            type="number"
            min="0"
            placeholder="e.g., 5000"
            value={form.monthlyRent}
            onChange={(e) => setForm((f) => ({ ...f, monthlyRent: e.target.value }))}
            error={errors.monthlyRent}
            required
          />
          <SelectField
            label="Status"
            options={[
              { value: 'vacant', label: 'Vacant' },
              { value: 'occupied', label: 'Occupied' },
            ]}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'occupied' | 'vacant' }))}
            required
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message="Delete this unit? Make sure no tenant is assigned first."
      />
    </div>
  );
}
