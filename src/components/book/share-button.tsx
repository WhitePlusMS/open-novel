'use client';

import { useState, useEffect } from 'react';
import { Share2, Link2 } from 'lucide-react';
import { FaWeixin, FaQq, FaWeibo } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import Modal from '@/components/ui/modal';

interface ShareButtonProps {
  bookId: string;
  bookTitle: string;
}

/**
 * 分享按钮组件
 * 点击打开分享弹窗，支持复制链接和社交平台分享
 */
export function ShareButton({ bookId, bookTitle }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { success, error: showError } = useToast();

  // 确保只在客户端渲染后显示弹窗
  useEffect(() => {
    setMounted(true);
  }, []);

  // 生成分享链接
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/book/${bookId}`
    : `/book/${bookId}`;

  // 复制链接到剪贴板
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      success('链接已复制到剪贴板');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('[ShareButton] Failed to copy link:', err);
      showError('复制失败，请手动复制');
    }
  };

  // 社交平台分享（由于没有实际分享API，点击后复制链接并提示）
  const handleSocialShare = async (platform: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      success(`链接已复制，请在${platform}中粘贴分享`);
    } catch (err) {
      console.error('[ShareButton] Failed to copy link:', err);
      showError('复制失败，请手动复制');
    }
  };

  // 分享选项配置
  const shareOptions = [
    { id: 'wechat', name: '微信', icon: FaWeixin, color: 'bg-green-500' },
    { id: 'weibo', name: '微博', icon: FaWeibo, color: 'bg-red-500' },
    { id: 'qq', name: 'QQ', icon: FaQq, color: 'bg-blue-500' },
  ];

  return (
    <>
      {/* 分享按钮 - 带文字说明 */}
      <button
        onClick={() => {
          console.log('[ShareButton] Button clicked, setting isOpen to true');
          setIsOpen(true);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="分享书籍"
      >
        <Share2 className="w-4 h-4" aria-hidden="true" />
        <span className="text-sm font-medium">分享</span>
      </button>

      {/* 分享弹窗 - 只有在 mounted 且 isOpen 为 true 时才渲染 */}
      {mounted && isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={() => {
            console.log('[ShareButton] Modal closing, setting isOpen to false');
            setIsOpen(false);
          }}
          title="分享书籍"
          size="sm"
        >
          <div className="space-y-6">
            {/* 书籍信息 */}
            <div className="text-center pb-4 border-b border-gray-100 dark:border-gray-700">
              <p className="text-gray-600 dark:text-gray-300 text-sm">分享「{bookTitle}」给朋友</p>
            </div>

            {/* 分享选项 */}
            <div className="grid grid-cols-4 gap-4">
              {/* 社交平台 */}
              {shareOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSocialShare(option.name)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', option.color)}>
                    <option.icon className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{option.name}</span>
                </button>
              ))}

              {/* 复制链接 */}
              <button
                onClick={handleCopyLink}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  isCopied ? 'bg-green-500' : 'bg-gray-600 dark:bg-gray-500'
                )}>
                  {isCopied ? (
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <Link2 className="w-6 h-6 text-white" aria-hidden="true" />
                  )}
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{isCopied ? '已复制' : '复制链接'}</span>
              </button>
            </div>

            {/* 链接预览 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">分享链接</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{shareUrl}</p>
            </div>

            {/* 关闭按钮 */}
            <button
              onClick={() => {
                console.log('[ShareButton] Cancel button clicked');
                setIsOpen(false);
              }}
              className="w-full py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              取消
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

