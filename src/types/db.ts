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
