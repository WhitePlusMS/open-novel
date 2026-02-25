import { cn } from '@/lib/utils';
import * as React from 'react';
import { forwardRef } from 'react';
import Image from 'next/image';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  src?: string;
  alt?: string;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = 'md', shape = 'circle', src, alt = 'Avatar', ...props }, ref) => {
    const sizes: Record<string, string> = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-12 h-12 text-lg', xl: 'w-16 h-16 text-xl' };
    const shapes: Record<string, string> = { circle: 'rounded-full', square: 'rounded-xl' };

    if (src) {
      return (
        <div
          ref={ref}
          className={cn('relative overflow-hidden bg-gray-100 ring-2 ring-white shadow-sm', sizes[size], shapes[shape], className)}
          {...props}
        >
          <Image src={src} alt={alt} fill className="object-cover" />
        </div>
      );
    }
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-600 text-white font-semibold shadow-sm',
          sizes[size],
          shapes[shape],
          className
        )}
        {...props}
      >
        {alt.charAt(0).toUpperCase()}
      </div>
    );
  }
);
Avatar.displayName = 'Avatar';

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, max = 3, size = 'md', children, ...props }, ref) => {
    const childrenArray = React.Children.toArray(children);
    const visibleChildren = childrenArray.slice(0, max);
    const remainingCount = childrenArray.length - max;

    const sizeClasses: Record<string, string> = {
      xs: 'w-6 h-6 text-xs',
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-sm',
    };

    return (
      <div ref={ref} className={cn('flex -space-x-2', className)} {...props}>
        {visibleChildren}
        {remainingCount > 0 && (
          <div className={cn(
            'flex items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-300 text-gray-600 font-medium ring-2 ring-white shadow-sm',
            sizeClasses[size]
          )}>
            +{remainingCount}
          </div>
        )}
      </div>
    );
  }
);
AvatarGroup.displayName = 'AvatarGroup';
