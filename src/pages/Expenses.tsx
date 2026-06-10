import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Wrench, Plus, Pencil, Trash2 } from 'lucide-react';
import { db, type Expense } from '@/db/database';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { SelectField } from '@/components/ui/SelectField'; 
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/contexts/ToastContext';
import { useActiveProperty } from '@/contexts/ActivePropertyContext';
import { formatCurrency, formatDate } from '@/lib/utils';

type Form = {
  propertyId: string;
  unitId: string;
  description: string;
  amount: string;
  date: string;
};

const empty: Form = {
  propertyId: '', unitId: '', description: '', amount: '',
  date: new Date().toISOString().split('T')[0],
};

export default function Expenses() {
  const { showToast } = useToast();
  const { activePropertyId } = useActiveProperty();
  const filterPropertyId = activePropertyId ? String(activePropertyId) : '';
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const properties = useLiveQuery(() => db.properties.orderBy('name').toArray());
  const allUnits = useLiveQuery(() => db.units.toArray());
  const expenses = useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray());

  const propOptions = (properties || []).map(p => ({ value: p.id!, label: p.name }));
  const propMap = Object.fromEntries((properties || []).map(p => [p.id!, p.name]));
  const unitMap = Object.fromEntries((allUnits || []).map(u => [u.id!, u]));

  const unitsForProperty = (allUnits || [])
    .filter(u => !form.propertyId || u.propertyId === Number(form.propertyId))
    .map(u => ({ value: u.id!, label: u.unitNumber }));

  const filtered = (expenses || []).filter(e =>
    filterPropertyId ? e.propertyId === Number(filterPropertyId) : true,
  );

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  function openAdd() {
    setEditId(null);
    setForm({ ...empty, propertyId: filterPropertyId });
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(e: Expense) {
    setEditId(e.id!);
    setForm({
      propertyId: String(e.propertyId),
      unitId: e.unitId ? String(e.unitId) : '',
      description: e.description,
      amount: String(e.amount),
      date: new Date(e.date).toISOString().split('T')[0],
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const e: Partial<Form> = {};
    if (!form.propertyId) e.propertyId = 'Select a property';
    if (!form.description.trim()) e.description = 'Description is required';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) e.amount = 'Enter valid amount';
    if (!form.date) e.date = 'Date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = {
        propertyId: Number(form.propertyId),
        unitId: form.unitId ? Number(form.unitId) : undefined,
        description: form.description.trim(),
        amount: Number(form.amount),
        date: new Date(form.date),
      };
      if (editId) {
        await db.expenses.update(editId, data);
        showToast('Expense updated');
      } else {
        await db.expenses.add({ ...data, createdAt: new Date() });
        showToast('Expense recorded');
      }
      setModalOpen(false);
    } catch { showToast('Something went wrong', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await db.expenses.delete(deleteId);
      showToast('Expense deleted');
    } catch { showToast('Failed to delete', 'error'); }
    finally { setDeleting(false); setDeleteId(null); }
  }

  if (!properties || !allUnits || !expenses) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        {filtered.length > 0 && (
          <Button onClick={openAdd}>
            <Plus size={16} /> Add Expense
          </Button>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="bg-red-50 rounded-lg p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-red-600 font-medium">Total Expenses</p>
            <p className="text-xl font-bold text-red-800 mt-0.5">{formatCurrency(totalFiltered)}</p>
          </div>
          <Wrench size={28} className="text-red-300" />
        </div>
      )}

      <Card>
        <CardHeader title="Expense Records" subtitle={`${filtered.length} record${filtered.length !== 1 ? 's' : ''}`} />
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={<Wrench size={32} />} title="No expenses recorded"
              description="Track maintenance and repair costs for your properties."
              action={<Button onClick={openAdd}><Plus size={16} />Add Expense</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Date</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Description</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Property</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Unit</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Amount</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="px-5 py-3 text-gray-900 font-medium max-w-xs">{e.description}</td>
                      <td className="px-5 py-3 text-gray-600">{propMap[e.propertyId] || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{e.unitId ? unitMap[e.unitId]?.unitNumber || '—' : <span className="text-gray-400">All units</span>}</td>
                      <td className="px-5 py-3 text-right font-semibold text-red-700">{formatCurrency(e.amount)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(e)}><Pencil size={14} /></Button>
                          <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteId(e.id!)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-gray-600">Total</td>
                    <td className="px-5 py-3 text-right font-bold text-red-700">{formatCurrency(totalFiltered)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Expense' : 'Record Expense'}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editId ? 'Save Changes' : 'Save Expense'}</Button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Property" options={propOptions} placeholder="Select property" value={form.propertyId}
              onChange={e => setForm(f => ({ ...f, propertyId: e.target.value, unitId: '' }))}
              error={errors.propertyId} required />
            <SelectField label="Unit (optional)" options={unitsForProperty} placeholder="Entire property"
              value={form.unitId} onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))}
              disabled={!form.propertyId} />
          </div>
          <Textarea label="Description" placeholder="e.g., Roof repair, Plumbing fix, Repainting"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            error={errors.description} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount (₱)" type="number" min="0" placeholder="e.g., 2500"
              value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              error={errors.amount} required />
            <Input label="Date" type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} error={errors.date} required />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={deleteId !== null} onClose={() => setDeleteId(null)}
        onConfirm={handleDelete} loading={deleting} message="Delete this expense record?" />
    </div>
  );
}
