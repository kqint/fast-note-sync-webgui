import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BackupImportPanel } from "@/components/layout/backup-import-panel";
import { BackupImportResult } from "@/lib/types/backup";
import { useTranslation } from "react-i18next";


interface BackupImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 导入成功后的回调 */
    onImported?: (result: BackupImportResult) => void;
}

/**
 * 备份包导入对话框
 *
 * 外壳组件，实际表单与轮询逻辑全部复用 BackupImportPanel。
 * 说明：Dialog 关闭时内容会卸载，轮询随之停止，但后端任务不受影响继续执行。
 */
export function BackupImportDialog({ open, onOpenChange, onImported }: BackupImportDialogProps) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg rounded-2xl">
                <DialogHeader>
                    <DialogTitle>{t("ui.backup.import.title")}</DialogTitle>
                </DialogHeader>
                <BackupImportPanel onImported={onImported} />
            </DialogContent>
        </Dialog>
    )
}
