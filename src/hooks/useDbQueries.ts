import { useQuery } from '@tanstack/react-query';
import { db } from '@/db/database';

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: () => db.properties.orderBy('name').toArray(),
  });
}

export function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: () => db.units.toArray(),
  });
}

export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: () => db.tenants.orderBy('firstName').toArray(),
  });
}

export function useRentPayments() {
  return useQuery({
    queryKey: ['rentPayments'],
    queryFn: () => db.rentPayments.orderBy('id').reverse().toArray(),
  });
}

export function useUtilities() {
  return useQuery({
    queryKey: ['utilities'],
    queryFn: () => db.utilities.orderBy('id').reverse().toArray(),
  });
}

export function useMeterReadings() {
  return useQuery({
    queryKey: ['meterReadings'],
    queryFn: () => db.meterReadings.orderBy('id').reverse().toArray(),
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: () => db.expenses.orderBy('date').reverse().toArray(),
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: () => db.documents.orderBy('id').reverse().toArray(),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => db.notifications.orderBy('createdAt').reverse().toArray(),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: () => db.notifications.filter((n) => !n.isRead).count(),
  });
}

export function useRentPaymentsByMonth(month: number, year: number) {
  return useQuery({
    queryKey: ['rentPayments', 'byMonth', month, year],
    queryFn: () => db.rentPayments.where('[month+year]').equals([month, year]).toArray(),
  });
}

export function useUtilitiesByMonth(month: number, year: number) {
  return useQuery({
    queryKey: ['utilities', 'byMonth', month, year],
    queryFn: () => db.utilities.where('[month+year]').equals([month, year]).toArray(),
  });
}
