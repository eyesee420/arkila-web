import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface CardProps {
  className?: string;
  children: ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm', className)}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between px-5 py-4 border-b border-gray-100', className)}>
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({ className, children }: CardProps) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  iconBg?: string;
  sub?: string;
  subColor?: string;
}

export function StatCard({ label, value, icon, iconBg = 'bg-blue-50', sub, subColor = 'text-gray-400' }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className={`mt-1 text-xs ${subColor}`}>{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${iconBg} shrink-0`}>{icon}</div>
      </div>
    </Card>
  );
}
