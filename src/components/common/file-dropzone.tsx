import { FileText, UploadCloud, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
    value?: File | null;
    onChange: (file: File | null) => void;
    /** 允许的扩展名，逗号分隔，如 ".zip" 或 ".yaml,.yml,.txt" */
    accept?: string;
    /** 未选中时的提示文案 */
    placeholder?: string;
    /** 扩展名不与 accept 匹配时回调（供外层 toast 提示） */
    onInvalid?: (file: File) => void;
    className?: string;
}

function formatFileSize(bytes: number): string {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 卡片式文件上传框：虚线边框，支持点击与拖拽，选中后高亮显示文件名与大小
 */
export function FileDropzone({ value, onChange, accept, placeholder, onInvalid, className }: FileDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const acceptedExtensions = useCallback((): string[] => {
        if (!accept) return [];
        return accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    }, [accept]);

    const isValidFile = useCallback((file: File): boolean => {
        const exts = acceptedExtensions();
        if (exts.length === 0) return true;
        const lower = file.name.toLowerCase();
        return exts.some((ext) => lower.endsWith(ext));
    }, [acceptedExtensions]);

    const acceptFile = (file: File | undefined | null) => {
        if (!file) return;
        if (!isValidFile(file)) {
            onInvalid?.(file);
            return;
        }
        onChange(file);
    };

    const clearFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    return (
        <div
            className={cn(
                "rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer select-none",
                value
                    ? "border-primary/50 bg-primary/5 hover:border-primary/70"
                    : isDragging
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/30",
                className
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped && !isValidFile(dropped)) {
                    onInvalid?.(dropped);
                    return;
                }
                acceptFile(dropped);
            }}
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => acceptFile(e.target.files?.[0])}
            />

            {value ? (
                <div className="flex items-center gap-3 p-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{value.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(value.size)}</p>
                    </div>
                    <button
                        type="button"
                        onClick={clearFile}
                        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="清除"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-6 px-4">
                    <UploadCloud className={cn("h-8 w-8 transition-colors", isDragging ? "text-primary" : "text-muted-foreground/60")} />
                    <p className="text-sm text-muted-foreground text-center">{placeholder}</p>
                </div>
            )}
        </div>
    );
}
