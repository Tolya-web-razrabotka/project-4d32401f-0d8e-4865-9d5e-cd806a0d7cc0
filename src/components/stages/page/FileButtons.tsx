import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Loader2, Upload } from "lucide-react";
import { useProfile } from "@/lib/profile";
import { showError } from "@/lib/format";
import { formatDateTime } from "@/lib/dates";
import { FILE_KIND_LABEL, formatSize, openFile, uploadFile, type FileEntity, type FileKind, type FileRow } from "@/lib/files";
import { Button } from "@/components/ui/button";

/** Кнопка загрузки файла (несколько файлов за раз; на iPad открывает камеру/галерею/файлы). */
export function UploadButton({
  objectId,
  entityType,
  entityId,
  kind,
  label,
  onUploaded,
  variant = "outline",
  className = "h-12 text-lg",
}: {
  objectId: string;
  entityType: FileEntity;
  entityId: string;
  kind: FileKind;
  label: string;
  onUploaded: () => void;
  variant?: "outline" | "default" | "secondary";
  className?: string;
}) {
  const { id: profileId } = useProfile();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const m = useMutation({
    mutationFn: async (files: File[]) => {
      setBusy(true);
      for (const file of files) {
        if (file.size > 50 * 1024 * 1024) throw new Error(`Файл «${file.name}» больше 50 МБ`);
        await uploadFile({ objectId, entityType, entityId, kind, file, profileId });
      }
      return files.length;
    },
    onSuccess: (n) => {
      toast.success(n > 1 ? `Загружено файлов: ${n}` : "Файл загружен");
      onUploaded();
    },
    onError: showError,
    onSettled: () => {
      setBusy(false);
      if (input.current) input.current.value = "";
    },
  });
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) m.mutate(files);
        }}
      />
      <Button type="button" variant={variant} disabled={busy} onClick={() => input.current?.click()} className={className}>
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />} {label}
      </Button>
    </>
  );
}

export function FileList({ files, showKind }: { files: FileRow[]; showKind?: boolean }) {
  if (files.length === 0) return null;
  return (
    <ul className="divide-y rounded-lg border">
      {files.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
          <button
            type="button"
            onClick={() => openFile(f.storage_path).catch(showError)}
            className="inline-flex min-w-0 flex-1 items-center gap-2 text-left text-base font-medium text-primary hover:underline"
          >
            <FileText className="size-5 shrink-0" />
            <span className="truncate">{f.file_name}</span>
          </button>
          {showKind && <span className="text-sm font-medium">{FILE_KIND_LABEL[f.kind]}</span>}
          <span className="text-sm text-muted-foreground">
            {f.uploader?.full_name ?? ""} · {formatDateTime(f.created_at)}
            {f.size_bytes ? ` · ${formatSize(f.size_bytes)}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
