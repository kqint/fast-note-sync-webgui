import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountdownConfirmDialog } from "@/components/common/countdown-confirm-dialog";
import { FileDropzone } from "@/components/common/file-dropzone";
import { useBackupHandle } from "@/components/api-handle/backup-handle";
import { useVaultHandle } from "@/components/api-handle/vault-handle";
import {
    BackupImportResult,
    BackupImportTask,
    BackupImportTaskStatus,
} from "@/lib/types/backup";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { VaultType } from "@/lib/types/vault";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/common/Toast";
import {
    AlertTriangle,
    FileUp,
    History as HistoryIcon,
    Loader2,
    RotateCcw,
    Settings2,
    ShieldCheck,
    UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface BackupImportPanelProps {
    /** 导入成功后的回调，供父级刷新导入历史等 */
    onImported?: (result: BackupImportResult) => void;
    /** 额外的 CSS 类名 */
    className?: string;
}

const POLL_INTERVAL_MS = 1000;

/** 将备份包"已有部分"布尔集合转为部分键列表（notes/vaultConfig/noteHistory） */
function availableSectionNames(available?: BackupImportTaskStatus["available"]): string[] {
    if (!available) return [];
    const keys: string[] = [];
    if (available.notes) keys.push("notes");
    if (available.vaultConfig) keys.push("vaultConfig");
    if (available.noteHistory) keys.push("noteHistory");
    return keys;
}

/**
 * 备份包导入面板（异步任务）
 *
 * 从原 BackupImportDialog 抽取而来，去掉 Dialog 外壳以便在页面内直接内联使用。
 * 提交后按 phase 轮询：validating（校验动画）→ importing（进度条）
 * → await_partial（弹窗确认部分导入/取消）→ success（结果）/ failed / cancelled
 * 覆盖策略：同名内容全部被备份包覆盖
 *
 * 注意：轮询只存活于组件挂载期间；离开页面会停止轮询，但后端任务不受影响继续执行。
 */
export function BackupImportPanel({ onImported, className }: BackupImportPanelProps) {
    const { t } = useTranslation();
    const { handleBackupImportSubmit, handleBackupImportStatus, handleBackupImportConfirm } = useBackupHandle();
    const { handleVaultList } = useVaultHandle();

    const [vaults, setVaults] = useState<VaultType[]>([]);
    const [vault, setVault] = useState<string>("");
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState("");
    const [includeNotes, setIncludeNotes] = useState(true);
    const [includeVaultConfig, setIncludeVaultConfig] = useState(false);
    const [includeNoteHistory, setIncludeNoteHistory] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showPartialConfirm, setShowPartialConfirm] = useState(false);
    const [result, setResult] = useState<BackupImportResult | null>(null);
    const [status, setStatus] = useState<BackupImportTaskStatus | null>(null);
    const taskIdRef = useRef<string | null>(null);
    // 轮询定时器，组件卸载/重置时必须清理，避免任务结束后仍在请求
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // await_partial 的决策幂等守卫：同一个任务只接受一次确认/取消。
    // 没有它，重复点击会向已离开 await_partial 的任务发第二次 confirm，撞上 549。
    const partialDecidedRef = useRef(false);

    /** 清理轮询定时器 */
    const stopPolling = useCallback(() => {
        if (pollTimerRef.current !== null) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }, []);

    // 卸载时停止轮询（后端任务不受影响，继续执行）
    useEffect(() => stopPolling, [stopPolling]);

    useEffect(() => {
        handleVaultList((list) => {
            setVaults(list);
            setVault((prev) => prev || list[0]?.vault || "");
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resetState = useCallback(() => {
        stopPolling();
        taskIdRef.current = null;
        partialDecidedRef.current = false;
        setFile(null);
        setPassword("");
        setIncludeNotes(true);
        setIncludeVaultConfig(false);
        setIncludeNoteHistory(false);
        setIsSubmitting(false);
        setShowConfirm(false);
        setShowPartialConfirm(false);
        setResult(null);
        setStatus(null);
    }, [stopPolling]);

    // 选项有效性：勾选笔记历史必须同时勾选笔记和附件（服务端同样校验）
    const optionsValid = includeNoteHistory ? includeNotes : true;
    // 至少勾选一项导入内容才允许确认
    const hasAnyOption = includeNotes || includeVaultConfig || includeNoteHistory;
    const canSubmit = Boolean(vault && file && optionsValid && hasAnyOption && !isSubmitting && !status);

    const phase = status?.phase;

    /** 前端 ZIP 魔数校验：读前 4 字节 */
    const checkZipMagic = async (f: File): Promise<boolean> => {
        try {
            const buf = await f.slice(0, 4).arrayBuffer();
            const b = new Uint8Array(buf);
            const isZip = b.length === 4 && b[0] === 0x50 && b[1] === 0x4b &&
                ((b[2] === 0x03 && b[3] === 0x04) || (b[2] === 0x05 && b[3] === 0x06) || (b[2] === 0x07 && b[3] === 0x08));
            if (!isZip) {
                toast.error(t("ui.backup.import.notZip"));
                return false;
            }
            return true;
        } catch {
            toast.error(t("ui.backup.import.notZip"));
            return false;
        }
    };

    const onFileChange = async (f: File | null) => {
        if (f && !(await checkZipMagic(f))) return;
        setFile(f);
    };

    const buildFormData = (flags: { notes: boolean; vaultConfig: boolean; history: boolean }): FormData => {
        const formData = new FormData();
        formData.append("file", file!);
        formData.append("vault", vault);
        formData.append("password", password);
        formData.append("includeNotes", String(flags.notes));
        formData.append("includeVaultConfig", String(flags.vaultConfig));
        formData.append("includeNoteHistory", String(flags.history));
        return formData;
    };

    const applyStatus = useCallback((st: BackupImportTaskStatus) => {
        setStatus(st);
        // 弹窗开关必须与阶段对称：只要不在（或已离开）await_partial 就关掉。
        // 原实现只在 await_partial 时置 true、离开时从不置 false，于是任何一条
        // 陈旧的 await_partial 响应都会把用户刚回答过的弹窗重新拉起且永不自动关闭。
        if (st.phase === "await_partial" && !partialDecidedRef.current) {
            setShowPartialConfirm(true);
            // 任务正在等用户决策，继续轮询没有意义（持续 15 分钟也会白白请求）；
            // 确认请求返回后会恢复轮询。
            stopPolling();
        } else {
            setShowPartialConfirm(false);
        }
        if (st.phase === "success") {
            setResult(st.result ?? null);
        } else if (st.phase === "failed") {
            setResult(null);
        }
    }, [stopPolling]);

    /**
     * 轮询任务状态，直到终态停止。
     * 离开页面只停止轮询，后台任务继续执行。
     */
    const startPolling = useCallback((taskId: string) => {
        // 只有提交新任务时才重置 await_partial 的决策守卫。
        // 确认部分导入后也会调用本函数恢复轮询；若这里每次都重置，确认请求
        // 返回的旧 await_partial 快照会再次打开弹窗，而后端实际上已按第一次选择推进任务。
        const isNewTask = taskIdRef.current !== taskId;
        taskIdRef.current = taskId;
        if (isNewTask) {
            partialDecidedRef.current = false;
        }
        // 同一组件内只允许存在一个轮询，重复启动前先清理
        stopPolling();
        const pollOnce = () => {
            if (taskIdRef.current !== taskId) return; // 组件重置后停止
            handleBackupImportStatus(taskId, (st) => {
                applyStatus(st);
                if (st.phase === "success" || st.phase === "failed" || st.phase === "cancelled") {
                    taskIdRef.current = null;
                    stopPolling();
                    if (st.phase === "cancelled") {
                        toast.success(t("ui.backup.import.cancelled"));
                    }
                    if (st.phase === "success" && st.result) {
                        onImported?.(st.result);
                    }
                }
            });
        };
        pollOnce();
        pollTimerRef.current = setInterval(() => {
            if (taskIdRef.current !== taskId) {
                stopPolling();
                return;
            }
            pollOnce();
        }, POLL_INTERVAL_MS);
    }, [handleBackupImportStatus, t, onImported, stopPolling, applyStatus]);

    const doImport = async () => {
        if (!file || !vault) return;
        setIsSubmitting(true);
        setShowConfirm(false);
        const flags = {
            notes: includeNotes,
            vaultConfig: includeVaultConfig,
            history: includeNotes && includeNoteHistory,
        };
        await handleBackupImportSubmit(buildFormData(flags), (task: BackupImportTask) => {
            startPolling(task.taskId);
        });
        setIsSubmitting(false);
    };

    /** await_partial：确认继续（仅导入已有部分）或取消本次导入 */
    const confirmPartial = async (allowPartial: boolean) => {
        const taskId = taskIdRef.current;
        // 幂等：同一个任务只接受一次决策。重复点击直接忽略，否则第二次请求
        // 会打在已离开 await_partial 的任务上，收到「任务不存在或状态不支持」。
        if (!taskId || partialDecidedRef.current) return;
        partialDecidedRef.current = true;
        setShowPartialConfirm(false);
        await handleBackupImportConfirm(taskId, allowPartial, (st) => {
            applyStatus(st);
            if (st.phase === "cancelled") {
                taskIdRef.current = null;
                stopPolling();
                if (!allowPartial) {
                    toast.success(t("ui.backup.import.cancelled"));
                }
            }
        });
        // 确认请求无论成败，只要任务还没进入终态就恢复轮询——
        // applyStatus 已在 await_partial 处暂停过轮询，不恢复任务就再没人跟进。
        if (taskIdRef.current === taskId) {
            startPolling(taskId);
        }
    };

    const progressRow = (labelKey: string, done: number, total: number) => (
        <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t(labelKey)}</span>
            <span className="font-mono text-foreground">{done} / {total}</span>
        </div>
    );

    return (
        <div className={cn("space-y-4", className)}>
            {/* 结果视图 */}
            {result ? (
                <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 space-y-2">
                        <div className="flex items-center gap-2 font-semibold text-green-600 dark:text-green-400">
                            <ShieldCheck className="h-4 w-4" />
                            {t("ui.backup.import.result.title")}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <div>{t("ui.backup.import.result.vault")}: <span className="font-medium text-foreground">{result.vault}</span></div>
                            <div>{t("ui.backup.import.result.notes")}: <span className="font-mono font-medium text-foreground">{result.notes}</span></div>
                            <div>{t("ui.backup.import.result.files")}: <span className="font-mono font-medium text-foreground">{result.files}</span></div>
                            <div>{t("ui.backup.import.result.settings")}: <span className="font-mono font-medium text-foreground">{result.settings}</span></div>
                            <div>{t("ui.backup.import.result.history")}: <span className="font-mono font-medium text-foreground">{result.noteHistory}</span></div>
                            {Boolean(result.skippedHistory) && (
                                <div>{t("ui.backup.import.result.skippedHistory")}: <span className="font-mono font-medium text-foreground">{result.skippedHistory}</span></div>
                            )}
                        </div>
                    </div>
                    <Button variant="outline" onClick={resetState} className="w-full rounded-xl">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {t("ui.backup.import.again")}
                    </Button>
                </div>
            ) : status && (phase === "validating" || phase === "importing" || phase === "await_partial") ? (
                /* 校验/等待确认/导入进度视图
                   await_partial 必须落在这里：它同样属于「任务进行中」，若掉进最后的
                   else 分支会瞬间闪回导入表单，用户以为导入失败或没提交成功。 */
                <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-4">
                        <div className="flex items-center gap-2 font-semibold text-primary">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {phase === "validating"
                                ? t("ui.backup.import.phase.validating")
                                : phase === "await_partial"
                                    ? t("ui.backup.import.phase.awaitPartial")
                                    : t("ui.backup.import.phase.importing")}
                        </div>

                        {phase === "importing" && (
                            <div className="space-y-1.5">
                                {progressRow("ui.backup.import.result.notes", status.progress.notes, status.totals.notes)}
                                {progressRow("ui.backup.import.result.files", status.progress.files, status.totals.files)}
                                {progressRow("ui.backup.import.result.settings", status.progress.settings, status.totals.settings)}
                                {progressRow("ui.backup.import.result.history", status.progress.noteHistory, status.totals.noteHistory)}
                            </div>
                        )}

                        <p className="text-xs text-muted-foreground">{t("ui.backup.import.progressTip")}</p>
                    </div>
                </div>
            ) : status && phase === "failed" ? (
                /* 失败视图 */
                <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 space-y-2">
                        <div className="flex items-center gap-2 font-semibold text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                            {t("ui.backup.import.failed")}
                        </div>
                        {status.error?.message && (
                            <p className="text-xs text-destructive/80 break-all">{status.error.message}</p>
                        )}
                    </div>
                    <Button variant="outline" onClick={resetState} className="w-full rounded-xl">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {t("ui.backup.import.retry")}
                    </Button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* 危险操作强提醒 */}
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-destructive/40 bg-destructive/10">
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-semibold text-destructive">{t("ui.backup.import.warning.title")}</p>
                            <p className="text-xs text-destructive/80 mt-1">{t("ui.backup.import.warning.desc")}</p>
                        </div>
                    </div>

                    {/* 目标笔记库 */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.backup.import.vault")}</Label>
                        <Select value={vault} onValueChange={setVault}>
                            <SelectTrigger className="rounded-xl w-full">
                                <SelectValue placeholder={t("ui.backup.import.selectVault")} />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-64 overflow-y-auto">
                                {vaults.map((v) => (
                                    <SelectItem value={v.vault} key={v.id}>{v.vault}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 备份包文件 */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.backup.import.file")}</Label>
                        <FileDropzone
                            value={file}
                            onChange={onFileChange}
                            accept=".zip"
                            placeholder={t("ui.backup.import.dropzone.placeholder")}
                            onInvalid={() => toast.error(t("ui.backup.import.notZip"))}
                        />
                    </div>

                    {/* 解压密码 */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground ml-1">
                            {t("ui.backup.passwordValue")} ({t("ui.common.optional")})
                        </Label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t("ui.backup.passwordValue.placeholder")}
                            className="rounded-xl"
                        />
                    </div>

                    {/* 导入范围 */}
                    <div className="space-y-2.5 p-4 rounded-xl border border-border bg-muted/20">
                        <p className="text-xs font-semibold text-muted-foreground">{t("ui.backup.import.scope")}</p>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <Checkbox
                                checked={includeNotes}
                                onCheckedChange={(v) => {
                                    const checked = Boolean(v);
                                    setIncludeNotes(checked);
                                    // 取消笔记和附件时联动取消笔记历史
                                    if (!checked) {
                                        setIncludeNoteHistory(false);
                                    }
                                }}
                            />
                            <FileUp className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{t("ui.backup.import.option.notes")}</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <Checkbox checked={includeVaultConfig} onCheckedChange={(v) => setIncludeVaultConfig(Boolean(v))} />
                            <Settings2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                                {t("ui.backup.import.option.vaultConfig")}{" "}
                                (<code className="font-mono text-xs bg-muted text-foreground px-1.5 py-0.5 rounded">.obsidian</code>)
                            </span>
                        </label>
                        <label className={cn("flex items-center gap-3", includeNotes ? "cursor-pointer" : "cursor-not-allowed opacity-50")}>
                            <Checkbox
                                checked={includeNoteHistory}
                                disabled={!includeNotes}
                                onCheckedChange={(v) => setIncludeNoteHistory(Boolean(v))}
                            />
                            <HistoryIcon className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                                <span className="text-sm">
                                    {t("ui.backup.import.option.noteHistory")}{" "}
                                    (<code className="font-mono text-xs bg-muted text-foreground px-1.5 py-0.5 rounded">.fns/note_history.json</code>)
                                </span>
                                {!includeNotes && (
                                    <span className="text-[11px] text-muted-foreground">{t("ui.backup.import.option.noteHistoryDepends")}</span>
                                )}
                            </div>
                        </label>
                    </div>

                    {!optionsValid && (
                        <p className="text-xs text-destructive">{t("ui.backup.import.option.noteHistoryDepends")}</p>
                    )}
                    {!hasAnyOption && (
                        <p className="text-xs text-destructive">{t("ui.backup.import.optionRequired")}</p>
                    )}

                    {/* 导入按钮：点击后弹出 3 秒倒计时确认小窗 */}
                    <Button
                        variant="destructive"
                        disabled={!canSubmit}
                        onClick={() => setShowConfirm(true)}
                        className="w-full rounded-xl"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.auth.submitting")}</>
                        ) : (
                            <><UploadCloud className="h-4 w-4 mr-2" />{t("ui.backup.import.start")}</>
                        )}
                    </Button>
                    {!file && (
                        <p className="text-[11px] text-center text-muted-foreground">{t("ui.backup.import.selectFileFirst")}</p>
                    )}
                </div>
            )}

            {/* 3 秒倒计时确认小窗 */}
            <CountdownConfirmDialog
                open={showConfirm}
                onOpenChange={setShowConfirm}
                title={t("ui.backup.import.confirm.title")}
                description={t("ui.backup.import.confirm.desc")}
                confirmLabel={t("ui.backup.import.confirm.button")}
                seconds={3}
                loading={isSubmitting}
                onConfirm={() => void doImport()}
            />

            {/* 零信任校验：await_partial —— 已有/缺少提示，可选导入已有部分或取消本次导入 */}
            <CountdownConfirmDialog
                open={showPartialConfirm}
                onOpenChange={() => {
                    setShowPartialConfirm(false);
                    // 用户关闭弹窗视同取消本次导入。但只在任务确实还在 await_partial
                    // 时才发取消请求，否则会对已推进的任务误报「任务不存在或状态不支持」。
                    if (taskIdRef.current && status?.phase === "await_partial") {
                        void confirmPartial(false);
                    }
                }}
                title={t("ui.backup.import.partial.title")}
                description={
                    status
                        ? t("ui.backup.import.partial.desc", {
                              available: availableSectionNames(status.available)
                                  .map((key) => t(`ui.backup.import.section.${key}`))
                                  .join(t("ui.backup.import.partial.joiner")),
                              missing: (status.missing ?? [])
                                  .map((key) => t(`ui.backup.import.section.${key}`))
                                  .join(t("ui.backup.import.partial.joiner")),
                          })
                        : ""
                }
                confirmLabel={t("ui.backup.import.partial.confirm")}
                cancelLabel={t("ui.backup.import.partial.cancel")}
                seconds={3}
                onConfirm={() => void confirmPartial(true)}
            />
        </div>
    );
}
