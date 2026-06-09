import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Plus, Trash2, Download, Eye, Upload, FileCheck, IdCard } from 'lucide-react';
import { db, type Document } from '@/db/database';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/contexts/ToastContext';
import { useActiveProperty } from '@/contexts/ActivePropertyContext';
import { formatDate } from '@/lib/utils';

type Form = {
  tenantId: string;
  unitId: string;
  propertyId: string;
  name: string;
  type: 'contract' | 'id' | 'other';
};

const empty: Form = { tenantId: '', unitId: '', propertyId: '', name: '', type: 'contract' };

const typeIcons: Record<string, React.ReactNode> = {
  contract: <FileCheck size={18} className="text-blue-600" />,
  id: <IdCard size={18} className="text-purple-600" />,
  other: <FileText size={18} className="text-gray-600" />,
};

const typeColors: Record<string, string> = {
  contract: 'blue', id: 'purple', other: 'gray',
};

export default function Documents() {
  const { showToast } = useToast();
  const { activePropertyId } = useActiveProperty();
  const [filterTenantId, setFilterTenantId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Form & { file: string }>>({});
  const [fileData, setFileData] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const properties = useLiveQuery(() => db.properties.orderBy('name').toArray());
  const allUnits = useLiveQuery(() => db.units.toArray());
  const tenants = useLiveQuery(async () => {
    const all = await db.tenants.toArray();
    return all.sort((a, b) => a.firstName.localeCompare(b.firstName));
  });
  const documents = useLiveQuery(() => db.documents.orderBy('id').reverse().toArray());

  const propMap = Object.fromEntries((properties || []).map(p => [p.id!, p.name]));
  const unitMap = Object.fromEntries((allUnits || []).map(u => [u.id!, u]));
  const tenantMap = Object.fromEntries((tenants || []).map(t => [t.id!, t]));
  const tenantOptions = (tenants || [])
    .filter(t => !activePropertyId || t.propertyId === activePropertyId)
    .map(t => ({ value: t.id!, label: `${t.firstName} ${t.lastName}` }));

  function handleTenantChange(tenantId: string) {
    const tenant = (tenants || []).find(t => t.id === Number(tenantId));
    setForm(f => ({
      ...f, tenantId,
      unitId: tenant ? String(tenant.unitId) : '',
      propertyId: tenant ? String(tenant.propertyId) : '',
    }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('File must be under 5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result as string);
      setFileName(file.name);
      if (!form.name) setForm(f => ({ ...f, name: file.name.replace(/\.[^.]+$/, '') }));
    };
    reader.readAsDataURL(file);
  }

  function validate(): boolean {
    const e: Partial<Form & { file: string }> = {};
    if (!form.tenantId) e.tenantId = 'Select a tenant';
    if (!form.name.trim()) e.name = 'Document name is required';
    if (!fileData) e.file = 'Please select a file';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await db.documents.add({
        tenantId: Number(form.tenantId),
        unitId: Number(form.unitId),
        propertyId: Number(form.propertyId),
        name: form.name.trim(),
        type: form.type,
        fileData,
        createdAt: new Date(),
      });
      showToast('Document uploaded successfully');
      setModalOpen(false);
      setFileData('');
      setFileName('');
    } catch { showToast('Failed to upload document', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await db.documents.delete(deleteId);
      showToast('Document deleted');
    } catch { showToast('Failed to delete', 'error'); }
    finally { setDeleting(false); setDeleteId(null); }
  }

  function handleDownload(doc: Document) {
    const a = window.document.createElement('a');
    a.href = doc.fileData;
    a.download = doc.name;
    a.click();
  }

  const filtered = (documents || []).filter(d => {
    const pMatch = !activePropertyId || d.propertyId === activePropertyId;
    const tMatch = !filterTenantId || d.tenantId === Number(filterTenantId);
    return pMatch && tMatch;
  });

  if (!properties || !allUnits || !tenants || !documents) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <SelectField options={tenantOptions} placeholder="All Tenants" value={filterTenantId}
          onChange={e => setFilterTenantId(e.target.value)} className="w-52" />
        <Button onClick={() => { setForm(empty); setFileData(''); setFileName(''); setErrors({}); setModalOpen(true); }}>
          <Plus size={16} />Upload Document
        </Button>
      </div>

      <Card>
        <CardHeader title="Documents" subtitle={`${filtered.length} document${filtered.length !== 1 ? 's' : ''}`} />
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState icon={<FileText size={32} />} title="No documents"
              description="Upload tenant contracts, IDs, and other important documents."
              action={<Button onClick={() => setModalOpen(true)}><Upload size={16} />Upload Document</Button>} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(doc => {
                const tenant = tenantMap[doc.tenantId];
                const isImage = doc.fileData.startsWith('data:image/');
                return (
                  <div key={doc.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {typeIcons[doc.type]}
                        <Badge variant={typeColors[doc.type] as 'blue' | 'purple' | 'gray'} className="capitalize">
                          {doc.type}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        {isImage && (
                          <button onClick={() => setPreviewDoc(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors">
                            <Eye size={14} />
                          </button>
                        )}
                        <button onClick={() => handleDownload(doc)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded cursor-pointer transition-colors">
                          <Download size={14} />
                        </button>
                        <button onClick={() => setDeleteId(doc.id!)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm truncate mb-1">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {tenant ? `${tenant.firstName} ${tenant.lastName}` : '—'} · {propMap[doc.propertyId] || '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(doc.createdAt)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Upload Document"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}><Upload size={14} />Upload</Button>
        </>}
      >
        <div className="space-y-4">
          <SelectField label="Tenant" options={tenantOptions} placeholder="Select tenant"
            value={form.tenantId} onChange={e => handleTenantChange(e.target.value)}
            error={errors.tenantId} required />
          <Input label="Document Name" placeholder="e.g., Lease Contract, Gov't ID"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            error={errors.name} required />
          <SelectField label="Document Type" options={[
            { value: 'contract', label: 'Lease Contract' },
            { value: 'id', label: 'Government ID' },
            { value: 'other', label: 'Other' },
          ]} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Form['type'] }))} required />

          {/* File upload */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">File <span className="text-red-500">*</span></label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                fileData ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              {fileData ? (
                <div>
                  <FileCheck size={24} className="text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-700">{fileName}</p>
                  <p className="text-xs text-green-500 mt-1">File ready — click to change</p>
                </div>
              ) : (
                <div>
                  <Upload size={24} className="text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Click to upload file</p>
                  <p className="text-xs text-gray-400 mt-1">Images, PDF, DOC — max 5MB</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileChange} />
            {errors.file && <p className="text-xs text-red-500">{errors.file}</p>}
          </div>
        </div>
      </Modal>

      {/* Image preview */}
      {previewDoc && (
        <Modal open={previewDoc !== null} onClose={() => setPreviewDoc(null)} title={previewDoc.name} size="lg"
          footer={<>
            <Button variant="secondary" onClick={() => setPreviewDoc(null)}>Close</Button>
            <Button onClick={() => handleDownload(previewDoc)}><Download size={14} />Download</Button>
          </>}
        >
          <img src={previewDoc.fileData} alt={previewDoc.name} className="w-full rounded-lg" />
        </Modal>
      )}

      <ConfirmDialog open={deleteId !== null} onClose={() => setDeleteId(null)}
        onConfirm={handleDelete} loading={deleting} message="Delete this document? This cannot be undone." />
    </div>
  );
}
