import { useState } from 'react';
import { Bell, BellOff, CheckCheck, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '@/db/database';
import { useProperties, useUnits, useTenants, useNotifications } from '@/hooks/useDbQueries';
import { useToastStore } from '@/stores/useToastStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { statusBadge } from '@/components/ui/Badge';
import { formatDate, formatMonth, currentMonth, currentYear } from '@/lib/utils';

type Form = {
  tenantId: string;
  unitId: string;
  propertyId: string;
  message: string;
  type: 'rent_due' | 'rent_overdue' | 'utility' | 'announcement';
};

const empty: Form = {
  tenantId: '', unitId: '', propertyId: '',
  message: '', type: 'rent_due',
};

export default function NotificationsPage() {
  const showToast = useToastStore((s) => s.showToast);
  const queryClient = useQueryClient();
  const [filterRead, setFilterRead] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { data: properties } = useProperties();
  const { data: allUnits } = useUnits();
  const { data: tenants } = useTenants();
  const { data: notifications } = useNotifications();

  const unitMap = Object.fromEntries((allUnits || []).map((u) => [u.id!, u]));
  const tenantMap = Object.fromEntries((tenants || []).map((t) => [t.id!, t]));
  const tenantOptions = (tenants || []).map((t) => ({ value: t.id!, label: `${t.firstName} ${t.lastName}` }));

  function handleTenantChange(tenantId: string) {
    const tenant = (tenants || []).find((t) => t.id === Number(tenantId));
    setForm((f) => ({
      ...f, tenantId,
      unitId: tenant ? String(tenant.unitId) : '',
      propertyId: tenant ? String(tenant.propertyId) : '',
    }));
  }

  const filtered = (notifications || []).filter((n) => {
    if (filterRead === 'unread') return !n.isRead;
    if (filterRead === 'read') return n.isRead;
    return true;
  });

  async function markAllRead() {
    try {
      const unread = (notifications || []).filter((n) => !n.isRead);
      await Promise.all(unread.map((n) => db.notifications.update(n.id!, { isRead: true })));
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showToast('All notifications marked as read');
    } catch { showToast('Failed to update', 'error'); }
  }

  async function toggleRead(id: number, current: boolean) {
    await db.notifications.update(id, { isRead: !current });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function generateNotifications() {
    setGenerating(true);
    try {
      const month = currentMonth();
      const year = currentYear();
      const [allTenants, allUnitsNow, payments] = await Promise.all([
        db.tenants.toArray(),
        db.units.toArray(),
        db.rentPayments.where('[month+year]').equals([month, year]).toArray(),
      ]);
      const paidTenantIds = new Set(payments.filter((p) => p.status === 'paid').map((p) => p.tenantId));

      let count = 0;
      for (const tenant of allTenants) {
        if (!paidTenantIds.has(tenant.id!)) {
          const unit = allUnitsNow.find((u) => u.id === tenant.unitId);
          const existing = await db.notifications
            .where('tenantId').equals(tenant.id!)
            .filter((n) => {
              if (n.type !== 'rent_due') return false;
              const d = new Date(n.createdAt);
              return d.getMonth() + 1 === month && d.getFullYear() === year;
            }).count();
          if (existing === 0) {
            await db.notifications.add({
              tenantId: tenant.id!,
              unitId: tenant.unitId,
              propertyId: tenant.propertyId,
              message: `Rent due for ${tenant.firstName} ${tenant.lastName} — ${unit?.unitNumber || ''} — ${formatMonth(month, year)}`,
              type: 'rent_due',
              isRead: false,
              createdAt: new Date(),
            });
            count++;
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showToast(`Generated ${count} rent due notification${count !== 1 ? 's' : ''}`);
    } catch { showToast('Failed to generate notifications', 'error'); }
    finally { setGenerating(false); }
  }

  function validate(): boolean {
    const e: Partial<Form> = {};
    if (!form.tenantId) e.tenantId = 'Select a tenant';
    if (!form.message.trim()) e.message = 'Message is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await db.notifications.add({
        tenantId: Number(form.tenantId),
        unitId: Number(form.unitId),
        propertyId: Number(form.propertyId),
        message: form.message.trim(),
        type: form.type,
        isRead: false,
        createdAt: new Date(),
      });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showToast('Notification added');
      setModalOpen(false);
    } catch { showToast('Something went wrong', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await db.notifications.delete(deleteId);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showToast('Notification deleted');
    } catch { showToast('Failed to delete', 'error'); }
    finally { setDeleting(false); setDeleteId(null); }
  }

  if (!properties || !allUnits || !tenants || !notifications) return <Spinner />;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          <SelectField
            options={[{ value: 'unread', label: 'Unread' }, { value: 'read', label: 'Read' }]}
            placeholder="All" value={filterRead}
            onChange={(e) => setFilterRead(e.target.value)} className="w-32" />
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={markAllRead}>
              <CheckCheck size={14} />Mark All Read
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateNotifications} loading={generating}
            size="sm" className="md:py-2 md:px-4 md:text-base">
            <AlertCircle size={14} />Generate Rent Due
          </Button>
          <Button onClick={() => { setForm(empty); setErrors({}); setModalOpen(true); }}
            size="sm" className="md:py-2 md:px-4 md:text-base">
            <Plus size={16} />Add Notification
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Notifications"
          subtitle={`${filtered.length} notification${filtered.length !== 1 ? 's' : ''} · ${unreadCount} unread`}
        />
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={<BellOff size={32} />} title="No notifications"
              description="Generate rent due reminders or add custom notifications." />
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((n) => {
                const tenant = tenantMap[n.tenantId];
                const unit = unitMap[n.unitId];
                return (
                  <div key={n.id} className={`flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-blue-50/40' : ''}`}>
                    <div className={`p-2 rounded-full mt-0.5 shrink-0 ${!n.isRead ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Bell size={16} className={!n.isRead ? 'text-blue-600' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {n.message}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {statusBadge(n.type)}
                          {!n.isRead && <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-400">{formatDate(n.createdAt)}</p>
                        {tenant && <p className="text-xs text-gray-500">{tenant.firstName} {tenant.lastName}</p>}
                        {unit && <p className="text-xs text-gray-400">{unit.unitNumber}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => toggleRead(n.id!, n.isRead)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                        title={n.isRead ? 'Mark unread' : 'Mark read'}>
                        <CheckCheck size={14} />
                      </button>
                      <button onClick={() => setDeleteId(n.id!)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Notification"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </>}
      >
        <div className="space-y-4">
          <SelectField label="Tenant" options={tenantOptions} placeholder="Select tenant"
            value={form.tenantId} onChange={(e) => handleTenantChange(e.target.value)}
            error={errors.tenantId} required />
          <SelectField label="Type" options={[
            { value: 'rent_due', label: 'Rent Due' },
            { value: 'rent_overdue', label: 'Rent Overdue' },
            { value: 'utility', label: 'Utility' },
            { value: 'announcement', label: 'Announcement' },
          ]} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Form['type'] }))} />
          <Input label="Message" placeholder="Enter notification message"
            value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            error={errors.message} required />
        </div>
      </Modal>

      <ConfirmDialog open={deleteId !== null} onClose={() => setDeleteId(null)}
        onConfirm={handleDelete} loading={deleting} message="Delete this notification?" />
    </div>
  );
}
