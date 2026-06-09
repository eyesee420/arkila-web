import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Zap, Droplets, Plus, Pencil, Trash2 } from 'lucide-react';
import { db, type Utility, type MeterReading } from '@/db/database';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { useToast } from '@/contexts/ToastContext';
import { useActiveProperty } from '@/contexts/ActivePropertyContext';
import { formatCurrency, formatMonth, monthOptions, currentMonth, currentYear } from '@/lib/utils';

type UtilForm = {
  propertyId: string; unitId: string; tenantId: string;
  type: 'water' | 'electricity'; amount: string;
  month: string; year: string; status: 'paid' | 'unpaid';
};
type MeterForm = {
  propertyId: string; unitId: string;
  previousReading: string; currentReading: string;
  month: string; year: string;
};

const emptyUtil: UtilForm = {
  propertyId: '', unitId: '', tenantId: '', type: 'electricity',
  amount: '', month: String(currentMonth()), year: String(currentYear()), status: 'unpaid',
};
const emptyMeter: MeterForm = {
  propertyId: '', unitId: '', previousReading: '', currentReading: '',
  month: String(currentMonth()), year: String(currentYear()),
};

export default function Utilities() {
  const { showToast } = useToast();
  const { activePropertyId } = useActiveProperty();
  const filterPropertyId = activePropertyId ? String(activePropertyId) : '';
  const [tab, setTab] = useState<'utilities' | 'meter'>('utilities');
  const [filterMonth, setFilterMonth] = useState(String(currentMonth()));
  const [filterYear, setFilterYear] = useState(String(currentYear()));
  const [filterType, setFilterType] = useState('');

  const [utilModal, setUtilModal] = useState(false);
  const [editUtilId, setEditUtilId] = useState<number | null>(null);
  const [utilForm, setUtilForm] = useState<UtilForm>(emptyUtil);
  const [utilErrors, setUtilErrors] = useState<Partial<UtilForm>>({});

  const [meterModal, setMeterModal] = useState(false);
  const [editMeterId, setEditMeterId] = useState<number | null>(null);
  const [meterForm, setMeterForm] = useState<MeterForm>(emptyMeter);
  const [meterErrors, setMeterErrors] = useState<Partial<MeterForm>>({});

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteType, setDeleteType] = useState<'utility' | 'meter'>('utility');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const properties = useLiveQuery(() => db.properties.orderBy('name').toArray());
  const allUnits = useLiveQuery(() => db.units.toArray());
  const tenants = useLiveQuery(() => db.tenants.toArray());
  const utilities = useLiveQuery(() => db.utilities.orderBy('id').reverse().toArray());
  const meterReadings = useLiveQuery(() => db.meterReadings.orderBy('id').reverse().toArray());

  const propOptions = (properties || []).map(p => ({ value: p.id!, label: p.name }));
  const propMap = Object.fromEntries((properties || []).map(p => [p.id!, p.name]));
  const unitMap = Object.fromEntries((allUnits || []).map(u => [u.id!, u]));
  const tenantMap = Object.fromEntries((tenants || []).map(t => [t.id!, t]));

  function getUnitsForProperty(propertyId: string) {
    return (allUnits || []).filter(u => !propertyId || u.propertyId === Number(propertyId))
      .map(u => ({ value: u.id!, label: u.unitNumber }));
  }

  function handleUtilUnitChange(unitId: string) {
    const tenant = (tenants || []).find(t => t.unitId === Number(unitId));
    setUtilForm(f => ({ ...f, unitId, tenantId: tenant ? String(tenant.id!) : '' }));
  }

  function validateUtil(): boolean {
    const e: Partial<UtilForm> = {};
    if (!utilForm.propertyId) e.propertyId = 'Select property';
    if (!utilForm.unitId) e.unitId = 'Select unit';
    if (!utilForm.amount || isNaN(Number(utilForm.amount))) e.amount = 'Enter valid amount';
    setUtilErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSaveUtil() {
    if (!validateUtil()) return;
    setSaving(true);
    try {
      const data = {
        propertyId: Number(utilForm.propertyId),
        unitId: Number(utilForm.unitId),
        tenantId: Number(utilForm.tenantId),
        type: utilForm.type,
        amount: Number(utilForm.amount),
        month: Number(utilForm.month),
        year: Number(utilForm.year),
        status: utilForm.status,
      };
      if (editUtilId) {
        await db.utilities.update(editUtilId, data);
        showToast('Utility charge updated');
      } else {
        await db.utilities.add({ ...data, createdAt: new Date() });
        showToast('Utility charge added');
      }
      setUtilModal(false);
    } catch { showToast('Something went wrong', 'error'); }
    finally { setSaving(false); }
  }

  function validateMeter(): boolean {
    const e: Partial<MeterForm> = {};
    if (!meterForm.propertyId) e.propertyId = 'Select property';
    if (!meterForm.unitId) e.unitId = 'Select unit';
    if (!meterForm.previousReading || isNaN(Number(meterForm.previousReading))) e.previousReading = 'Enter reading';
    if (!meterForm.currentReading || isNaN(Number(meterForm.currentReading))) e.currentReading = 'Enter reading';
    if (Number(meterForm.currentReading) < Number(meterForm.previousReading)) e.currentReading = 'Must be ≥ previous';
    setMeterErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSaveMeter() {
    if (!validateMeter()) return;
    setSaving(true);
    try {
      const prev = Number(meterForm.previousReading);
      const curr = Number(meterForm.currentReading);
      const data = {
        propertyId: Number(meterForm.propertyId),
        unitId: Number(meterForm.unitId),
        previousReading: prev,
        currentReading: curr,
        consumption: curr - prev,
        month: Number(meterForm.month),
        year: Number(meterForm.year),
      };
      if (editMeterId) {
        await db.meterReadings.update(editMeterId, data);
        showToast('Meter reading updated');
      } else {
        await db.meterReadings.add({ ...data, createdAt: new Date() });
        showToast('Meter reading saved');
      }
      setMeterModal(false);
    } catch { showToast('Something went wrong', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      if (deleteType === 'utility') await db.utilities.delete(deleteId);
      else await db.meterReadings.delete(deleteId);
      showToast('Deleted successfully');
    } catch { showToast('Failed to delete', 'error'); }
    finally { setDeleting(false); setDeleteId(null); }
  }

  function openEditUtil(u: Utility) {
    setEditUtilId(u.id!);
    setUtilForm({
      propertyId: String(u.propertyId), unitId: String(u.unitId), tenantId: String(u.tenantId),
      type: u.type, amount: String(u.amount),
      month: String(u.month), year: String(u.year), status: u.status,
    });
    setUtilErrors({});
    setUtilModal(true);
  }

  function openEditMeter(m: MeterReading) {
    setEditMeterId(m.id!);
    setMeterForm({
      propertyId: String(m.propertyId), unitId: String(m.unitId),
      previousReading: String(m.previousReading), currentReading: String(m.currentReading),
      month: String(m.month), year: String(m.year),
    });
    setMeterErrors({});
    setMeterModal(true);
  }

  if (!properties || !allUnits || !tenants || !utilities || !meterReadings) return <Spinner />;

  const filteredUtils = utilities.filter(u => {
    const mMatch = !filterMonth || u.month === Number(filterMonth);
    const yMatch = !filterYear || u.year === Number(filterYear);
    const tMatch = !filterType || u.type === filterType;
    const pMatch = !filterPropertyId || u.propertyId === Number(filterPropertyId);
    return mMatch && yMatch && tMatch && pMatch;
  });

  const filteredMeters = meterReadings.filter(m => {
    const mMatch = !filterMonth || m.month === Number(filterMonth);
    const yMatch = !filterYear || m.year === Number(filterYear);
    const pMatch = !filterPropertyId || m.propertyId === Number(filterPropertyId);
    return mMatch && yMatch && pMatch;
  });

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear() - 2 + i;
    return { value: y, label: String(y) };
  });

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('utilities')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${tab === 'utilities' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <div className="flex items-center gap-2"><Zap size={15} />Charges</div>
        </button>
        <button
          onClick={() => setTab('meter')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${tab === 'meter' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <div className="flex items-center gap-2"><Droplets size={15} />Meter Readings</div>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <SelectField options={monthOptions()} placeholder="All Months" value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)} className="w-36" />
          <SelectField options={yearOptions} placeholder="All Years" value={filterYear}
            onChange={e => setFilterYear(e.target.value)} className="w-28" />
          {tab === 'utilities' && (
            <SelectField
              options={[{ value: 'electricity', label: 'Electricity (Meralco)' }, { value: 'water', label: 'Water' }]}
              placeholder="All Types" value={filterType}
              onChange={e => setFilterType(e.target.value)} className="w-44" />
          )}
        </div>
        <Button onClick={() => {
          if (tab === 'utilities') { setEditUtilId(null); setUtilForm(emptyUtil); setUtilErrors({}); setUtilModal(true); }
          else { setEditMeterId(null); setMeterForm(emptyMeter); setMeterErrors({}); setMeterModal(true); }
        }}>
          <Plus size={16} />{tab === 'utilities' ? 'Add Charge' : 'Add Meter Reading'}
        </Button>
      </div>

      {tab === 'utilities' && (
        <Card>
          <CardHeader title="Utility Charges" subtitle={`${filteredUtils.length} records`} />
          <CardContent className="p-0">
            {filteredUtils.length === 0 ? (
              <EmptyState icon={<Zap size={32} />} title="No utility charges" description="Add water or electricity charges per unit." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Unit</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Tenant</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Type</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Period</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500">Amount</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUtils.map(u => {
                      const tenant = tenantMap[u.tenantId];
                      return (
                        <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-900">{unitMap[u.unitId]?.unitNumber || '—'}</td>
                          <td className="px-5 py-3 text-gray-600">{tenant ? `${tenant.firstName} ${tenant.lastName}` : '—'}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              {u.type === 'electricity' ? <Zap size={14} className="text-amber-500" /> : <Droplets size={14} className="text-blue-500" />}
                              {u.type === 'electricity' ? 'Electricity' : 'Water'}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-600">{formatMonth(u.month, u.year)}</td>
                          <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(u.amount)}</td>
                          <td className="px-5 py-3">{statusBadge(u.status)}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditUtil(u)}><Pencil size={14} /></Button>
                              <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => { setDeleteId(u.id!); setDeleteType('utility'); }}>
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
      )}

      {tab === 'meter' && (
        <Card>
          <CardHeader title="Electricity Meter Readings" subtitle={`${filteredMeters.length} records`} />
          <CardContent className="p-0">
            {filteredMeters.length === 0 ? (
              <EmptyState icon={<Zap size={32} />} title="No meter readings" description="Track electricity meter readings per unit." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Unit</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Property</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Period</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500">Prev. Reading</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500">Curr. Reading</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500">Consumption (kWh)</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMeters.map(m => (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{unitMap[m.unitId]?.unitNumber || '—'}</td>
                        <td className="px-5 py-3 text-gray-600">{propMap[m.propertyId] || '—'}</td>
                        <td className="px-5 py-3 text-gray-600">{formatMonth(m.month, m.year)}</td>
                        <td className="px-5 py-3 text-right text-gray-700">{m.previousReading.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right text-gray-700">{m.currentReading.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right">
                          <Badge variant="amber">{m.consumption.toLocaleString()} kWh</Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditMeter(m)}><Pencil size={14} /></Button>
                            <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => { setDeleteId(m.id!); setDeleteType('meter'); }}>
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
      )}

      {/* Utility modal */}
      <Modal open={utilModal} onClose={() => setUtilModal(false)} title={editUtilId ? 'Edit Utility Charge' : 'Add Utility Charge'}
        footer={<>
          <Button variant="secondary" onClick={() => setUtilModal(false)}>Cancel</Button>
          <Button onClick={handleSaveUtil} loading={saving}>{editUtilId ? 'Save Changes' : 'Add Charge'}</Button>
        </>}
      >
        <div className="space-y-4">
          <SelectField label="Type" options={[
            { value: 'electricity', label: 'Electricity (Meralco)' },
            { value: 'water', label: 'Water' },
          ]} value={utilForm.type} onChange={e => setUtilForm(f => ({ ...f, type: e.target.value as 'water' | 'electricity' }))} required />
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Property" options={propOptions} placeholder="Select property" value={utilForm.propertyId}
              onChange={e => setUtilForm(f => ({ ...f, propertyId: e.target.value, unitId: '', tenantId: '' }))}
              error={utilErrors.propertyId} required />
            <SelectField label="Unit" options={getUnitsForProperty(utilForm.propertyId)} placeholder="Select unit"
              value={utilForm.unitId} onChange={e => handleUtilUnitChange(e.target.value)}
              error={utilErrors.unitId} disabled={!utilForm.propertyId} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Month" options={monthOptions()} value={utilForm.month}
              onChange={e => setUtilForm(f => ({ ...f, month: e.target.value }))} required />
            <SelectField label="Year" options={yearOptions} value={utilForm.year}
              onChange={e => setUtilForm(f => ({ ...f, year: e.target.value }))} required />
          </div>
          <Input label="Amount Charged (₱)" type="number" min="0" placeholder="e.g., 850"
            value={utilForm.amount} onChange={e => setUtilForm(f => ({ ...f, amount: e.target.value }))}
            error={utilErrors.amount} required />
          <SelectField label="Status" options={[
            { value: 'unpaid', label: 'Unpaid' }, { value: 'paid', label: 'Paid' },
          ]} value={utilForm.status} onChange={e => setUtilForm(f => ({ ...f, status: e.target.value as 'paid' | 'unpaid' }))} />
        </div>
      </Modal>

      {/* Meter modal */}
      <Modal open={meterModal} onClose={() => setMeterModal(false)} title={editMeterId ? 'Edit Meter Reading' : 'Add Meter Reading'}
        footer={<>
          <Button variant="secondary" onClick={() => setMeterModal(false)}>Cancel</Button>
          <Button onClick={handleSaveMeter} loading={saving}>{editMeterId ? 'Save Changes' : 'Save Reading'}</Button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Property" options={propOptions} placeholder="Select property" value={meterForm.propertyId}
              onChange={e => setMeterForm(f => ({ ...f, propertyId: e.target.value, unitId: '' }))}
              error={meterErrors.propertyId} required />
            <SelectField label="Unit" options={getUnitsForProperty(meterForm.propertyId)} placeholder="Select unit"
              value={meterForm.unitId} onChange={e => setMeterForm(f => ({ ...f, unitId: e.target.value }))}
              error={meterErrors.unitId} disabled={!meterForm.propertyId} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Month" options={monthOptions()} value={meterForm.month}
              onChange={e => setMeterForm(f => ({ ...f, month: e.target.value }))} required />
            <SelectField label="Year" options={yearOptions} value={meterForm.year}
              onChange={e => setMeterForm(f => ({ ...f, year: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Previous Reading (kWh)" type="number" min="0" placeholder="e.g., 1250"
              value={meterForm.previousReading} onChange={e => setMeterForm(f => ({ ...f, previousReading: e.target.value }))}
              error={meterErrors.previousReading} required />
            <Input label="Current Reading (kWh)" type="number" min="0" placeholder="e.g., 1380"
              value={meterForm.currentReading} onChange={e => setMeterForm(f => ({ ...f, currentReading: e.target.value }))}
              error={meterErrors.currentReading} required />
          </div>
          {meterForm.previousReading && meterForm.currentReading && (
            <div className="bg-amber-50 rounded-lg p-3 text-sm">
              <span className="text-amber-700">Consumption: <strong>
                {Math.max(0, Number(meterForm.currentReading) - Number(meterForm.previousReading)).toLocaleString()} kWh
              </strong></span>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
