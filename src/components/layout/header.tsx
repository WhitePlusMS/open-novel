'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, PenTool, Bookmark, User, Bot, Crown, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const NAV_ITEMS = [
  { href: '/', icon: Home, label: '首页', requireAuth: false },
  { href: '/create', icon: PenTool, label: '创作', requireAuth: true },
  { href: '/favorites', icon: Bookmark, label: '书架', requireAuth: true },
  { href: '/profile/edit', icon: Bot, label: 'Agent 配置', requireAuth: true },
  { href: '/profile', icon: User, label: '我的', requireAuth: true },
];

/**
 * 顶部导航栏组件
 * 设计原则：极简、符合番茄小说风格
 * 桌面端显示完整导航，移动端只显示 Logo
 */
export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 检查是否是管理员
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      try {
        const response = await fetch('/api/admin/test/get-token');
        const result = await response.json();
        setIsAdmin(result.code === 0);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [user]);

  // 管理员/历史赛季导航项
  const seasonNavItem = {
    href: '/admin',
    icon: Crown,
    label: isAdmin ? '赛季管理' : '历史赛季',
    requireAuth: true,
    requireAdmin: false, // 所有登录用户都可以访问
  };

  // 过滤导航项：只显示有权限的项
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.requireAuth && !user) return false;
    return true;
  });

  // 添加赛季管理入口（所有登录用户可见，名称根据权限区分）
  const allNavItems: Array<typeof NAV_ITEMS[0] & { isAdmin?: boolean }> = user
    ? [...visibleNavItems, { ...seasonNavItem, isAdmin }]
    : visibleNavItems;

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
      {/* 桌面端导航 - 更宽 */}
      <div className="hidden lg:flex max-w-6xl mx-auto px-6 h-14 items-center justify-between">
        {/* Logo - 渐变效果 */}
        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-primary-500 to-primary-600 bg-clip-text text-transparent">
          InkSurvivor
        </Link>

        {/* 导航链接 */}
        <nav className="flex items-center gap-1">
          {allNavItems.map((item) => {
            const isActive = pathname === item.href;
            const isDisabled = item.requireAuth && !user;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
                  isActive
                    ? 'text-primary-600 bg-primary-50 dark:text-primary-400 dark:bg-primary-900/30'
                    : item.isAdmin
                      ? 'text-purple-600 bg-purple-50 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30 dark:hover:text-purple-300 dark:hover:bg-purple-900/50'
                      : 'text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800',
                  isDisabled && 'opacity-50 pointer-events-none'
                )}
                aria-label={item.label}
              >
                <item.icon className="w-4 h-4" aria-hidden="true" />
                <span className="text-sm font-medium">{item.label}</span>
                {/* 激活指示器 */}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-500" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* 主题切换按钮 */}
        <ThemeToggle />

      </div>

      {/* 移动端导航 - 添加 hamburger 菜单 */}
      <div className="lg:hidden max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo - 渐变效果 */}
        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary-500 to-primary-600 bg-clip-text text-transparent">
          InkSurvivor
        </Link>

        {/* Hamburger 菜单按钮 */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label={isMobileMenuOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* 移动端下拉菜单 */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-14 z-50 bg-white dark:bg-surface-900 border-t border-gray-100 dark:border-surface-800 animate-fade-in-up">
          <nav className="flex flex-col p-4 gap-2">
            {allNavItems.map((item) => {
              const isActive = pathname === item.href;
              const isDisabled = item.requireAuth && !user;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                    isActive
                      ? 'text-primary-600 bg-primary-50 dark:text-primary-400 dark:bg-primary-900/30'
                      : item.isAdmin
                        ? 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/30'
                        : 'text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800',
                    isDisabled && 'opacity-50 pointer-events-none'
                  )}
                  aria-label={item.label}
                >
                  <item.icon className="w-5 h-5" aria-hidden="true" />
                  <span className="text-base font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
