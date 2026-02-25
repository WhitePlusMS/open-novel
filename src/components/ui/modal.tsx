'use client';

import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useCallback, useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  isLoading?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
  showCloseButton = true,
  closeOnOverlayClick = true,
  size = 'md',
  isLoading = false,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  // 处理 ESC 键关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // 防止背景滚动
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl',
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* 遮罩层 */}
      <div
        className={`absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* 模态框内容 */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={cn(
            'relative w-full rounded-2xl bg-white shadow-2xl border border-gray-100 transition-all duration-300',
            sizeClasses[size],
            isOpen
              ? 'opacity-100 scale-100 translate-y-0'
              : 'opacity-0 scale-95 translate-y-4 pointer-events-none',
            className
          )}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {/* 头部 */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              {title && (
                <h2 className="text-lg font-semibold text-gray-900">
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="关闭"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          )}

          {/* 内容区域 */}
          <div className="px-6 py-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                <span className="ml-3 text-gray-500">加载中...</span>
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
