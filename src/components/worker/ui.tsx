"use client";

import { forwardRef } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SheetForm } from "@/lib/tally/constants";

export function FormBadge({ form, size = "md" }: { form: SheetForm; size?: "sm" | "md" }) {
  const isContainer = form === "container";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md font-bold tracking-[.05em]",
        size === "sm" ? "h-[22px] px-[7px] text-[11px]" : "h-6 px-2 text-xs",
        isContainer ? "bg-container-bg text-container" : "bg-lorry-bg text-lorry",
      )}
    >
      <span
        className={cn(
          size === "sm" ? "size-[7px]" : "size-2",
          isContainer ? "rounded-[1px] bg-container-mark" : "rounded-full bg-lorry-mark",
        )}
      />
      {isContainer ? "CONTAINER" : "LORRY"}
    </span>
  );
}

export function TopBar({
  title,
  subtitle,
  onBack,
  form,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  form?: SheetForm | null;
  /** E.g. the step-by-step / paper switch. */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-[60px] flex-none items-center gap-1 bg-surface px-2">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Back" className="grid size-12 place-items-center rounded-[10px] active:bg-chip">
          <ArrowLeft className="size-6" />
        </button>
      ) : (
        <span className="w-2" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-bold">{title}</div>
        {subtitle ? <div className="truncate text-[13px] font-medium text-muted">{subtitle}</div> : null}
      </div>
      {action}
      {form ? (
        <span className="mr-2">
          <FormBadge form={form} />
        </span>
      ) : null}
    </div>
  );
}

export const STEPS = ["Header", "Item", "Pallet", "Materials", "Check", "Review", "Sign"] as const;

/**
 * The step bar. With onStep, the steps the worker can reach are buttons, so
 * they can jump straight to the part they want to fix.
 */
export function Progress({ step, canJump, onStep }: { step: number; canJump?: (i: number) => boolean; onStep?: (i: number) => void }) {
  return (
    <nav
      className="grid flex-none grid-cols-7 gap-1 border-b border-line bg-surface px-3 pt-1 pb-1.5"
      aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
    >
      {STEPS.map((label, i) => {
        const inner = (
          <>
            <div className={cn("h-1 rounded-sm", i <= step ? "bg-primary" : "bg-field")} />
            <div className={cn("truncate text-[11px]", i === step ? "font-bold text-ink" : "font-medium text-faint")}>{label}</div>
          </>
        );
        const jumpable = !!onStep && i !== step && (canJump?.(i) ?? true);
        return jumpable ? (
          <button
            key={label}
            type="button"
            onClick={() => onStep(i)}
            aria-label={`Go to ${label}`}
            className="-mx-0.5 flex flex-col gap-[5px] rounded-md px-0.5 pb-1 text-left hover:bg-primary-soft [&>div:last-child]:text-primary"
          >
            {inner}
          </button>
        ) : (
          <div key={label} className="flex flex-col gap-[5px] pb-1" aria-current={i === step ? "step" : undefined}>
            {inner}
          </div>
        );
      })}
    </nav>
  );
}

export function BottomBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex-none border-t border-line bg-surface px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]", className)}>
      {children}
    </div>
  );
}

export function Scroll({ children, className }: { children: React.ReactNode; className?: string }) {
  // Children keep their height (no flex shrink), so long content scrolls instead of being squeezed and clipped.
  return <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto *:shrink-0", className)}>{children}</div>;
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "soft" | "dashed" | "danger";
  size?: "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl font-bold transition-[opacity,background-color] select-none disabled:cursor-not-allowed disabled:opacity-40",
        size === "lg" ? "h-[60px] text-[19px]" : "h-14 text-lg",
        variant === "primary" && "bg-primary text-white hover:bg-primary-hover dark:text-[#0e1115]",
        variant === "secondary" && "border-[1.5px] border-field bg-surface text-ink",
        variant === "soft" && "bg-primary-soft text-primary",
        variant === "dashed" && "border-2 border-dashed border-primary text-primary",
        variant === "danger" && "border-[1.5px] border-danger-border text-danger",
        className,
      )}
      {...rest}
    />
  );
});

export const TextField = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; upper?: boolean; big?: boolean }
>(function TextField({ invalid, upper, big, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      autoComplete="off"
      className={cn(
        "w-full rounded-[10px] bg-surface px-3.5 text-ink outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-ring",
        big ? "h-16 text-3xl font-bold" : "h-14 text-[19px] font-semibold",
        invalid ? "border-2 border-danger" : "border-[1.5px] border-field",
        upper && "uppercase",
        className,
      )}
      {...rest}
    />
  );
});

export function FieldLabel({ children, hint, invalid }: { children: React.ReactNode; hint?: string; invalid?: boolean }) {
  return (
    <div className={cn("flex justify-between text-sm font-bold", invalid ? "text-danger" : "text-body")}>
      <span>{children}</span>
      {hint ? <span className="font-medium text-faint">{hint}</span> : null}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[13px] font-bold tracking-[.06em] text-muted uppercase", className)}>{children}</div>;
}

export function PalletBadge({ no, size = "md" }: { no: number; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "flex flex-none items-center justify-center rounded-[7px] bg-solid font-condensed font-extrabold text-on-solid",
        size === "lg" && "size-[60px] rounded-[10px] text-[40px]",
        size === "md" && "h-[34px] w-[52px] text-[22px]",
        size === "sm" && "h-7 min-w-7 px-1.5 text-[15px]",
      )}
    >
      {no}
    </span>
  );
}

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute right-4 bottom-[100px] left-4 z-20 rounded-xl bg-[#15181d] px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,.3)]"
    >
      {message}
    </div>
  );
}
