import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBackupHandle } from "@/components/api-handle/backup-handle";
import { useVaultHandle } from "@/components/api-handle/vault-handle";
import { BackupImportResult } from "@/lib/types/backup";
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
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface BackupImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * 备份包导入对话框
 * 三个复选框：1) 笔记和附件 2) 仓库配置 3) 笔记历史（需勾选选项1）
 * 覆盖策略：同名内容全部被备份包覆盖；导入按钮带 5 秒强提醒倒计时
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
    const [confirmCountdown, setConfirmCountdown] = useState(5);
    const [result, setResult] = useState<BackupImportResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 强提醒：对话框打开后 5 秒内禁止确认导入
    useEffect(() => {
        if (!open) return;
        setConfirmCountdown(5);
        const timer = setInterval(() => {
            setConfirmCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [open]);

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
        setResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    const canSubmit = Boolean(vault && file && confirmCountdown === 0 && !isImporting);

    const onConfirmImport = async () => {
        if (!vault || !file) return;
        setIsImporting(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("vault", vault);
        formData.append("password", password);
        formData.append("includeNotes", String(includeNotes));
        formData.append("includeVaultConfig", String(includeVaultConfig));
        formData.append("includeNoteHistory", String(includeNotes && includeNoteHistory));
        await handleBackupImport(formData, (data: BackupImportResult) => {
            setResult(data);
            toast.success(t("api.backup.import.success"));
        });
        setIsImporting(false);
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
                            <Input
                                ref={fileInputRef}
                                type="file"
                                accept=".zip"
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                                className="rounded-xl"
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
                                <Checkbox checked={includeNotes} onCheckedChange={(v) => setIncludeNotes(Boolean(v))} />
                                <FileUp className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{t("ui.backup.import.option.notes")}</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <Checkbox checked={includeVaultConfig} onCheckedChange={(v) => setIncludeVaultConfig(Boolean(v))} />
                                <Settings2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{t("ui.backup.import.option.vaultConfig")}</span>
                            </label>
                            <label className={cn("flex items-center gap-3", includeNotes ? "cursor-pointer" : "cursor-not-allowed opacity-50")}>
                                <Checkbox
                                    checked={includeNoteHistory}
                                    disabled={!includeNotes}
                                    onCheckedChange={(v) => setIncludeNoteHistory(Boolean(v))}
                                />
                                <HistoryIcon className="h-4 w-4 text-muted-foreground" />
                                <div className="flex flex-col">
                                    <span className="text-sm">{t("ui.backup.import.option.noteHistory")}</span>
                                    {!includeNotes && (
                                        <span className="text-[11px] text-muted-foreground">{t("ui.backup.import.option.noteHistoryDepends")}</span>
                                    )}
                                </div>
                            </label>
                        </div>

                        {/* 导入按钮 */}
                        <div className="space-y-2 pt-1">
                            {confirmCountdown > 0 ? (
                                <Button variant="destructive" disabled className="w-full rounded-xl">
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin opacity-70" />
                                    {t("ui.backup.import.confirmIn", { seconds: confirmCountdown })}
                                </Button>
                            ) : (
                                <Button
                                    variant="destructive"
                                    disabled={!canSubmit}
                                    onClick={onConfirmImport}
                                    className="w-full rounded-xl"
                                >
                                    {isImporting ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.auth.submitting")}</>
                                    ) : (
                                        <><UploadCloud className="h-4 w-4 mr-2" />{t("ui.backup.import.confirm")}</>
                                    )}
                                </Button>
                            )}
                            {!file && (
                                <p className="text-[11px] text-center text-muted-foreground">{t("ui.backup.import.selectFileFirst")}</p>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
