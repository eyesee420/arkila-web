import { cn } from '@/lib/utils';

type BadgeVariant = 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-800',
};

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}

export function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    paid: { label: 'Paid', variant: 'green' },
    unpaid: { label: 'Unpaid', variant: 'red' },
    partial: { label: 'Partial', variant: 'amber' },
    occupied: { label: 'Occupied', variant: 'blue' },
    vacant: { label: 'Vacant', variant: 'gray' },
    active: { label: 'Active', variant: 'green' },
    consumed: { label: 'Consumed', variant: 'red' },
    refunded: { label: 'Refunded', variant: 'gray' },
    rent_due: { label: 'Rent Due', variant: 'amber' },
    rent_overdue: { label: 'Overdue', variant: 'red' },
    utility: { label: 'Utility', variant: 'blue' },
    announcement: { label: 'Announcement', variant: 'purple' },
  };
  const entry = map[status] || { label: status, variant: 'gray' as BadgeVariant };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
