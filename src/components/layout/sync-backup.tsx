import { Plus, Pencil, Trash2, Check, Cloud, HardDrive, Share2, Server, DatabaseBackup, Play, ShieldCheck, Clock, RefreshCw, History as HistoryIcon, CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { BackupHistoryDialog } from "@/components/layout/backup-history-dialog";
import { useConfirmDialog } from "@/components/context/confirm-dialog-context";
import { useStorageHandle } from "@/components/api-handle/storage-handle";
import { useBackupHandle } from "@/components/api-handle/backup-handle";
import { StorageConfig, StorageTypeValue } from "@/lib/types/storage";
import { StorageForm } from "@/components/layout/storage-form";
import { BackupForm } from "@/components/layout/backup-form";
import { mapError } from "@/lib/utils/error-mapper";
import { BackupConfig } from "@/lib/types/backup";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";


/**
 * 同步与备份组件
 * 左侧: 备份管理
 * 右侧: 云存储配置管理
 */
export function SyncBackup() {
    const { t } = useTranslation()
    const { openConfirmDialog } = useConfirmDialog()

    // 存储管理状态
    const [storageConfigs, setStorageConfigs] = useState<StorageConfig[]>([])
    const [editingStorageId, setEditingStorageId] = useState<string | null>(null)
    const [isAddingStorage, setIsAddingStorage] = useState(false)
    const [storageTypes, setStorageTypes] = useState<string[]>(StorageTypeValue)

    // 备份管理状态
    const [backupConfigs, setBackupConfigs] = useState<BackupConfig[]>([])
    const [editingBackupId, setEditingBackupId] = useState<number | null>(null)
    const [isAddingBackup, setIsAddingBackup] = useState(false)
    const [historyConfigId, setHistoryConfigId] = useState<number | null>(null)
    const [historyConfigType, setHistoryConfigType] = useState<string | undefined>(undefined)
    const [isShowHistory, setIsShowHistory] = useState(false)

    const { handleStorageList, handleStorageDelete, handleStorageTypes } = useStorageHandle()
    const { handleBackupConfigList, handleBackupConfigDelete, handleBackupExecute } = useBackupHandle()

    useEffect(() => {
        reloadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const reloadAll = async () => {
        handleStorageTypes(setStorageTypes)
        handleStorageList(setStorageConfigs)
        handleBackupConfigList(setBackupConfigs)
    }

    // 存储操作
    const handleAddStorage = async () => {
        await reloadAll()
        setIsAddingStorage(false)
    }

    const handleEditStorage = (id: string | null) => {
        setEditingStorageId(null)
        setTimeout(() => setEditingStorageId(id), 0)
    }

    const handleDeleteStorage = async (id: string) => {
        openConfirmDialog(t("ui.storage.confirmDelete"), "confirm", async () => {
            await handleStorageDelete(id)
            await reloadAll()
        })
    }

    // 备份操作
    const handleAddBackup = async () => {
        await reloadAll()
        setIsAddingBackup(false)
    }

    const handleEditBackup = (id: number | null) => {
        setEditingBackupId(null)
        setTimeout(() => setEditingBackupId(id), 0)
    }

    const handleDeleteBackup = async (id: number) => {
        openConfirmDialog(t("ui.backup.confirmDelete"), "confirm", async () => {
            await handleBackupConfigDelete(id)
            await reloadAll()
        })
    }

    const handleExecuteBackup = async (id: number) => {
        await handleBackupExecute(id)
        setTimeout(() => handleBackupConfigList(setBackupConfigs), 1000)
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-24 md:pb-4 items-start">
            {/* 左侧 Box - 备份任务管理 */}
            <div className="rounded-xl border border-border bg-card p-6 custom-shadow">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">{t("ui.backup.management")}</h2>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={reloadAll}
                                className="rounded-xl shrink-0 h-10 w-10 text-muted-foreground hover:text-primary"
                                title={t("ui.common.refresh")}
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button onClick={() => setIsAddingBackup(true)} className="rounded-xl shrink-0">
                                <Plus className="h-4 w-4 mr-2" />
                                {t("ui.common.add")}
                            </Button>
                        </div>
                    </div>

                    {isAddingBackup && (
                        <div className="p-4 md:p-5 border border-primary/10 rounded-xl bg-primary/5 custom-shadow-sm mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center mb-4">
                                <div className="h-6 w-1 bg-primary rounded-full mr-3" />
                                <h3 className="text-base font-bold text-foreground">{t("ui.backup.add")}</h3>
                            </div>
                            <BackupForm storages={storageConfigs} onSubmit={handleAddBackup} onCancel={() => setIsAddingBackup(false)} />
                        </div>
                    )}

                    {editingBackupId !== null && (
                        <div className="p-4 md:p-5 border border-primary/10 rounded-xl bg-primary/5 custom-shadow-sm mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center mb-4">
                                <div className="h-6 w-1 bg-primary rounded-full mr-3" />
                                <h3 className="text-base font-bold text-foreground">{t("ui.backup.edit")}</h3>
                            </div>
                            <BackupForm
                                storages={storageConfigs}
                                config={backupConfigs.find((c) => c.id === editingBackupId)}
                                onSubmit={async () => {
                                    await reloadAll()
                                    setEditingBackupId(null)
                                }}
                                onCancel={() => setEditingBackupId(null)}
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        {backupConfigs && backupConfigs.length > 0 ? (
                            backupConfigs.map((config) => (
                                <div
                                    key={config.id}
                                    className={cn(
                                        "group relative flex flex-col p-3 transition-all duration-200 hover:shadow-sm border rounded-lg bg-background hover:bg-accent/50",
                                        config.isEnabled
                                            ? "border-l-4 border-l-blue-600 dark:border-l-blue-500 shadow-sm"
                                            : "border-l-4 border-l-muted border-y-border border-r-border"
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className={cn("h-4 w-4", config.isEnabled ? "text-blue-500" : "text-muted-foreground")} />
                                            <span className="text-sm tabular-nums text-muted-foreground font-mono font-bold">#{config.id}</span>
                                            <span className="font-bold text-sm">{config.vault}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 bg-accent rounded text-accent-foreground uppercase">
                                                {t(`ui.backup.backupType.${config.type}`)}
                                            </span>
                                            {config.type === "full" && (
                                                <span
                                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded cursor-help"
                                                    title={t("ui.backup.fullHistoryHint")}
                                                >
                                                    <HistoryIcon className="h-2.5 w-2.5" />
                                                    {t("ui.backup.fullBadge")}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-primary rounded-md"
                                                onClick={() => {
                                                    setHistoryConfigId(config.id!)
                                                    setHistoryConfigType(config.type)
                                                    setIsShowHistory(true)
                                                }}
                                                title={t("ui.backup.history.title")}
                                            >
                                                <HistoryIcon className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-blue-600 rounded-md"
                                                onClick={() => handleExecuteBackup(config.id!)}
                                                title={t("ui.backup.executeNow")}
                                            >
                                                <Play className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-primary rounded-md"
                                                onClick={() => handleEditBackup(config.id!)}
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-md"
                                                onClick={() => handleDeleteBackup(config.id!)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-y-1 text-[11px] text-muted-foreground">

                                        <div className="mt-1 pt-1 border-t border-border/50 opacity-70 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                {config.lastRunTime ? (
                                                    <span>{t("ui.backup.lastRunTime")}: {config.lastRunTime}</span>
                                                ) : (
                                                    <span>{t("ui.backup.noBackup")}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 min-w-[3.5rem] justify-end">
                                                {config.lastStatus === 1 ? (
                                                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                                ) : config.lastStatus === 2 ? (
                                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                                ) : config.lastStatus === 3 ? (
                                                    <AlertCircle className="h-3 w-3 text-destructive" />
                                                ) : config.lastStatus === 4 ? (
                                                    <XCircle className="h-3 w-3 text-muted-foreground" />
                                                ) : config.lastStatus === 5 ? (
                                                    <CheckCircle2 className="h-3 w-3 text-blue-400" />
                                                ) : (
                                                    <Clock className="h-3 w-3 opacity-50" />
                                                )}
                                                <span className={cn(
                                                    "font-medium",
                                                    config.lastStatus === 2 ? "text-green-500" :
                                                        config.lastStatus === 3 ? "text-destructive" :
                                                            config.lastStatus === 5 ? "text-blue-400 dark:text-blue-300" : ""
                                                )}>
                                                    {config.lastStatus !== undefined ? t(`ui.backup.status.${config.lastStatus}`) : t("ui.common.unknown")}
                                                </span>
                                            </div>
                                        </div>
                                        {config.lastStatus === 3 && config.lastMessage && (() => {
                                            const errorKey = mapError(config.lastMessage);
                                            return (
                                                <div className="text-[10px] text-destructive/80 truncate" title={config.lastMessage}>
                                                    {errorKey ? t(errorKey) : config.lastMessage}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/20 mt-4">
                                <DatabaseBackup className="h-12 w-12 mb-3 opacity-20" />
                                <p className="text-sm opacity-70 font-medium">{t("ui.backup.noBackup")}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 右侧 Box - 云存储配置管理 */}
            <div className="rounded-xl border border-border bg-card p-6 custom-shadow">
                <div className="space-y-4">
                    {/* 标题和新增按钮 */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">{t("ui.storage.management")}</h2>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={reloadAll}
                                className="rounded-xl shrink-0 h-10 w-10 text-muted-foreground hover:text-primary"
                                title={t("ui.common.refresh")}
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button onClick={() => setIsAddingStorage(true)} className="rounded-xl shrink-0">
                                <Plus className="h-4 w-4 mr-2" />
                                {t("ui.common.add")}
                            </Button>
                        </div>
                    </div>

                    {/* 新增表单 */}
                    {isAddingStorage && (
                        <div className="p-4 md:p-5 border border-primary/10 rounded-xl bg-primary/5 custom-shadow-sm mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center mb-4">
                                <div className="h-6 w-1 bg-primary rounded-full mr-3" />
                                <h3 className="text-base font-bold text-foreground">{t("ui.storage.add")}</h3>
                            </div>
                            <StorageForm types={storageTypes} onSubmit={handleAddStorage} onCancel={() => setIsAddingStorage(false)} />
                        </div>
                    )}

                    {/* 编辑表单 */}
                    {editingStorageId && (
                        <div className="p-4 md:p-5 border border-primary/10 rounded-xl bg-primary/5 custom-shadow-sm mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center mb-4">
                                <div className="h-6 w-1 bg-primary rounded-full mr-3" />
                                <h3 className="text-base font-bold text-foreground">{t("ui.storage.edit")}</h3>
                            </div>
                            <StorageForm
                                types={storageTypes}
                                config={storageConfigs.find((c) => c.id === editingStorageId)}
                                onSubmit={async () => {
                                    await reloadAll()
                                    setEditingStorageId(null)
                                }}
                                onCancel={() => setEditingStorageId(null)}
                            />
                        </div>
                    )}

                    {/* 配置列表 - 极致长条布局 */}
                    <div className="flex flex-col gap-2">
                        {storageConfigs && storageConfigs.length > 0 ? (
                            storageConfigs.map((config) => {
                                const Icon = config.type === "localfs" ? HardDrive : config.type === "webdav" ? Server : Cloud;
                                return (
                                    <div
                                        key={config.id}
                                        className={cn(
                                            "group relative flex items-center p-2 px-3 transition-all duration-200 hover:shadow-sm border rounded-lg bg-background hover:bg-accent/50",
                                            config.isEnabled
                                                ? "border-l-4 border-l-green-600 dark:border-l-green-500 shadow-sm"
                                                : "border-l-4 border-l-muted border-y-border border-r-border"
                                        )}
                                    >
                                        <div className={cn(
                                            "flex items-center justify-center w-8 h-8 rounded-md mr-3 shrink-0 transition-colors",
                                            config.isEnabled
                                                ? "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                                                : "bg-muted text-muted-foreground"
                                        )}>
                                            <Icon className="h-4.5 w-4.5" />
                                        </div>

                                        <div className="flex items-center flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg tabular-nums text-muted-foreground font-mono font-bold">#{config.id}</span>
                                                    <span className="text-sm font-semibold truncate min-w-20 text-foreground">
                                                        {t(`ui.storage.storageType.${config.type}`)}
                                                    </span>
                                                </div>
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                                                    config.isEnabled
                                                        ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
                                                        : "bg-muted text-muted-foreground"
                                                )}>
                                                    {config.isEnabled ? <Check className="h-2.5 w-2.5" /> : null}
                                                    {config.isEnabled ? t("ui.common.isEnabled") : t("ui.common.isDisabled")}
                                                </span>
                                            </div>

                                            {config.accessUrlPrefix && (
                                                <div className="hidden lg:flex items-center ml-6 text-xs text-muted-foreground truncate max-w-75 shrink overflow-hidden">
                                                    <Share2 className="h-3 w-3 mr-1 opacity-50" />
                                                    <span className="truncate opacity-70 hover:opacity-100 transition-opacity" title={config.accessUrlPrefix}>
                                                        {config.accessUrlPrefix}
                                                    </span>
                                                </div>
                                            )}
                                        </div>


                                        <div className="flex items-center pl-2 ml-2 border-l border-border space-x-0.5">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-all"
                                                onClick={() => handleEditStorage(config.id as string)}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                                                onClick={() => handleDeleteStorage(config.id as string)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/20 mt-4">
                                <DatabaseBackup className="h-12 w-12 mb-3 opacity-20" />
                                <p className="text-sm opacity-70 font-medium">{t("ui.storage.noStorage")}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {historyConfigId && (
                <BackupHistoryDialog
                    configId={historyConfigId}
                    configType={historyConfigType as import("@/lib/types/backup").BackupType}
                    open={isShowHistory}
                    onOpenChange={setIsShowHistory}
                />
            )}
        </div>
    )
}
