"use client";

import { cn } from "@/lib/utils";
import type { SheetForm } from "@/lib/tally/constants";
import { BottomBar, Button, Scroll } from "../ui";

function ContainerArt() {
  return <div className="h-14 w-[104px] rounded bg-[repeating-linear-gradient(90deg,var(--color-container-mark)_0_7px,var(--color-container)_7px_10px)]" />;
}

function LorryArt() {
  return (
    <div className="relative h-[58px] w-[104px]">
      <div className="absolute top-0.5 left-0 h-10 w-[68px] rounded-[3px] bg-lorry-mark" />
      <div className="absolute top-3.5 left-[71px] h-7 w-[30px] rounded-[3px_10px_3px_3px] bg-lorry" />
      {[8, 44, 78].map((x) => (
        <div key={x} className="absolute top-9 size-[18px] rounded-full border-[3px] border-surface bg-[#15181d]" style={{ left: x }} />
      ))}
    </div>
  );
}

export function ChooseTypeScreen({
  form,
  onChoose,
  onNext,
}: {
  form: SheetForm;
  onChoose: (form: SheetForm) => void;
  onNext: () => void;
}) {
  const cards: { key: SheetForm; label: string; tag: string; body: string; art: React.ReactNode }[] = [
    {
      key: "container",
      label: "Container",
      tag: "FORM A",
      body: "Loading into an export container. Contract No, Container No, Seal No, SI No, Disport.",
      art: <ContainerArt />,
    },
    {
      key: "lorry",
      label: "Lorry",
      tag: "FORM B",
      body: "Loading onto a normal lorry. Transfer To, D/O No, Lorry No. PLT Type and Contract No per pallet.",
      art: <LorryArt />,
    },
  ];
  return (
    <>
      <Scroll className="gap-3.5 px-4 py-5">
        <div className="text-2xl/tight font-bold">Where are the goods loaded?</div>
        {cards.map((c) => {
          const selected = form === c.key;
          const isContainer = c.key === "container";
          return (
            <button
              type="button"
              key={c.key}
              onClick={() => onChoose(c.key)}
              aria-pressed={selected}
              className={cn(
                "flex flex-col gap-3 rounded-[18px] bg-surface p-5 text-left",
                selected
                  ? isContainer
                    ? "border-2 border-container-mark ring-4 ring-container-bg"
                    : "border-2 border-lorry-mark ring-4 ring-lorry-bg"
                  : "border-[1.5px] border-line",
              )}
            >
              <div className="flex w-full justify-between">
                {c.art}
                <span className={cn("text-xs font-bold tracking-[.06em]", isContainer ? "text-container" : "text-lorry")}>{c.tag}</span>
              </div>
              <div className={cn("text-[28px] font-extrabold", isContainer ? "text-container" : "text-lorry")}>{c.label}</div>
              <div className="text-[15px]/[1.4] font-medium text-body">{c.body}</div>
            </button>
          );
        })}
      </Scroll>
      <BottomBar>
        <Button className="w-full" onClick={onNext}>
          Next · {form === "container" ? "Container" : "Lorry"}
        </Button>
      </BottomBar>
    </>
  );
}
