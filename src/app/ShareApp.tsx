import { useState, useEffect, useCallback } from "react";
import { useNoteHandle } from "@/components/api-handle/note-handle";
import { NoteDetail } from "@/lib/types/note";
import { useTranslation } from "react-i18next";
import { Loader2, Share2, Calendar, FileText, Sun, Moon, RefreshCw, MoveHorizontal, SunMoon, MoreVertical, Languages, Palette, Lock } from "lucide-react";
import { format } from "date-fns";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ColorSchemeSwitcher } from "@/components/layout/ColorSchemeSwitcher";
import { useTheme } from "@/components/context/theme-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { AnimatedBackground } from "@/components/user/animated-background";
import { useShareSettingsStore, COLOR_SCHEMES, ColorScheme } from "@/lib/stores/settings-store";
import { MarkdownEditor } from "@/components/note/markdown-editor";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { changeLang } from "@/i18n/utils";
import { toast } from "@/components/common/Toast";
import env from "@/env.ts";
import { addCacheBuster } from "@/lib/utils/cache-buster";
import { buildApiHeaders } from "@/lib/utils/api-headers";
import { handleFontsUpdate } from "@/lib/utils/font-loader";

export function ShareApp() {
    const { t } = useTranslation();
    const { theme, resolvedTheme, setTheme } = useTheme();
    const { handleGetShareNote } = useNoteHandle();
    
    const handleThemeToggle = () => {
        if (theme === "light") setTheme("dark");
        else if (theme === "dark") setTheme("system");
        else if (theme === "system") setTheme("auto");
        else setTheme("light");
    };
    const { colorScheme } = useShareSettingsStore();
    const [note, setNote] = useState<NoteDetail | null>(null);
    const [errorCode, setErrorCode] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [inputPassword, setInputPassword] = useState("");
    const [isPasswordRequired, setIsPasswordRequired] = useState(false);
    const [shareId, setShareId] = useState<string | null>(null);
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [isFullWidth, setIsFullWidth] = useState(() => {
        return localStorage.getItem("share-is-full-width") === "true";
    });

    useEffect(() => {
        localStorage.setItem("share-is-full-width", String(isFullWidth));
    }, [isFullWidth]);

    useEffect(() => {
        // 分享页面独立的语言初始化
        const shareLang = localStorage.getItem("share-lang");
        if (shareLang) {
            import("@/i18n/utils").then(u => u.changeLang(shareLang, "share-lang"));
        }

        // 分享页面字体同步加载
        let isMounted = true;
        const fetchConfig = async () => {
            try {
                const apiUrl = env.API_URL.endsWith("/") ? env.API_URL.slice(0, -1) : env.API_URL;
                const response = await fetch(addCacheBuster(`${apiUrl}/api/webgui/config`), {
                    headers: buildApiHeaders({
                        token: null,
                        includeContentType: false,
                        includeDomain: false,
                    })
                });
                if (response.ok && isMounted) {
                    const res = await response.json();
                    if (res.code > 0 && res.data) {
                        handleFontsUpdate(res.data.fontSet || res.data.FontSet || "");
                    }
                }
            } catch (error: unknown) {
                console.error("Failed to fetch font config:", error);
            }
        };
        fetchConfig();

        return () => {
            isMounted = false;
        };
    }, []);

    const fetchNote = useCallback(() => {
        const pathname = window.location.pathname;
        const search = window.location.search.substring(1); // Remove leading '?'
        let id: string | null = null;
        let token: string | null = null;

        // 优先从路径段解析: /share.html/id/token 或 /share/id/token
        const pathParts = pathname.split('/').filter(Boolean);
        // 查找 share.html 或 share 在路径中的位置
        const shareIdx = pathParts.findIndex(p => p.toLowerCase().includes('share.html') || p.toLowerCase() === 'share');
        
        if (shareIdx !== -1 && pathParts.length >= shareIdx + 3) {
            id = pathParts[shareIdx + 1];
            token = pathParts[shareIdx + 2];
        } else if (search.includes('/')) {
            // 兼容旧模式: ?id/token
            const parts = search.split('/');
            id = parts[0];
            token = parts[1];
        } else {
            // 兼容标准查询参数: ?id=xx&token=yy
            const params = new URLSearchParams(window.location.search);
            id = params.get("id");
            token = params.get("Share-Token") || params.get("token");
        }

        if (!id || !token) {
            setError(t("ui.share.invalidLink"));
            setLoading(false);
            return;
        }

        setShareId(id);
        setShareToken(token);

        // 首次尝试：从全局统一存储读取，但仅回填属于当前 ID 的密码
        if (!password) {
            const savedPwd = localStorage.getItem("share-common-password");
            const savedId = localStorage.getItem("share-common-password-id");
            if (savedPwd && savedId === id) {
                setPassword(savedPwd);
                return; // 状态变更将触发下一次 fetchNote 调用
            }
        }

        setLoading(true);
        handleGetShareNote(id, token, password, (data: NoteDetail) => {
            setNote(data);
            setIsPasswordRequired(false);
            setError(null);
            setLoading(false);
            // 验证通过，保存当前有效的密码及其 ID
            if (password) {
                localStorage.setItem("share-common-password", password);
                localStorage.setItem("share-common-password-id", id);
            }
        }, (code, message) => {
            setErrorCode(code);
            if (code === 483) {
                // 需要密码：直接弹出输入界面
                setIsPasswordRequired(true);
                setError(null);
            } else if (code === 484) {
                // 密码错误：显示专门的错误界面，由重试按钮再次触发输入框
                setIsPasswordRequired(false);
                setError(message);
                // 密码失效或错误，针对全局键进行清理
                localStorage.removeItem("share-common-password");
                localStorage.removeItem("share-common-password-id");
            } else {
                setError(message);
            }
            setLoading(false);
        });
    }, [handleGetShareNote, t, password]);

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPassword(inputPassword);
    };

    useEffect(() => {
        fetchNote();
    }, [fetchNote]);

    // 动态更新页面标题
    useEffect(() => {
        if (note) {
            const title = note.path.split('/').pop()?.replace('.md', '') || 'Note';
            document.title = `${title} - Fast Note Sync`;
        }
    }, [note]);

    // 图标动态自适应系统主题
    useEffect(() => {
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const updateFavicon = (isDark: boolean) => {
            const iconPath = isDark ? '/static/images/icon.svg' : '/static/images/icon-black.svg';
            const selectors = [
                "link[rel='icon']",
                "link[rel='shortcut icon']",
                "link[rel='apple-touch-icon']",
                "link[rel='apple-touch-icon-precomposed']"
            ];

            selectors.forEach(selector => {
                const links = document.querySelectorAll(selector);
                links.forEach(link => {
                    const newLink = link.cloneNode(true) as HTMLLinkElement;
                    newLink.href = iconPath;
                    link.parentNode?.replaceChild(newLink, link);
                });
            });
        };

        // 初始设置
        updateFavicon(darkModeMediaQuery.matches);

        // 监听系统主题切换
        const handleChange = (e: MediaQueryListEvent) => updateFavicon(e.matches);
        
        try {
            darkModeMediaQuery.addEventListener('change', handleChange);
        } catch (_e) {
            darkModeMediaQuery.addListener(handleChange);
        }

        return () => {
            try {
                darkModeMediaQuery.removeEventListener('change', handleChange);
            } catch (_e) {
                darkModeMediaQuery.removeListener(handleChange);
            }
        };
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse">{t("ui.common.loading")}</p>
                </div>
            </div>
        );
    }

    if (error || (!isPasswordRequired && !note)) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
                <div className="max-w-md text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <Share2 className="h-8 w-8 text-destructive" />
                    </div>
                    <h1 className="mb-2 text-2xl font-bold">{t("ui.share.errorTitle")}</h1>
                    <p className="text-muted-foreground">{error || t("ui.share.noteNotFound")}</p>
                    <Button
                        className="mt-6 rounded-xl"
                        variant="outline"
                        onClick={() => {
                            if (errorCode === 483 || errorCode === 484) {
                                setIsPasswordRequired(true);
                                setError(null);
                                setErrorCode(null);
                            } else {
                                window.location.reload();
                            }
                        }}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {t("ui.common.retry")}
                    </Button>
                </div>
            </div>
        );
    }

    if (isPasswordRequired && !note) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
                {colorScheme === 'default' && <AnimatedBackground />}
                <div className="z-10 w-full max-w-sm">
                    <div className="relative rounded-3xl border bg-card p-8 shadow-xl backdrop-blur-sm">
                        <div className="absolute top-4 right-4">
                            <LanguageSwitcher storageKey="share-lang" />
                        </div>
                        <div className="mb-6 text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Lock className="h-8 w-8" />
                            </div>
                            <h1 className="text-2xl font-bold">{t("ui.share.passwordRequired", "Password Required")}</h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {t("ui.share.passwordHint", "This note is password protected. Please enter the password to view it.")}
                            </p>
                        </div>
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Input
                                    type="password"
                                    placeholder={t("ui.share.passwordPlaceholder", "Enter password...")}
                                    value={inputPassword}
                                    onChange={(e) => setInputPassword(e.target.value)}
                                    className="h-12 rounded-xl text-center text-lg tracking-widest focus-visible:ring-primary"
                                    autoFocus
                                />
                            </div>
                            <Button type="submit" className="h-12 w-full rounded-xl text-lg font-semibold shadow-lg shadow-primary/20">
                                {t("ui.common.confirm")}
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    if (!note) return null;

    return (
        <div className="min-h-screen bg-background relative overflow-x-hidden">
            {/* Background Animation for default Scheme */}
            {colorScheme === 'default' && (
                <AnimatedBackground />
            )}

            <div className="relative z-10 flex flex-col min-h-screen">
                {/* 顶栏 */}
                <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-20 px-4 py-3 sm:px-6">
                    <div className={cn("mx-auto flex items-center justify-between gap-4 transition-all duration-300", isFullWidth ? "max-w-none" : "max-w-5xl")}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="truncate text-lg font-bold sm:text-xl">{note.path.split('/').pop()?.replace('.md', '')}</h1>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(note.mtime), "yyyy-MM-dd HH:mm")}
                                    </span>
                                    <span className="hidden sm:inline-flex items-center gap-1">
                                        {t("ui.share.version")} v{note.version}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                            {/* Desktop only buttons */}
                            <div className="hidden sm:flex items-center gap-1 sm:gap-2">
                                <Tooltip content={isFullWidth ? t("ui.common.narrowMode") : t("ui.common.wideMode")}>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn("size-9 rounded-xl transition-colors", isFullWidth && "bg-primary/10 text-primary")}
                                        onClick={() => setIsFullWidth(!isFullWidth)}
                                    >
                                        <MoveHorizontal className="size-5" />
                                    </Button>
                                </Tooltip>

                                <Tooltip content={t("ui.common.refresh")}>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-9 rounded-xl"
                                        onClick={fetchNote}
                                        disabled={loading}
                                    >
                                        <RefreshCw className={cn("size-5", loading && "animate-spin")} />
                                    </Button>
                                </Tooltip>

                                <Tooltip content={t("ui.settings.colorScheme")}>
                                    <div><ColorSchemeSwitcher className="rounded-xl" isShare={true} /></div>
                                </Tooltip>
                                <Tooltip content={t("ui.common.switchLanguage")}>
                                    <div><LanguageSwitcher className="size-9 rounded-xl" storageKey="share-lang" /></div>
                                </Tooltip>
                            </div>

                            {/* Theme toggle - Always visible as it's common */}
                            <Tooltip content={t(
                                theme === "auto" ? "ui.settings.themeAuto"
                                : theme === "system" ? "ui.settings.themeSystem"
                                : resolvedTheme === "dark" ? "ui.settings.themeDark"
                                : "ui.settings.themeLight"
                            )}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-9 rounded-xl"
                                    onClick={handleThemeToggle}
                                >
                                    {theme === "auto" ? (
                                        <SunMoon className="size-5 text-primary" />
                                    ) : resolvedTheme === "dark" ? (
                                        <Moon className="size-5" />
                                    ) : (
                                        <Sun className="size-5" />
                                    )}
                                </Button>
                            </Tooltip>

                            {/* Mobile only "More" menu */}
                            <div className="flex sm:hidden">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="size-9 rounded-xl">
                                            <MoreVertical className="size-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                        <DropdownMenuItem onClick={fetchNote} className="rounded-lg cursor-pointer">
                                            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                                            {t("ui.common.refresh")}
                                        </DropdownMenuItem>
                                        
                                        <DropdownMenuSeparator />
                                        
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger className="rounded-lg cursor-pointer">
                                                <Palette className="mr-2 h-4 w-4" />
                                                {t("ui.settings.colorScheme")}
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent className="rounded-xl w-48">
                                                <DropdownMenuRadioGroup 
                                                    value={colorScheme}
                                                    onValueChange={(value) => {
                                                        const store = useShareSettingsStore.getState();
                                                         store.setColorScheme(value as ColorScheme);
                                                        const scheme = COLOR_SCHEMES.find(s => s.value === value);
                                                        if (scheme) toast.success(t("ui.settings.colorSchemeSwitched", { scheme: t(scheme.label) }));
                                                    }}
                                                >
                                                    {COLOR_SCHEMES.map((scheme) => (
                                                        <DropdownMenuRadioItem key={scheme.value} value={scheme.value} className="rounded-lg cursor-pointer">
                                                            <span className="mr-2 flex h-2 w-2 rounded-full" style={{ backgroundColor: scheme.color }} />
                                                            {t(scheme.label)}
                                                        </DropdownMenuRadioItem>
                                                    ))}
                                                </DropdownMenuRadioGroup>
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>

                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger className="rounded-lg cursor-pointer">
                                                <Languages className="mr-2 h-4 w-4" />
                                                {t("ui.common.switchLanguage")}
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent className="rounded-xl">
                                                <DropdownMenuItem onClick={() => changeLang("en", "share-lang")}>🇺🇸 English</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => changeLang("zh-CN", "share-lang")}>🇨🇳 简体中文</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => changeLang("zh-TW", "share-lang")}>🇭🇰 繁體中文</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => changeLang("ja", "share-lang")}>🇯🇵 日本語</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => changeLang("ko", "share-lang")}>🇰🇷 한국어</DropdownMenuItem>
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                </header>

                {/* 内容区域 */}
                <main className="flex-1 overflow-visible p-4 sm:p-6 lg:p-8">
                    <div className={cn("mx-auto rounded-2xl border bg-card shadow-sm transition-all duration-300", isFullWidth ? "max-w-none" : "max-w-5xl")}>
                        <MarkdownEditor
                            value={note.content}
                            readOnly={true}
                            initialMode="preview"
                            vault="" // Shared note doesn't need vault context for simple display
                            fileLinks={note.fileLinks}
                            fullWidth={isFullWidth}
                            autoHeight={true}
                            shareId={shareId || ""}
                            shareToken={shareToken || ""}
                            password={password}
                        />
                    </div>
                </main>

                {/* 页脚 */}
                <footer className="border-t bg-muted/30 py-6 px-4 text-center">
                    <div className="mx-auto max-w-5xl">
                        <p className="text-sm text-muted-foreground flex items-center justify-center">
                            <span>{t("ui.share.poweredByPrefix")}</span>
                            <a href="https://github.com/haierkeys/fast-note-sync-service" target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline mx-1">
                                Fast Note Sync
                            </a>
                            <span>{t("ui.share.poweredBySuffix")}</span>
                        </p>
                    </div>
                </footer>
            </div>
        </div>
    );
}
