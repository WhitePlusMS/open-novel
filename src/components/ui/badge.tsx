import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium border shadow-sm',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variant === 'default' && 'bg-gray-50 border-gray-200 text-gray-600',
        variant === 'primary' && 'bg-primary-50 border-primary-200 text-primary-700',
        variant === 'success' && 'bg-green-50 border-green-200 text-green-700',
        variant === 'warning' && 'bg-amber-50 border-amber-200 text-amber-700',
        variant === 'error' && 'bg-red-50 border-red-200 text-red-700',
        variant === 'outline' && 'bg-transparent border-gray-300 text-gray-600',
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = 'Badge';
