 export type BackupType = "full" | "incremental" | "sync";
export type CronStrategy = "daily" | "weekly" | "monthly" | "custom";

export interface BackupConfig {
    id?: number;
    uid?: number;
    vault: string;
    type: BackupType;
    cronStrategy: CronStrategy;
    cronExpression?: string;
    storageIds: string; // JSON array string, e.g., "[1, 2]"
    isEnabled: boolean;
    includeVaultName?: boolean;
    passwordMode: number;
    passwordValue?: string;
    retentionDays?: number;
    lastRunTime?: string;
    nextRunTime?: string;
    lastStatus?: number;
    lastMessage?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface BackupHistory {
    id: number;
    configId: number;
    uid: number;
    storageId: number;
    type: BackupType;
    status: number;
    message?: string;
    filePath?: string;
    password?: string;
    fileSize?: number;
    fileCount?: number;
    startTime: string;
    endTime?: string;
    createdAt: string;
    updatedAt: string;
}

export interface BackupConfigRequest {
    id?: number;
    vault: string;
    type: BackupType;
    cronStrategy: CronStrategy;
    cronExpression?: string;
    storageIds: string;
    isEnabled: boolean;
    includeVaultName?: boolean;
    passwordMode: number;
    passwordValue?: string;
    retentionDays?: number;
}

export interface BackupExecuteRequest {
    id: number;
}

export interface BackupImportRequest {
    vault: string;
    password?: string;
    includeNotes: boolean;
    includeVaultConfig: boolean;
    includeNoteHistory: boolean;
}

export interface BackupImportResult {
    notes: number;
    files: number;
    settings: number;
    noteHistory: number;
    skippedHistory?: number;
    vault: string;
}

export interface BackupImportAvailability {
    notes: boolean;
    vaultConfig: boolean;
    noteHistory: boolean;
}

export interface BackupImportValidateInfo {
    available: BackupImportAvailability;
    missing: string[];
}

export type BackupImportPhase = "validating" | "await_partial" | "importing" | "success" | "failed" | "cancelled";

export interface BackupImportTask {
    taskId: string;
    phase: BackupImportPhase;
}

export interface BackupImportTotals {
    notes: number;
    files: number;
    settings: number;
    noteHistory: number;
}

export interface BackupImportProgress {
    notes: number;
    files: number;
    settings: number;
    noteHistory: number;
    skippedHistory: number;
}

export interface BackupImportTaskError {
    code: number;
    message: string;
}

export interface BackupImportTaskStatus {
    taskId: string;
    phase: BackupImportPhase;
    totals: BackupImportTotals;
    progress: BackupImportProgress;
    available?: BackupImportAvailability;
    missing?: string[];
    result?: BackupImportResult;
    error?: BackupImportTaskError;
}

/** 导入历史记录状态：0 进行中 / 1 成功 / 2 失败 / 3 已取消 / 4 已中断 */
export type BackupImportHistoryStatus = 0 | 1 | 2 | 3 | 4;

export interface BackupImportHistory {
    id: number;
    uid: number;
    taskId: string;
    vaultName: string;
    fileName: string;
    fileSize: number;
    status: BackupImportHistoryStatus;
    startTime: string;
    endTime?: string;
    durationMs: number;
    includeNotes: boolean;
    includeVaultConfig: boolean;
    includeNoteHistory: boolean;
    allowPartial: boolean;
    notesCount: number;
    filesCount: number;
    settingsCount: number;
    noteHistoryCount: number;
    skippedHistoryCount: number;
    message?: string;
    createdAt: string;
    updatedAt: string;
}
