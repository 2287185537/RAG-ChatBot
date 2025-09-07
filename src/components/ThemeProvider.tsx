"use client"

import { createContext, useContext, useEffect, useState } from "react"

// 主题类型定义
type Theme = "light" | "dark" | "system"

// 主题上下文类型定义
type ThemeProviderContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

// 创建主题上下文
const ThemeProviderContext = createContext<ThemeProviderContextType | undefined>(undefined)

// 主题提供者组件的属性类型
type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

// 主题提供者组件 - 负责管理整个应用的主题状态
export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "rag-chatbot-theme",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)

  // 组件挂载后从本地存储读取主题设置
  useEffect(() => {
    const storedTheme = localStorage.getItem(storageKey) as Theme
    if (storedTheme) {
      setTheme(storedTheme)
    }
  }, [storageKey])

  // 主题变化时更新本地存储和DOM类名
  useEffect(() => {
    const root = window.document.documentElement

    // 移除之前的主题类名
    root.classList.remove("light", "dark")

    let systemTheme: Theme = "light"
    // 如果是系统主题，检测系统偏好
    if (theme === "system") {
      systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    }

    // 应用主题类名
    const activeTheme = theme === "system" ? systemTheme : theme
    root.classList.add(activeTheme)

    // 保存到本地存储
    localStorage.setItem(storageKey, theme)
  }, [theme, storageKey])

  const value = {
    theme,
    setTheme,
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

// 使用主题的Hook - 让组件可以访问和修改主题
export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
