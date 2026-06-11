import Dexie, { type Table } from 'dexie';
import type {
  Property,
  Unit,
  Tenant,
  RentPayment,
  Utility,
  MeterReading,
  Expense,
  Document,
  Notification,
} from '@/types/db';

export type {
  Property,
  Unit,
  Tenant,
  RentPayment,
  Utility,
  MeterReading,
  Expense,
  Document,
  Notification,
};

export class ArkilaDatabase extends Dexie {
  properties!: Table<Property>;
  units!: Table<Unit>;
  tenants!: Table<Tenant>;
  rentPayments!: Table<RentPayment>;
  utilities!: Table<Utility>;
  meterReadings!: Table<MeterReading>;
  expenses!: Table<Expense>;
  documents!: Table<Document>;
  notifications!: Table<Notification>;

  constructor() {
    super('ArkilaDB');
    this.version(1).stores({
      properties: '++id, name, createdAt',
      units: '++id, propertyId, status, createdAt',
      tenants: '++id, unitId, propertyId, createdAt',
      rentPayments: '++id, tenantId, unitId, propertyId, month, year, status',
      utilities: '++id, unitId, tenantId, propertyId, type, month, year, status',
      meterReadings: '++id, unitId, propertyId, month, year',
      expenses: '++id, propertyId, unitId, date',
      documents: '++id, tenantId, unitId, propertyId, type',
      notifications: '++id, tenantId, unitId, propertyId, isRead, createdAt',
    });
    this.version(2).stores({
      properties: '++id, name, createdAt',
      units: '++id, propertyId, status, createdAt',
      tenants: '++id, unitId, propertyId, createdAt',
      rentPayments: '++id, tenantId, unitId, propertyId, [month+year], status',
      utilities: '++id, unitId, tenantId, propertyId, type, [month+year], status',
      meterReadings: '++id, unitId, propertyId, [month+year]',
      expenses: '++id, propertyId, unitId, date',
      documents: '++id, tenantId, unitId, propertyId, type',
      notifications: '++id, tenantId, unitId, propertyId, isRead, createdAt',
    });
    this.version(3).stores({
      tenants: '++id, unitId, propertyId, firstName, createdAt',
    });
    // v4: remove isRead from notifications index — IndexedDB does not support boolean keys
    this.version(4).stores({
      notifications: '++id, tenantId, unitId, propertyId, createdAt',
    });
  }
}

export const db = new ArkilaDatabase();
