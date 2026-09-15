import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useState, type ReactNode } from "react";

interface CountdownConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    /** 标题前的可选语义图标，例如警告、删除等。 */
    titleIcon?: ReactNode;
    /** 简短的纯文本说明，渲染为 AlertDialogDescription。 */
    description?: ReactNode;
    /** 正文下方的结构化内容，作为独立容器渲染，适用于状态卡片、列表等复杂布局。 */
    content?: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    /** 倒计时秒数，默认 3 秒 */
    seconds?: number;
    loading?: boolean;
    onConfirm: () => void;
}

/**
 * 危险操作确认小窗：打开后需等待倒计时结束才能点击确认
 */
export function CountdownConfirmDialog({
    open,
    onOpenChange,
    title,
    titleIcon,
    description,
    content,
    confirmLabel,
    cancelLabel,
    seconds = 3,
    loading = false,
    onConfirm,
}: CountdownConfirmDialogProps) {
    const { t } = useTranslation();
    const [countdown, setCountdown] = useState(seconds);

    useEffect(() => {
        if (!open) return;
        setCountdown(seconds);
        const timer = setInterval(() => {
            setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [open, seconds]);

    return (
        <AlertDialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
            <AlertDialogContent className="max-w-md rounded-2xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        {titleIcon}
                        {title}
                    </AlertDialogTitle>
                    {description && <AlertDialogDescription className="whitespace-pre-line">{description}</AlertDialogDescription>}
                </AlertDialogHeader>
                {content}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>{cancelLabel ?? t("ui.common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={countdown > 0 || loading}
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {loading ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ui.auth.submitting")}</>
                        ) : countdown > 0 ? (
                            `${confirmLabel} (${countdown}s)`
                        ) : (
                            confirmLabel
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
