import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'text', width, height, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] skeleton-shimmer',
        variant === 'text' ? 'rounded-md' : variant === 'circular' ? 'rounded-full' : 'rounded-xl',
        className
      )}
      style={{
        width,
        height: height || (variant === 'text' ? '1em' : undefined)
      }}
      {...props}
    />
  )
);
Skeleton.displayName = 'Skeleton';

export const SkeletonCard = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-2xl bg-white p-4 shadow-sm border border-gray-100 space-y-4', className)}
      {...props}
    >
      <Skeleton variant="rectangular" width="100%" height="160px" className="rounded-xl" />
      <div className="space-y-2">
        <Skeleton width="70%" height="20px" />
        <Skeleton width="90%" height="16px" />
        <Skeleton width="50%" height="16px" />
      </div>
      <div className="flex gap-3">
        <Skeleton width="60px" height="24px" className="rounded-full" />
        <Skeleton width="60px" height="24px" className="rounded-full" />
      </div>
    </div>
  )
);
SkeletonCard.displayName = 'SkeletonCard';
