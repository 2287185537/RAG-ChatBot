import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// 导入我们的数据查询提供者组件
// 这个组件会给整个应用提供数据获取的能力
import QueryClientProvider from "@/components/QueryClientProvider";
// 导入主题提供者组件
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI知识库聊天助手",
  description: "基于RAG技术的智能学术知识库问答系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
      >
        {/* 主题提供者 - 为整个应用提供主题切换功能 */}
        <ThemeProvider defaultTheme="system" storageKey="rag-chatbot-theme">
          {/* 用 App 组件包裹整个应用 */}
          {/* 这样所有的页面和组件都能使用 React Query 的功能 */}
          {/* 比如获取数据、缓存数据、自动重试等 */}
          <QueryClientProvider>
            {children}
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
