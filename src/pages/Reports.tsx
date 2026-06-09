import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Building2, DoorOpen } from 'lucide-react';
import { db } from '@/db/database';
import { useActiveProperty } from '@/contexts/ActivePropertyContext';
import { SelectField } from '@/components/ui/SelectField';
import { Card, CardHeader, CardContent, StatCard } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatMonth, monthOptions, currentMonth, currentYear } from '@/lib/utils';

export default function Reports() {
  const [month, setMonth] = useState(String(currentMonth()));
  const [year, setYear] = useState(String(currentYear()));
  const { activePropertyId } = useActiveProperty();

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear() - 2 + i;
    return { value: y, label: String(y) };
  });

  const report = useLiveQuery(async () => {
    const m = Number(month);
    const y = Number(year);
    const pid = activePropertyId;

    const [allProperties, allUnits, allTenants, rawPayments, rawUtilities, allExpenses] = await Promise.all([
      db.properties.toArray(),
      db.units.toArray(),
      db.tenants.toArray(),
      db.rentPayments.where('[month+year]').equals([m, y]).toArray(),
      db.utilities.where('[month+year]').equals([m, y]).toArray(),
      db.expenses.toArray(),
    ]);

    const properties = pid ? allProperties.filter(p => p.id === pid) : allProperties;
    const units = pid ? allUnits.filter(u => u.propertyId === pid) : allUnits;
    const tenants = pid ? allTenants.filter(t => t.propertyId === pid) : allTenants;
    const payments = pid ? rawPayments.filter(p => p.propertyId === pid) : rawPayments;
    const utilities = pid ? rawUtilities.filter(u => u.propertyId === pid) : rawUtilities;
    const expenses = pid ? allExpenses.filter(e => e.propertyId === pid) : allExpenses;

    // Rent stats
    const rentCollected = payments
      .filter(p => p.status === 'paid' || p.status === 'partial')
      .reduce((s, p) => s + p.amount, 0);
    const rentBalance = payments.reduce((s, p) => s + p.balance, 0);
    const rentPaid = payments.filter(p => p.status === 'paid').length;
    const rentUnpaid = payments.filter(p => p.status === 'unpaid').length;
    const rentPartial = payments.filter(p => p.status === 'partial').length;

    // Utility stats
    const utilCollected = utilities.filter(u => u.status === 'paid').reduce((s, u) => s + u.amount, 0);
    const utilUnpaid = utilities.filter(u => u.status === 'unpaid').reduce((s, u) => s + u.amount, 0);
    const elecAmount = utilities.filter(u => u.type === 'electricity').reduce((s, u) => s + u.amount, 0);
    const waterAmount = utilities.filter(u => u.type === 'water').reduce((s, u) => s + u.amount, 0);

    // Expenses for the month
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59);
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    });
    const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);

    // Total income
    const totalIncome = rentCollected + utilCollected;
    const netIncome = totalIncome - totalExpenses;

    // Occupancy per property
    const propertyStats = properties.map(prop => {
      const propUnits = units.filter(u => u.propertyId === prop.id!);
      const occ = propUnits.filter(u => u.status === 'occupied').length;
      const propTenants = tenants.filter(t => t.propertyId === prop.id!);
      const propPayments = payments.filter(p => p.propertyId === prop.id!);
      const propRentCollected = propPayments.filter(p => p.status === 'paid' || p.status === 'partial').reduce((s, p) => s + p.amount, 0);
      return {
        ...prop,
        totalUnits: propUnits.length,
        occupied: occ,
        pct: propUnits.length > 0 ? Math.round((occ / propUnits.length) * 100) : 0,
        tenantCount: propTenants.length,
        rentCollected: propRentCollected,
      };
    });

    // Expense breakdown by property
    const expByProperty = properties.map(prop => ({
      name: prop.name,
      amount: monthExpenses.filter(e => e.propertyId === prop.id!).reduce((s, e) => s + e.amount, 0),
    })).filter(e => e.amount > 0);

    return {
      rentCollected, rentBalance, rentPaid, rentUnpaid, rentPartial,
      utilCollected, utilUnpaid, elecAmount, waterAmount,
      totalExpenses, totalIncome, netIncome,
      propertyStats, expByProperty, monthExpenses,
    };
  }, [month, year, activePropertyId]);

  if (!report) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-600">Report Period:</span>
        <SelectField options={monthOptions()} value={month} onChange={e => setMonth(e.target.value)} className="w-36" />
        <SelectField options={yearOptions} value={year} onChange={e => setYear(e.target.value)} className="w-28" />
        <span className="text-sm text-gray-500">— {formatMonth(Number(month), Number(year))}</span>
      </div>

      {/* Income Summary */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-green-600" />Income Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Rent Collected" value={formatCurrency(report.rentCollected)}
            icon={<TrendingUp size={20} className="text-green-700" />} iconBg="bg-green-100" />
          <StatCard label="Utilities Collected" value={formatCurrency(report.utilCollected)}
            icon={<TrendingUp size={20} className="text-blue-700" />} iconBg="bg-blue-100" />
          <StatCard label="Total Income" value={formatCurrency(report.totalIncome)}
            icon={<TrendingUp size={20} className="text-emerald-700" />} iconBg="bg-emerald-100" />
          <StatCard label="Net Income" value={formatCurrency(report.netIncome)}
            icon={report.netIncome >= 0 ? <TrendingUp size={20} className="text-indigo-700" /> : <TrendingDown size={20} className="text-red-700" />}
            iconBg={report.netIncome >= 0 ? 'bg-indigo-100' : 'bg-red-100'}
            sub="after expenses" />
        </div>
      </div>

      {/* Rent Detail */}
      <Card>
        <CardHeader title="Rent Collection Details" />
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-green-700">{report.rentPaid}</p>
              <p className="text-sm text-gray-500 mt-1">Fully Paid</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-600">{report.rentPartial}</p>
              <p className="text-sm text-gray-500 mt-1">Partial</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-600">{report.rentUnpaid}</p>
              <p className="text-sm text-gray-500 mt-1">Unpaid</p>
            </div>
          </div>
          {report.rentBalance > 0 && (
            <div className="mt-4 bg-red-50 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-red-700">Outstanding Balance</span>
              <span className="font-bold text-red-700">{formatCurrency(report.rentBalance)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Utilities */}
      <Card>
        <CardHeader title="Utility Charges" />
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
              <span className="text-amber-800 font-medium">Electricity (Meralco)</span>
              <span className="font-bold text-amber-900">{formatCurrency(report.elecAmount)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-blue-800 font-medium">Water</span>
              <span className="font-bold text-blue-900">{formatCurrency(report.waterAmount)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-green-800 font-medium">Collected</span>
              <span className="font-bold text-green-900">{formatCurrency(report.utilCollected)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="text-red-800 font-medium">Unpaid</span>
              <span className="font-bold text-red-900">{formatCurrency(report.utilUnpaid)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <TrendingDown size={18} className="text-red-600" />Expenses
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-50 rounded-xl p-5">
            <p className="text-sm text-red-600 font-medium">Total Expenses</p>
            <p className="text-3xl font-bold text-red-800 mt-1">{formatCurrency(report.totalExpenses)}</p>
            <p className="text-xs text-red-500 mt-1">{report.monthExpenses.length} transaction{report.monthExpenses.length !== 1 ? 's' : ''}</p>
          </div>
          {report.expByProperty.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">By Property</p>
              <div className="space-y-2">
                {report.expByProperty.map(e => (
                  <div key={e.name} className="flex justify-between text-sm">
                    <span className="text-gray-600 truncate">{e.name}</span>
                    <span className="font-medium text-red-700 ml-2">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Occupancy */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Building2 size={18} className="text-blue-600" />Occupancy by Property
        </h3>
        <div className="space-y-3">
          {report.propertyStats.map(p => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">{p.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{p.tenantCount} tenant{p.tenantCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <Badge variant={p.pct === 100 ? 'green' : p.pct === 0 ? 'red' : 'amber'}>{p.pct}% occupied</Badge>
                  <p className="text-sm text-gray-600 mt-1 font-medium">{formatCurrency(p.rentCollected)} collected</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${p.pct}%` }} />
                </div>
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  <DoorOpen size={13} className="inline mr-1" />
                  {p.occupied}/{p.totalUnits}
                </span>
              </div>
            </Card>
          ))}
          {report.propertyStats.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">No properties to report on.</div>
          )}
        </div>
      </div>
    </div>
  );
}
