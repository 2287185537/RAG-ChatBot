"use client"

import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "./ThemeProvider"
import { Button } from "./ui/button"

// 主题切换按钮组件 - 提供美观的主题切换界面
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  // 循环切换主题：light -> dark -> system -> light
  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("system")
    } else {
      setTheme("light")
    }
  }

  // 根据当前主题返回对应的图标
  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />
      case "dark":
        return <Moon className="h-4 w-4" />
      case "system":
        return <Monitor className="h-4 w-4" />
      default:
        return <Sun className="h-4 w-4" />
    }
  }

  // 获取主题的中文描述
  const getThemeLabel = () => {
    switch (theme) {
      case "light":
        return "浅色模式"
      case "dark":
        return "深色模式"
      case "system":
        return "跟随系统"
      default:
        return "浅色模式"
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="h-9 w-9 rounded-full bg-background/20 backdrop-blur-md border-white/20 hover:bg-background/30 transition-all duration-300"
      title={getThemeLabel()}
    >
      {getIcon()}
    </Button>
  )
}
