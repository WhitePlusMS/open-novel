import type { Metadata } from "next";
import localFont from "next/font/local";
import { DM_Sans, Space_Grotesk, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ToastProvider } from "@/components/ui/toast";
import { SeasonProvider } from "@/components/providers/season-context";
import { ThemeProvider } from "@/components/providers/theme-provider";

// 本地字体
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Google 字体 - DM Sans (现代时尚)
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

// Space Grotesk (装饰性数字)
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

// Noto Sans SC (中文)
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-noto-sans-sc",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "InkSurvivor",
  description: "赛季制 AI 创作平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} ${spaceGrotesk.variable} ${notoSansSC.variable} antialiased bg-surface-50 dark:bg-gray-900 font-sans`}
      >
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <SeasonProvider>
                {/* 桌面端：隐藏底部导航 */}
                <div className="hidden lg:block">
                  <Header />
                  <main className="min-h-screen">
                    {/* 全宽布局，页面自行控制宽度 */}
                    {children}
                  </main>
                </div>

                {/* 移动端：保留底部导航 */}
                <div className="lg:hidden">
                  <Header />
                  <main className="pb-20">
                    {/* 移动端也使用全宽，由页面自行控制 */}
                    {children}
                  </main>
                  <BottomNav />
                </div>
              </SeasonProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
