import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white';
}

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = 'md', color = 'primary', ...props }, ref) => {
    const sizes = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-8 h-8 border-3' };
    const colors = { primary: 'border-primary-500 border-t-transparent', white: 'border-white border-t-transparent' };

    return (
      <div
        ref={ref}
        className={cn('rounded-full animate-spin', sizes[size], colors[color], className)}
        role="status"
        aria-label="加载中"
        {...props}
      >
        <span className="sr-only">加载中...</span>
      </div>
    );
  }
);
Spinner.displayName = 'Spinner';

export const SpinnerOverlay = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80', className)} role="status" aria-live="polite" aria-label="加载中" {...props}>
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        {children && <p className="text-sm text-surface-600 dark:text-gray-300">{children}</p>}
      </div>
    </div>
  )
);
SpinnerOverlay.displayName = 'SpinnerOverlay';
