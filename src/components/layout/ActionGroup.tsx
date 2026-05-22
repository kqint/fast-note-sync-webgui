import { useTheme } from "@/components/context/theme-context";
import { Sun, Moon, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

import { ColorSchemeSwitcher } from "./ColorSchemeSwitcher";
import { LanguageSwitcher } from "./language-switcher";


interface ActionGroupProps {
  /** 额外的 CSS 类名 */
  className?: string
}

/**
 * ActionGroup - 操作按钮组
 *
 * 包含常用操作按钮：
 * - 主题切换 (sun/moon/sun-moon icon)
 * - 语言切换 (languages icon)
 * - 使用 ghost variant 按钮
 * - 统一的 gap-1 间距
 */
export function ActionGroup({ className }: ActionGroupProps) {
  const { t } = useTranslation()
  const { theme, resolvedTheme, setTheme } = useTheme()

  const handleThemeToggle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else if (theme === "system") setTheme("auto");
    else setTheme("light");
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Theme Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        onClick={handleThemeToggle}
        aria-label={t("ui.common.toggleTheme")}
        title={t(
          theme === "auto" ? "ui.settings.themeAuto"
          : theme === "system" ? "ui.settings.themeSystem"
          : resolvedTheme === "dark" ? "ui.settings.themeDark"
          : "ui.settings.themeLight"
        )}
      >
        {theme === "auto" ? (
          <SunMoon className="size-5 text-primary" />
        ) : resolvedTheme === "dark" ? (
          <Moon className="size-5" />
        ) : (
          <Sun className="size-5" />
        )}
      </Button>

      {/* Color Scheme Switcher */}
      <ColorSchemeSwitcher className="size-9" />

      {/* Language Switcher */}
      <LanguageSwitcher className="size-9" />
    </div>
  )
}
