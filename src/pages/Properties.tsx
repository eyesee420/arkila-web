import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Building2, Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { db, type Property } from '@/db/database';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/contexts/ToastContext';
import { formatDate } from '@/lib/utils';

type Form = { name: string; address: string };
type Errors = Partial<Form>;

const empty: Form = { name: '', address: '' };

export default function Properties() {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const properties = useLiveQuery(() => db.properties.orderBy('name').toArray());
  const unitCounts = useLiveQuery(async () => {
    const units = await db.units.toArray();
    const counts: Record<number, { total: number; occupied: number }> = {};
    units.forEach(u => {
      if (!counts[u.propertyId]) counts[u.propertyId] = { total: 0, occupied: 0 };
      counts[u.propertyId].total++;
      if (u.status === 'occupied') counts[u.propertyId].occupied++;
    });
    return counts;
  });

  function openAdd() {
    setEditId(null);
    setForm(empty);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(p: Property) {
    setEditId(p.id!);
    setForm({ name: p.name, address: p.address });
    setErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const e: Errors = {};
    if (!form.name.trim()) e.name = 'Property name is required';
    if (!form.address.trim()) e.address = 'Address is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) {
        await db.properties.update(editId, { name: form.name.trim(), address: form.address.trim() });
        showToast('Property updated successfully');
      } else {
        await db.properties.add({ name: form.name.trim(), address: form.address.trim(), createdAt: new Date() });
        showToast('Property added successfully');
      }
      setModalOpen(false);
    } catch {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const hasUnits = await db.units.where('propertyId').equals(deleteId).count();
      if (hasUnits > 0) {
        showToast('Cannot delete: this property has units. Remove units first.', 'error');
        setDeleteId(null);
        return;
      }
      await db.properties.delete(deleteId);
      showToast('Property deleted');
    } catch {
      showToast('Failed to delete property', 'error');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  if (!properties || !unitCounts) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd}><Plus size={16} />Add Property</Button>
      </div>

      <Card>
        <CardHeader
          title="All Properties"
          subtitle={`${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'}`}
        />
        <CardContent className="p-0">
          {properties.length === 0 ? (
            <EmptyState
              icon={<Building2 size={32} />}
              title="No properties yet"
              description="Add your first rental property to get started."
              action={<Button onClick={openAdd}><Plus size={16} />Add Property</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Property Name</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Address</th>
                    <th className="text-center px-5 py-3 font-medium text-gray-500">Units</th>
                    <th className="text-center px-5 py-3 font-medium text-gray-500">Occupied</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Date Added</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map(p => {
                    const counts = unitCounts[p.id!] || { total: 0, occupied: 0 };
                    return (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-gray-900">{p.name}</td>
                        <td className="px-5 py-3 text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={13} className="text-gray-400 shrink-0" />
                            {p.address}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center text-gray-700">{counts.total}</td>
                        <td className="px-5 py-3 text-center text-gray-700">
                          {counts.occupied}/{counts.total}
                        </td>
                        <td className="px-5 py-3 text-gray-500">{formatDate(p.createdAt)}</td>
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
        title={editId ? 'Edit Property' : 'Add Property'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editId ? 'Save Changes' : 'Add Property'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Property Name"
            placeholder="e.g., Bahay ni Reyes, Sunset Apartment"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            error={errors.name}
            required
          />
          <Textarea
            label="Address"
            placeholder="Full address including barangay, city, province"
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            error={errors.address}
            required
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message="Delete this property? Make sure all units are removed first."
      />
    </div>
  );
}
