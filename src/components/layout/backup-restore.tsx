import { BackupImportPanel } from "@/components/layout/backup-import-panel";
import { UploadCloud, History, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";


/**
 * 备份恢复页面
 *
 * 左右等宽分栏（1:1）：
 * - 左栏「执行导入」：复用 BackupImportPanel（与旧版导入弹窗同一套逻辑）
 * - 右栏「导入历史记录」：后端暂未提供导入历史表，当前渲染空状态占位
 *
 * 入口已统一到本页，原「备份与同步」页面的「导入备份」按钮已移除。
 */
export function BackupRestore() {
    const { t } = useTranslation();

    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    /** 刷新导入历史：后端接口就绪前为空操作，仅展示加载态 */
    const refreshHistory = useCallback(() => {
        setIsHistoryLoading(true);
        window.setTimeout(() => setIsHistoryLoading(false), 300);
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-24 md:pb-4 items-start">
            {/* 左侧栏 - 执行导入 */}
            <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-border bg-card p-6 custom-shadow">
                    <div className="flex items-start justify-between gap-3 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <UploadCloud className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{t("ui.backup.restore.title")}</h2>
                                <p className="text-xs text-muted-foreground">{t("ui.backup.restore.desc")}</p>
                            </div>
                        </div>
                    </div>

                    <BackupImportPanel onImported={refreshHistory} />
                </div>
            </div>

            {/* 右侧栏 - 导入历史记录 */}
            <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-border bg-card p-6 custom-shadow">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                                <History className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{t("ui.backup.import.history.title")}</h2>
                                <p className="text-xs text-muted-foreground">{t("ui.backup.import.history.desc")}</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={refreshHistory}
                            disabled={isHistoryLoading}
                            className="rounded-xl h-10 w-10 text-muted-foreground hover:text-primary"
                            title={t("ui.common.refresh")}
                        >
                            <RefreshCw className={cn("h-4 w-4", isHistoryLoading && "animate-spin")} />
                        </Button>
                    </div>

                    {/* 空状态：后端暂未提供导入历史表 */}
                    <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/20 px-6 text-center">
                        <History className="h-12 w-12 mb-3 opacity-10" />
                        <p className="text-sm font-medium opacity-60">{t("ui.backup.import.history.noData")}</p>
                        <p className="text-xs opacity-50 mt-1">{t("ui.backup.import.history.noDataDesc")}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
