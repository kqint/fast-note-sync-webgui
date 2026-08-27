import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CountdownConfirmDialog } from "@/components/common/countdown-confirm-dialog";
import { FileDropzone } from "@/components/common/file-dropzone";
import { useBackupHandle } from "@/components/api-handle/backup-handle";
import { useVaultHandle } from "@/components/api-handle/vault-handle";
import { BackupImportResult, BackupImportValidateInfo } from "@/lib/types/backup";
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
    Settings2,
    ShieldCheck,
    UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface BackupImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** 将备份包"已有部分"布尔集合转为部分键列表（notes/vaultConfig/noteHistory） */
function availableSectionNames(available: BackupImportValidateInfo["available"]): string[] {
    const keys: string[] = [];
    if (available.notes) keys.push("notes");
    if (available.vaultConfig) keys.push("vaultConfig");
    if (available.noteHistory) keys.push("noteHistory");
    return keys;
}

/**
 * 备份包导入对话框
 * 三个复选框：1) 笔记和附件 2) 仓库配置 3) 笔记历史（依赖选项1，联动取消）
 * 覆盖策略：同名内容全部被备份包覆盖
 * 零信任校验：备份包缺少所选内容时弹窗提示「已有/缺少」，可选择导入已有部分或取消本次导入
 */
export function BackupImportDialog({ open, onOpenChange }: BackupImportDialogProps) {
    const { t } = useTranslation();
    const { handleBackupImport } = useBackupHandle();
    const { handleVaultList } = useVaultHandle();

    const [vaults, setVaults] = useState<VaultType[]>([]);
    const [vault, setVault] = useState<string>("");
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState("");
    const [includeNotes, setIncludeNotes] = useState(true);
    const [includeVaultConfig, setIncludeVaultConfig] = useState(false);
    const [includeNoteHistory, setIncludeNoteHistory] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [partialInfo, setPartialInfo] = useState<BackupImportValidateInfo | null>(null);
    const [result, setResult] = useState<BackupImportResult | null>(null);

    useEffect(() => {
        if (open) {
            handleVaultList((list) => {
                setVaults(list);
                setVault((prev) => prev || list[0]?.vault || "");
            });
        } else {
            resetState();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const resetState = useCallback(() => {
        setFile(null);
        setPassword("");
        setIncludeNotes(true);
        setIncludeVaultConfig(false);
        setIncludeNoteHistory(false);
        setIsImporting(false);
        setShowConfirm(false);
        setPartialInfo(null);
        setResult(null);
    }, []);

    // 选项有效性：勾选笔记历史必须同时勾选笔记和附件（服务端同样校验）
    const optionsValid = includeNoteHistory ? includeNotes : true;
    // 至少勾选一项导入内容才允许确认
    const hasAnyOption = includeNotes || includeVaultConfig || includeNoteHistory;
    const canSubmit = Boolean(vault && file && optionsValid && hasAnyOption && !isImporting);

    const buildFormData = (flags: { notes: boolean; vaultConfig: boolean; history: boolean }, allowPartial: boolean): FormData => {
        const formData = new FormData();
        formData.append("file", file!);
        formData.append("vault", vault);
        formData.append("password", password);
        formData.append("includeNotes", String(flags.notes));
        formData.append("includeVaultConfig", String(flags.vaultConfig));
        formData.append("includeNoteHistory", String(flags.history));
        formData.append("allowPartial", String(allowPartial));
        return formData;
    };

    const doImport = async (
        allowPartial: boolean,
        flagsOverride?: { notes: boolean; vaultConfig: boolean; history: boolean },
    ) => {
        if (!file || !vault) return;
        // 笔记历史依赖笔记和附件（服务端同样校验）
        const flags = flagsOverride ?? {
            notes: includeNotes,
            vaultConfig: includeVaultConfig,
            history: includeNotes && includeNoteHistory,
        };
        setIsImporting(true);
        setShowConfirm(false);
        await handleBackupImport(buildFormData(flags, allowPartial), (data: BackupImportResult) => {
            setResult(data);
            setPartialInfo(null);
            toast.success(t("api.backup.import.success"));
        }, (data: BackupImportValidateInfo) => {
            setPartialInfo(data);
        });
        setIsImporting(false);
    };

    // 「仅导入部分」：按备份包实际存在的内容修正勾选后重新提交
    const confirmPartialImport = () => {
        if (!partialInfo) return;
        const avail = partialInfo.available;
        const nextFlags = {
            notes: includeNotes && avail.notes,
            vaultConfig: includeVaultConfig && avail.vaultConfig,
            history: includeNoteHistory && avail.notes && avail.noteHistory,
        };
        setPartialInfo(null);
        // 修正后没有任何可导入内容，放弃导入
        if (!nextFlags.notes && !nextFlags.vaultConfig && !nextFlags.history) {
            toast.error(t("ui.backup.import.partial.nothing"));
            return;
        }
        // 同步 UI 勾选状态
        setIncludeNotes(nextFlags.notes);
        setIncludeVaultConfig(nextFlags.vaultConfig);
        setIncludeNoteHistory(nextFlags.history);
        void doImport(true, nextFlags);
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !isImporting && onOpenChange(next)}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-auto p-6">
                <DialogHeader className="mb-3">
                    <DialogTitle className="flex items-center gap-2">
                        <UploadCloud className="h-5 w-5 text-primary" />
                        {t("ui.backup.import.title")}
                    </DialogTitle>
                </DialogHeader>

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
                        <Button onClick={() => onOpenChange(false)} className="w-full rounded-xl">
                            {t("ui.common.confirm")}
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
                            <Label className="text-xs font-semibold text-muted-foreground ml-1">{t("ui.backup.vault")}</Label>
                            <Select value={vault} onValueChange={setVault}>
                                <SelectTrigger className="rounded-xl w-full">
                                    <SelectValue placeholder={t("ui.backup.selectVault")} />
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
                                onChange={setFile}
                                accept=".zip"
                                placeholder={t("ui.backup.import.dropzone.placeholder")}
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
                            {isImporting ? (
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
                    loading={isImporting}
                    onConfirm={() => void doImport(false)}
                />

                {/* 零信任校验：缺少所选内容时提示已有/缺少，可选择导入已有部分或取消本次导入 */}
                <CountdownConfirmDialog
                    open={Boolean(partialInfo)}
                    onOpenChange={(next) => !next && setPartialInfo(null)}
                    title={t("ui.backup.import.partial.title")}
                    description={
                        partialInfo
                            ? t("ui.backup.import.partial.desc", {
                                  available: availableSectionNames(partialInfo.available)
                                      .map((key) => t(`ui.backup.import.section.${key}`))
                                      .join(t("ui.backup.import.partial.joiner")),
                                  missing: partialInfo.missing
                                      .map((key) => t(`ui.backup.import.section.${key}`))
                                      .join(t("ui.backup.import.partial.joiner")),
                              })
                            : ""
                    }
                    confirmLabel={t("ui.backup.import.partial.confirm")}
                    cancelLabel={t("ui.backup.import.partial.cancel")}
                    seconds={3}
                    loading={isImporting}
                    onConfirm={confirmPartialImport}
                />
            </DialogContent>
        </Dialog>
    );
}
