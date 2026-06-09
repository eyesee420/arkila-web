import Dexie, { type Table } from 'dexie';

export interface Property {
  id?: number;
  name: string;
  address: string;
  createdAt: Date;
}

export interface Unit {
  id?: number;
  propertyId: number;
  unitNumber: string;
  monthlyRent: number;
  status: 'occupied' | 'vacant';
  createdAt: Date;
}

export interface Tenant {
  id?: number;
  unitId: number;
  propertyId: number;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  emergencyContact: string;
  emergencyPhone: string;
  moveInDate: Date;
  moveOutDate?: Date;
  depositPaid: number;
  depositStatus: 'active' | 'consumed' | 'refunded';
  createdAt: Date;
}

export interface RentPayment {
  id?: number;
  tenantId: number;
  unitId: number;
  propertyId: number;
  amount: number;
  balance: number;
  month: number;
  year: number;
  status: 'paid' | 'unpaid' | 'partial';
  paymentMethod: 'cash' | 'gcash' | 'bank_transfer';
  paymentDate?: Date;
  createdAt: Date;
}

export interface Utility {
  id?: number;
  unitId: number;
  tenantId: number;
  propertyId: number;
  type: 'water' | 'electricity';
  amount: number;
  month: number;
  year: number;
  status: 'paid' | 'unpaid';
  createdAt: Date;
}

export interface MeterReading {
  id?: number;
  unitId: number;
  propertyId: number;
  previousReading: number;
  currentReading: number;
  consumption: number;
  month: number;
  year: number;
  createdAt: Date;
}

export interface Expense {
  id?: number;
  propertyId: number;
  unitId?: number;
  description: string;
  amount: number;
  date: Date;
  createdAt: Date;
}

export interface Document {
  id?: number;
  tenantId: number;
  unitId: number;
  propertyId: number;
  name: string;
  type: 'contract' | 'id' | 'other';
  fileData: string;
  createdAt: Date;
}

export interface Notification {
  id?: number;
  tenantId: number;
  unitId: number;
  propertyId: number;
  message: string;
  type: 'rent_due' | 'rent_overdue' | 'utility' | 'announcement';
  isRead: boolean;
  createdAt: Date;
}

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