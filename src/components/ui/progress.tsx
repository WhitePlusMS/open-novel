import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'error';
  striped?: boolean;
  animated?: boolean;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, size = 'md', showLabel = false, color = 'primary', striped = false, animated = false, ...props }, ref) => {
    const sizes: Record<string, string> = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' };
    const colors: Record<string, string> = {
      primary: 'bg-gradient-to-r from-primary-400 to-primary-600',
      success: 'bg-gradient-to-r from-green-400 to-green-600',
      warning: 'bg-gradient-to-r from-amber-400 to-amber-600',
      error: 'bg-gradient-to-r from-red-400 to-red-600',
    };

    const stripedClass = striped || animated
      ? 'bg-[length:16px_16px]'
      : '';

    const animatedClass = animated
      ? 'animate-progress-striped'
      : '';

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {showLabel && (
          <div className="flex justify-between mb-2 text-sm text-gray-500">
            <span>进度</span>
            <span className="font-medium text-gray-700">{Math.round(value)}%</span>
          </div>
        )}
        <div className={cn('w-full bg-gray-100 rounded-full overflow-hidden', sizes[size])}>
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              colors[color],
              stripedClass,
              animatedClass
            )}
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
      </div>
    );
  }
);
Progress.displayName = 'Progress';
