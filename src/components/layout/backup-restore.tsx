import { formatFileSize } from "@/lib/utils/format";
import { useBackupHandle } from "@/components/api-handle/backup-handle";
import { BackupImportHistory } from "@/lib/types/backup";
import { BackupImportPanel } from "@/components/layout/backup-import-panel";
import { Import as ImportIcon, History, RefreshCw, ChevronLeft, ChevronRight, Loader2, CheckCircle2, AlertCircle, Clock, Ban, FileArchive } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";


/** 导入历史每页条数 */
const HISTORY_PAGE_SIZE = 10;


/**
 * 备份恢复页面
 *
 * 左右等宽分栏（1:1）：
 * - 左栏「执行导入」：复用 BackupImportPanel（与旧版导入弹窗同一套逻辑）
 * - 右栏「导入历史记录」：按时间倒序展示每次导入的状态、耗时与导入统计
 *
 * 入口已统一到本页，原「备份与同步」页面的「导入备份」按钮已移除。
 */
export function BackupRestore() {
    const { t } = useTranslation();
    const { handleBackupImportHistory } = useBackupHandle();

    const [histories, setHistories] = useState<BackupImportHistory[]>([]);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyPage, setHistoryPage] = useState(1);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    const loadHistory = useCallback(async (page: number) => {
        setIsHistoryLoading(true);
        await handleBackupImportHistory(page, HISTORY_PAGE_SIZE, (data) => {
            setHistories(data.list);
            setHistoryTotal(data.total);
        });
        setIsHistoryLoading(false);
    }, [handleBackupImportHistory]);

    /** 刷新导入历史：导入完成后回到第一页重新拉取 */
    const refreshHistory = useCallback(() => {
        setHistoryPage(1);
        loadHistory(1);
    }, [loadHistory]);

    useEffect(() => {
        loadHistory(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const historyTotalPages = historyTotal > 0 ? Math.ceil(historyTotal / HISTORY_PAGE_SIZE) : 1;

    const gotoPage = (page: number) => {
        setHistoryPage(page);
        loadHistory(page);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-24 md:pb-4 items-start">
            {/* 左侧栏 - 执行导入 */}
            <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-border bg-card p-6 custom-shadow">
                    <div className="flex items-start justify-between gap-3 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <ImportIcon className="h-5 w-5 text-primary" />
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
                            onClick={() => gotoPage(1)}
                            disabled={isHistoryLoading}
                            className="rounded-xl h-10 w-10 text-muted-foreground hover:text-primary"
                            title={t("ui.common.refresh")}
                        >
                            <RefreshCw className={cn("h-4 w-4", isHistoryLoading && "animate-spin")} />
                        </Button>
                    </div>

                    {/* 历史记录列表 */}
                    <div className="flex flex-col gap-2">
                        {isHistoryLoading && histories.length === 0 ? (
                            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/20">
                                <Loader2 className="h-8 w-8 animate-spin mb-2 opacity-50" />
                                <p className="text-sm">{t("ui.common.loading")}</p>
                            </div>
                        ) : histories.length > 0 ? (
                            <>
                                <div className="space-y-1.5">
                                    {histories.map((item) => (
                                        <div
                                            key={item.id}
                                            className="px-3 py-2.5 rounded-lg border border-border/60 bg-background hover:bg-accent/30 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                {/* 状态图标 + 目标笔记库 */}
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    {renderStatusIcon(item.status)}
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-sm text-foreground/80 truncate max-w-40" title={item.vaultName}>
                                                                {item.vaultName || "-"}
                                                            </span>
                                                            <span className={cn("text-xs font-medium shrink-0", statusTextClass(item.status))}>
                                                                {t(`ui.backup.import.history.status.${item.status}`)}
                                                            </span>
                                                        </div>
                                                        {/* 备份包文件名与大小 */}
                                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                                                            <FileArchive className="h-3 w-3 shrink-0 opacity-60" />
                                                            <span className="truncate max-w-45" title={item.fileName}>{item.fileName}</span>
                                                            {item.fileSize > 0 && (
                                                                <span className="shrink-0 opacity-60">{formatFileSize(item.fileSize)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 开始时间 + 耗时 */}
                                                <div className="flex flex-col items-end shrink-0 gap-0.5">
                                                    <span className="text-xs text-muted-foreground font-mono">{item.startTime || "-"}</span>
                                                    <span className="text-xs text-primary/70 font-mono">{formatDuration(item)}</span>
                                                </div>
                                            </div>

                                            {/* 导入范围 + 统计 */}
                                            <div className="mt-1.5 flex items-center gap-x-2 gap-y-1 flex-wrap pl-6">
                                                {renderScopes(item, t)}
                                                {item.status === 1 && buildStatsText(item, t) && (
                                                    <span className="text-[11px] text-muted-foreground">{buildStatsText(item, t)}</span>
                                                )}
                                            </div>

                                            {/* 错误信息 */}
                                            {item.message && item.status !== 1 && (
                                                <p className="mt-1.5 ml-6 p-2 bg-destructive/5 text-destructive border border-destructive/10 rounded-md text-[10px] leading-relaxed break-all">
                                                    {item.message}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* 分页 */}
                                {(historyTotalPages > 1 || (historyTotal === -1 && (histories.length === HISTORY_PAGE_SIZE || historyPage > 1))) && (
                                    <div className="flex items-center justify-between mt-2 px-1">
                                        <span className="text-[10px] text-muted-foreground">
                                            {historyTotal > 0 && `${t("ui.common.total")} ${historyTotal} ${t("ui.common.items")}`}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => gotoPage(historyPage - 1)}
                                                disabled={historyPage <= 1 || isHistoryLoading}
                                            >
                                                <ChevronLeft className="h-3 w-3" />
                                            </Button>
                                            <span className="text-xs font-medium px-1">
                                                {historyTotal > 0 ? `${historyPage} / ${historyTotalPages}` : `P${historyPage}`}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => gotoPage(historyPage + 1)}
                                                disabled={(historyTotal > 0 ? historyPage >= historyTotalPages : histories.length < HISTORY_PAGE_SIZE) || isHistoryLoading}
                                            >
                                                <ChevronRight className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/20 px-6 text-center">
                                <History className="h-12 w-12 mb-3 opacity-10" />
                                <p className="text-sm font-medium opacity-60">{t("ui.backup.import.history.noData")}</p>
                                <p className="text-xs opacity-50 mt-1">{t("ui.backup.import.history.noDataDesc")}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

/** 状态图标：0 进行中 / 1 成功 / 2 失败 / 3 已取消 / 4 已中断 */
function renderStatusIcon(status: number) {
    switch (status) {
        case 0:
            return <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0" />;
        case 1:
            return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
        case 2:
            return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />;
        case 3:
            return <Ban className="h-4 w-4 text-muted-foreground shrink-0" />;
        default:
            return <Clock className="h-4 w-4 opacity-30 shrink-0" />;
    }
}

/** 状态文字配色 */
function statusTextClass(status: number): string {
    return cn(
        status === 0 && "text-orange-600 dark:text-orange-400",
        status === 1 && "text-green-600 dark:text-green-400",
        status === 2 && "text-destructive",
    );
}

/** 解析后端时间字符串（"2006-01-02 15:04:05"，按本地时区解析） */
function parseTime(value?: string): number {
    if (!value) return NaN;
    return new Date(value.replace(" ", "T")).getTime();
}

/** 格式化耗时，返回如 "3s" "1m 23s" "-" */
function formatDuration(item: BackupImportHistory): string {
    let ms = item.durationMs || 0;
    if (!ms) {
        const start = parseTime(item.startTime);
        const end = parseTime(item.endTime);
        if (!isNaN(start) && !isNaN(end) && end >= start) {
            ms = end - start;
        }
    }
    if (ms <= 0) return "-";
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** 导入范围标签 */
function renderScopes(item: BackupImportHistory, t: (key: string) => string) {
    const scopes: string[] = [];
    if (item.includeNotes) scopes.push(t("ui.backup.import.scope.notes"));
    if (item.includeVaultConfig) scopes.push(t("ui.backup.import.scope.vaultConfig"));
    if (item.includeNoteHistory) scopes.push(t("ui.backup.import.scope.noteHistory"));
    if (scopes.length === 0) return null;

    return (
        <div className="flex items-center gap-1 flex-wrap">
            {scopes.map((scope) => (
                <span key={scope} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground border border-border/50 whitespace-nowrap">
                    {scope}
                </span>
            ))}
        </div>
    );
}

/** 导入统计文本，只展示本次实际勾选导入的部分 */
function buildStatsText(item: BackupImportHistory, t: (key: string) => string): string {
    const parts: string[] = [];
    if (item.includeNotes) {
        parts.push(`${t("ui.backup.import.result.notes")} ${item.notesCount}`);
        parts.push(`${t("ui.backup.import.result.files")} ${item.filesCount}`);
    }
    if (item.includeVaultConfig) {
        parts.push(`${t("ui.backup.import.result.settings")} ${item.settingsCount}`);
    }
    if (item.includeNoteHistory) {
        parts.push(`${t("ui.backup.import.result.history")} ${item.noteHistoryCount}`);
        if (item.skippedHistoryCount > 0) {
            parts.push(`${t("ui.backup.import.result.skippedHistory")} ${item.skippedHistoryCount}`);
        }
    }
    return parts.join(" · ");
}
