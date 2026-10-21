import { cn } from "@/lib/utils";

/** Знак «Лидер»: янтарная плашка с буквой — единственное место, где янтарь крупным пятном. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md bg-signal text-[15px] font-bold leading-none text-sidebar",
        className,
      )}
    >
      Л
    </span>
  );
}
