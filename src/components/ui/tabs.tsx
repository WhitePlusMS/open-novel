'use client';

import { cn } from '@/lib/utils';
import { createContext, useContext, useState, forwardRef } from 'react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

export interface Tab {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  tabs: Tab[];
  children: React.ReactNode;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ className, defaultValue, tabs, children, ...props }, ref) => {
    const [activeTab, setActiveTab] = useState(defaultValue || tabs[0]?.value);

    return (
      <TabsContext.Provider value={{ activeTab, setActiveTab }}>
        <div ref={ref} className={cn('w-full', className)} {...props}>
          <div className="flex border-b border-surface-200 dark:border-surface-700" role="tablist">
            {tabs.map((tab) => (
              <TabTrigger key={tab.value} value={tab.value} disabled={tab.disabled}>
                {tab.label}
              </TabTrigger>
            ))}
          </div>
          <div className="pt-4">{children}</div>
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = 'Tabs';

interface TabTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabTrigger = forwardRef<HTMLButtonElement, TabTriggerProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = useContext(TabsContext);
    if (!context) throw new Error('TabTrigger must be used within Tabs');
    const isActive = context.activeTab === value;

    return (
      <button
        ref={ref}
        className={cn(
          'px-4 py-2.5 text-sm font-medium transition-colors relative',
          'hover:text-primary-600 dark:hover:text-primary-400',
          isActive ? 'text-primary-600 dark:text-primary-400' : 'text-surface-600 dark:text-surface-400',
          props.disabled && 'opacity-50 cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset',
          className
        )}
        onClick={() => context.setActiveTab(value)}
        role="tab"
        aria-selected={isActive}
        aria-controls={`tabpanel-${value}`}
        tabIndex={isActive ? 0 : -1}
        {...props}
      >
        {children}
        {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 dark:bg-primary-400" />}
      </button>
    );
  }
);
TabTrigger.displayName = 'TabTrigger';

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = useContext(TabsContext);
    if (!context) throw new Error('TabPanel must be used within Tabs');
    if (context.activeTab !== value) return null;

    return (
      <div
        ref={ref}
        id={`tabpanel-${value}`}
        className={cn('animate-fade-in', className)}
        role="tabpanel"
        aria-labelledby={`tab-${value}`}
        tabIndex={0}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabPanel.displayName = 'TabPanel';
