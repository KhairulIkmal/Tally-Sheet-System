"use client";

import { normalizeDate } from "@/lib/tally/dates";
import type { DraftHeader, HeaderErrors } from "@/lib/tally/draft";
import type { SheetForm } from "@/lib/tally/constants";
import { BottomBar, Button, FieldLabel, Scroll, TextField } from "../ui";

const FIELDS: Record<SheetForm, { key: keyof DraftHeader; label: string; hint?: string; numeric?: boolean }[]> = {
  container: [
    { key: "contractNo", label: "Contract No" },
    { key: "containerNo", label: "Container No", hint: "4 letters + 7 digits" },
    { key: "sealNo", label: "Seal No" },
    { key: "siNo", label: "SI No" },
    { key: "disport", label: "Disport" },
    { key: "date", label: "Date", hint: "Today", numeric: true },
  ],
  lorry: [
    { key: "transferTo", label: "Transfer To" },
    { key: "doNo", label: "D/O No" },
    { key: "lorryNo", label: "Lorry No", hint: "Number plate" },
    { key: "date", label: "Date", hint: "Today", numeric: true },
  ],
};

export function HeaderFormScreen({
  form,
  header,
  errors,
  transferSuggestions,
  onChange,
  onNext,
}: {
  form: SheetForm;
  header: DraftHeader;
  errors: HeaderErrors;
  transferSuggestions: string[];
  onChange: (key: keyof DraftHeader, value: string) => void;
  onNext: () => void;
}) {
  const errorCount = Object.values(errors).filter(Boolean).length;
  return (
    <>
      {errorCount > 0 ? (
        <div role="alert" className="flex-none border-b border-danger-border bg-danger-bg px-4 py-3 text-[15px] font-bold text-danger-ink">
          {errorCount} field{errorCount === 1 ? "" : "s"} need{errorCount === 1 ? "s" : ""} fixing
        </div>
      ) : null}
      <Scroll className="gap-3.5 p-4">
        {FIELDS[form].map((f) => {
          const error = errors[f.key];
          const id = `hdr-${f.key}`;
          return (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label htmlFor={id}>
                <FieldLabel hint={f.hint} invalid={!!error}>
                  {f.label}
                </FieldLabel>
              </label>
              <TextField
                id={id}
                value={header[f.key]}
                invalid={!!error}
                upper
                inputMode={f.numeric ? "numeric" : "text"}
                placeholder={f.key === "date" ? "141026" : ""}
                onChange={(e) => onChange(f.key, f.key === "date" ? e.target.value : e.target.value.toUpperCase())}
                onBlur={f.key === "date" ? (e) => onChange("date", normalizeDate(e.target.value)) : undefined}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-err` : undefined}
              />
              {error ? (
                <span id={`${id}-err`} className="text-sm font-semibold text-danger">
                  {error}
                </span>
              ) : null}
              {f.key === "transferTo" && transferSuggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {transferSuggestions.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => onChange("transferTo", s)}
                      className="flex h-10 items-center rounded-full border border-field bg-surface px-3 text-sm font-semibold"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </Scroll>
      <BottomBar>
        <Button className="w-full" onClick={onNext}>
          Next · Add item
        </Button>
      </BottomBar>
    </>
  );
}
