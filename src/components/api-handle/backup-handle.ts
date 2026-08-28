import { BackupConfig, BackupHistory, BackupConfigRequest, BackupImportTask, BackupImportTaskStatus } from "@/lib/types/backup";
import { useConfirmDialog } from "@/components/context/confirm-dialog-context";
import { addCacheBuster } from "@/lib/utils/cache-buster";
import { buildApiHeaders } from "@/lib/utils/api-headers";
import { toast } from "@/components/common/Toast";
import { useTranslation } from "react-i18next";
import { useCallback, useMemo } from "react";
import env from "@/env.ts";


/**
 * 备份管理 API 处理钩子
 */
export function useBackupHandle() {
    const { t } = useTranslation()
    const { openConfirmDialog } = useConfirmDialog()
    const token = localStorage.getItem("token")!

    /**
     * 获取备份配置列表
     */
    const handleBackupConfigList = useCallback(async (callback: (list: BackupConfig[]) => void) => {
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/backup/configs"), {
                method: "GET",
                headers: buildApiHeaders({ token }),
            })

            if (!response.ok) {
                throw new Error("Network response was not ok")
            }

            const res = await response.json()
            if (res.code < 100 && res.code > 0) {
                callback(res.data || [])
            } else {
                openConfirmDialog(res.message + ": " + res.details, "error")
            }
        } catch (error) {
            openConfirmDialog(t("api.backup.configList.error") + ": " + error, "error")
        }
    }, [token, openConfirmDialog, t])

    /**
     * 删除备份配置
     */
    const handleBackupConfigDelete = useCallback(async (id: number) => {
        try {
            const response = await fetch(addCacheBuster(env.API_URL + `/api/backup/config?id=${id}`), {
                method: "DELETE",
                headers: buildApiHeaders({ token, includeContentType: false }),
            })

            if (!response.ok) {
                throw new Error("Network response was not ok")
            }

            const res = await response.json()
            if (res.code < 100 && res.code > 0) {
                toast.success(res.message || t("api.backup.delete.success"))
            } else {
                openConfirmDialog(res.message + ": " + res.details, "error")
            }
        } catch (error) {
            openConfirmDialog(t("api.backup.delete.error") + ": " + error, "error")
        }
    }, [token, openConfirmDialog, t])

    /**
     * 新增或更新备份配置
     */
    const handleBackupConfigUpdate = useCallback(async (data: BackupConfigRequest, callback: (data: BackupConfig) => void) => {
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/backup/config"), {
                method: "POST",
                body: JSON.stringify(data),
                headers: buildApiHeaders({ token }),
            })

            if (!response.ok) {
                throw new Error("Network response was not ok")
            }

            const res = await response.json()
            if (res.code < 100 && res.code > 0) {
                toast.success(res.message || t("api.backup.save.success"))
                callback(res.data)
            } else {
                openConfirmDialog(res.message + ": " + res.details, "error")
            }
        } catch (error) {
            openConfirmDialog(t("api.backup.save.error") + ": " + error, "error")
        }
    }, [token, openConfirmDialog, t])

    /**
     * 手动触发备份执行
     */
    const handleBackupExecute = useCallback(async (id: number) => {
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/backup/execute"), {
                method: "POST",
                body: JSON.stringify({ id }),
                headers: buildApiHeaders({ token }),
            })

            if (!response.ok) {
                throw new Error("Network response was not ok")
            }

            const res = await response.json()
            if (res.code < 100 && res.code > 0) {
                toast.success(res.message || t("api.backup.execute.success"))
            } else {
                openConfirmDialog(res.message + ": " + res.details, "error")
            }
        } catch (error) {
            openConfirmDialog(t("api.backup.execute.error") + ": " + error, "error")
        }
    }, [token, openConfirmDialog, t])

    /**
     * 提交导入备份任务（异步；同步快检失败以错误码返回）
     */
    const handleBackupImportSubmit = useCallback(async (formData: FormData, callback: (data: BackupImportTask) => void) => {
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/backup/import"), {
                method: "POST",
                body: formData,
                headers: buildApiHeaders({ token, includeContentType: false }),
            })

            if (!response.ok) {
                throw new Error("Network response was not ok")
            }

            const res = await response.json()
            if (res.code < 100 && res.code > 0) {
                if (res.data) {
                    callback(res.data)
                }
            } else {
                openConfirmDialog(`${res.message}${res.details ? `\n${res.details}` : ""}`, "error")
            }
        } catch (error) {
            openConfirmDialog(t("api.backup.import.error") + ": " + error, "error")
        }
    }, [token, openConfirmDialog, t])

    /**
     * 查询导入任务状态
     */
    const handleBackupImportStatus = useCallback(async (taskId: string, callback: (data: BackupImportTaskStatus) => void) => {
        try {
            const url = env.API_URL + `/api/backup/import/status?taskId=${encodeURIComponent(taskId)}`;
            const response = await fetch(addCacheBuster(url), {
                method: "GET",
                headers: buildApiHeaders({ token }),
            })

            if (!response.ok) {
                throw new Error("Network response was not ok")
            }

            const res = await response.json()
            if (res.code < 100 && res.code > 0) {
                if (res.data) {
                    callback(res.data)
                }
            } else {
                openConfirmDialog(res.message + ": " + (res.details || ""), "error")
            }
        } catch (error) {
            openConfirmDialog(t("api.backup.import.taskError") + ": " + error, "error")
        }
    }, [token, openConfirmDialog, t])

    /**
     * 确认/取消 await_partial 导入任务
     */
    const handleBackupImportConfirm = useCallback(async (taskId: string, allowPartial: boolean, callback?: (data: BackupImportTaskStatus) => void) => {
        try {
            const response = await fetch(addCacheBuster(env.API_URL + "/api/backup/import/confirm"), {
                method: "POST",
                body: JSON.stringify({ taskId, allowPartial }),
                headers: buildApiHeaders({ token }),
            })

            if (!response.ok) {
                throw new Error("Network response was not ok")
            }

            const res = await response.json()
            if (res.code < 100 && res.code > 0) {
                if (callback && res.data) {
                    callback(res.data)
                }
            } else {
                openConfirmDialog(res.message + ": " + (res.details || ""), "error")
            }
        } catch (error) {
            openConfirmDialog(t("api.backup.import.taskError") + ": " + error, "error")
        }
    }, [token, openConfirmDialog, t])

    /**
     * 获取备份历史记录
     */
    const handleBackupHistory = useCallback(async (page: number, pageSize: number, configId: number, callback?: (data: { list: BackupHistory[], total: number }) => void) => {
        try {
            const url = env.API_URL + `/api/backup/historys?page=${page}&pageSize=${pageSize}&configId=${configId}`;

            const response = await fetch(addCacheBuster(url), {
                method: "GET",
                headers: buildApiHeaders({ token }),
            })

            if (!response.ok) {
                throw new Error("Network response was not ok")
            }

            const res = await response.json()
            if (res.code < 100 && res.code > 0) {
                if (callback) {
                    // 兼容处理：文档显示返回 Array，但也可能返回 ListRes
                    if (res.data && Array.isArray(res.data)) {
                        // 如果没有返回 total，则标记为 -1，由 UI 处理分页逻辑
                        callback({ list: res.data, total: res.total ?? -1 })
                    } else if (res.data && res.data.list) {
                        const total = res.data.pager?.totalRows ?? res.data.total ?? 0;
                        callback({ list: res.data.list, total })
                    } else {
                        callback({ list: [], total: 0 })
                    }
                }
            } else {
                openConfirmDialog(res.message + ": " + res.details, "error")
            }
        } catch (error) {
            openConfirmDialog(t("api.backup.history.error") + ": " + error, "error")
        }
    }, [token, openConfirmDialog, t])

    return useMemo(() => ({
        handleBackupConfigList,
        handleBackupConfigDelete,
        handleBackupConfigUpdate,
        handleBackupExecute,
        handleBackupHistory,
        handleBackupImportSubmit,
        handleBackupImportStatus,
        handleBackupImportConfirm,
    }), [
        handleBackupConfigList,
        handleBackupConfigDelete,
        handleBackupConfigUpdate,
        handleBackupExecute,
        handleBackupHistory,
        handleBackupImportSubmit,
        handleBackupImportStatus,
        handleBackupImportConfirm,
    ])
}
