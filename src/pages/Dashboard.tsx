import { useLiveQuery } from 'dexie-react-hooks';
import { Building2, DoorOpen, Users, Banknote, TrendingUp, AlertCircle } from 'lucide-react';
import { db } from '@/db/database';
import { useActiveProperty } from '@/contexts/ActivePropertyContext';
import { StatCard, Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, formatMonth, currentMonth, currentYear } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const month = currentMonth();
  const year = currentYear();
  const { activePropertyId } = useActiveProperty();

  const data = useLiveQuery(async () => {
    const [allProperties, allUnits, allTenants, rawPayments] = await Promise.all([
      db.properties.toArray(),
      db.units.toArray(),
      db.tenants.toArray(),
      db.rentPayments.toArray(),
    ]);

    const pid = activePropertyId;
    const properties = pid ? allProperties.filter(p => p.id === pid) : allProperties;
    const units = pid ? allUnits.filter(u => u.propertyId === pid) : allUnits;
    const tenants = pid ? allTenants.filter(t => t.propertyId === pid) : allTenants;
    const allPayments = pid ? rawPayments.filter(p => p.propertyId === pid) : rawPayments;

    const allRecent = await db.rentPayments.orderBy('id').reverse().toArray();
    const recentPayments = (pid ? allRecent.filter(p => p.propertyId === pid) : allRecent).slice(0, 8);

    const occupied = units.filter(u => u.status === 'occupied').length;
    const vacant = units.length - occupied;

    const currentPayments = allPayments.filter(p => p.month === month && p.year === year);
    const collected = currentPayments
      .filter(p => p.status === 'paid' || p.status === 'partial')
      .reduce((s, p) => s + p.amount, 0);

    // Unpaid: occupied tenants with no paid/partial record for current month
    const occupiedUnitIds = new Set(units.filter(u => u.status === 'occupied').map(u => u.id!));
    const occupiedTenants = tenants.filter(t => occupiedUnitIds.has(t.unitId));
    const paidThisMonth = new Set(
      currentPayments.filter(p => p.status === 'paid' || p.status === 'partial').map(p => p.tenantId)
    );
    const unpaid = occupiedTenants.filter(t => !paidThisMonth.has(t.id!)).length;

    // Overdue: occupied tenants missing a paid/partial record for any of the last 2 months
    const clearedMonths = new Map<number, Set<string>>();
    for (const p of allPayments) {
      if (p.status === 'paid' || p.status === 'partial') {
        if (!clearedMonths.has(p.tenantId)) clearedMonths.set(p.tenantId, new Set());
        clearedMonths.get(p.tenantId)!.add(`${p.month}-${p.year}`);
      }
    }
    const overdueSet = new Set<number>();
    for (const tenant of occupiedTenants) {
      // Paid this month → considered current, not overdue
      if (paidThisMonth.has(tenant.id!)) continue;
      const moveIn = new Date(tenant.moveInDate);
      const cleared = clearedMonths.get(tenant.id!) || new Set<string>();
      for (let i = 1; i <= 2; i++) {
        let cm = month - i;
        let cy = year;
        if (cm <= 0) { cm += 12; cy--; }
        const wasTenant = cy > moveIn.getFullYear() ||
          (cy === moveIn.getFullYear() && cm >= moveIn.getMonth() + 1);
        if (wasTenant && !cleared.has(`${cm}-${cy}`)) { overdueSet.add(tenant.id!); break; }
      }
    }
    const overdue = overdueSet.size;

    const tenantMap = Object.fromEntries(tenants.map(t => [t.id!, t]));
    const unitMap = Object.fromEntries(units.map(u => [u.id!, u]));
    const propMap = Object.fromEntries(properties.map(p => [p.id!, p]));

    return { properties, units, occupied, vacant, collected, unpaid, overdue, recentPayments, tenantMap, unitMap, propMap };
  }, [activePropertyId]);

  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Properties"
          value={data.properties.length}
          icon={<Building2 size={19} className="text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Total Units"
          value={data.units.length}
          icon={<DoorOpen size={19} className="text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
        <StatCard
          label="Occupied"
          value={data.occupied}
          icon={<Users size={19} className="text-green-600" />}
          iconBg="bg-green-50"
          sub={`${data.vacant} vacant`}
          subColor="text-gray-400"
        />
        <StatCard
          label="Collected"
          value={formatCurrency(data.collected)}
          icon={<TrendingUp size={19} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          sub={formatMonth(month, year)}
        />
        <StatCard
          label="Unpaid"
          value={data.unpaid}
          icon={<Banknote size={19} className="text-amber-600" />}
          iconBg="bg-amber-50"
          sub="this month"
          subColor={data.unpaid > 0 ? 'text-amber-500' : 'text-gray-400'}
        />
        <StatCard
          label="Overdue"
          value={data.overdue}
          icon={<AlertCircle size={19} className="text-red-500" />}
          iconBg="bg-red-50"
          sub="alerts"
          subColor={data.overdue > 0 ? 'text-red-500' : 'text-gray-400'}
        />
      </div>

      {/* Recent payments */}
      <Card>
        <CardHeader
          title="Recent Rent Payments"
          subtitle={`${data.recentPayments.length} latest records`}
          action={
            <Link to="/rent-payments" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all →
            </Link>
          }
        />
        <CardContent className="p-0">
          {data.recentPayments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No payment records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Tenant</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Unit</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Period</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPayments.map(p => {
                    const tenant = data.tenantMap[p.tenantId];
                    const unit = data.unitMap[p.unitId];
                    return (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {tenant ? `${tenant.firstName} ${tenant.lastName}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-600">{unit?.unitNumber || '—'}</td>
                        <td className="px-5 py-3 text-gray-600">{formatMonth(p.month, p.year)}</td>
                        <td className="px-5 py-3 text-right  font-semibold text-blue-900">{formatCurrency(p.amount)}</td>
                        <td className="px-5 py-3">{statusBadge(p.status)}</td>
                        <td className="px-5 py-3 text-gray-400">{p.paymentDate ? formatDate(p.paymentDate) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Occupancy by property */}
      {data.properties.length > 0 && (
        <Card>
          <CardHeader title="Occupancy by Property" />
          <CardContent className="space-y-4">
            {data.properties.map(prop => {
              const propUnits = data.units.filter(u => u.propertyId === prop.id!);
              const occ = propUnits.filter(u => u.status === 'occupied').length;
              const pct = propUnits.length > 0 ? Math.round((occ / propUnits.length) * 100) : 0;
              return (
                <div key={prop.id} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-800 truncate">{prop.name}</span>
                      <span className="text-xs text-gray-400 ml-2 shrink-0">{occ}/{propUnits.length} occupied</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct === 100 ? '#22c55e' : pct === 0 ? '#e5e7eb' : '#3b82f6',
                        }}
                      />
                    </div>
                  </div>
                  <Badge variant={pct === 100 ? 'green' : pct === 0 ? 'red' : 'amber'}>{pct}%</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
