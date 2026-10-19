"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import { submitSheetAction } from "@/lib/data/actions";
import { normalizeUnit, type SheetForm } from "@/lib/tally/constants";
import { formatDateTime } from "@/lib/tally/dates";
import {
  buildPallets,
  formatQty,
  itemQty,
  newDraft,
  palletRanges,
  reviewWarnings,
  splitIntoPallets,
  totals,
  validateHeader,
  vehicleNo,
  type Draft,
  type DraftHeader,
  type DraftItem,
  type HeaderErrors,
} from "@/lib/tally/draft";
import { draftToPayload } from "@/lib/tally/payload";
import { paperFromDraft, type SheetSummary } from "@/lib/tally/sheet";
import { newId } from "@/lib/tally/draft";
import { unnamedRows } from "@/lib/tally/paper-rows";
import { blankPick, type ItemSuggestion, type PickState } from "./pick";
import {
  describeDevice,
  loadDraft,
  loadMode,
  loadOutbox,
  loadRecent,
  loadRecentItems,
  remember,
  rememberItem,
  saveDraft,
  saveMode,
  saveOutbox,
  type FillMode,
  type OutboxEntry,
} from "./storage";
import { useOnline } from "./use-online";
import { Progress, Toast, TopBar } from "./ui";
import { HomeScreen } from "./screens/home";
import { ChooseTypeScreen } from "./screens/choose-type";
import { HeaderFormScreen } from "./screens/header-form";
import { ItemNameScreen } from "./screens/item-name";
import { PalletSetupScreen } from "./screens/pallet-setup";
import { PalletDetailsScreen } from "./screens/pallet-details";
import { ItemListScreen } from "./screens/item-list";
import { MaterialsScreen } from "./screens/materials";
import { ReviewScreen } from "./screens/review";
import { SignatureScreen } from "./screens/signature";
import { PreviewScreen } from "./screens/preview";
import { SuccessScreen } from "./screens/success";
import { PaperScreen } from "./screens/paper";

type Screen =
  | "home"
  | "type"
  | "header"
  | "paper"
  | "picker"
  | "setup"
  | "pallets"
  | "items"
  | "materials"
  | "review"
  | "sign"
  | "preview"
  | "success";

const STEP_OF: Partial<Record<Screen, number>> = {
  header: 0,
  picker: 1,
  setup: 1,
  pallets: 2,
  items: 2,
  materials: 3,
  review: 4,
  sign: 5,
  preview: 5,
};

export interface WorkerUser {
  id: string;
  name: string;
  department: string;
  initials: string;
  isOffice: boolean;
}

/**
 * The whole worker flow on one page. Screens switch in memory (no
 * navigation), so a sheet keeps working when the signal drops mid-count.
 * The draft is saved to the device on every change; a signed sheet goes
 * into an outbox that is sent now, or later when the phone is back online.
 */
export function WorkerApp({ user, history, sheets }: { user: WorkerUser; history: ItemSuggestion[]; sheets: SheetSummary[] }) {
  const router = useRouter();
  const online = useOnline();
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [form, setForm] = useState<SheetForm>("container");
  const [mode, setMode] = useState<FillMode>("steps");
  const [paperProblems, setPaperProblems] = useState<string[]>([]);
  const [cur, setCur] = useState(-1);
  const [pick, setPick] = useState<PickState>(blankPick());
  const [headerErrors, setHeaderErrors] = useState<HeaderErrors>({});
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [recentItems, setRecentItems] = useState<ItemSuggestion[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<string[]>([]);
  const [result, setResult] = useState<{ offline: boolean; reference: string; summary: string } | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);

  // ── device storage ──────────────────────────────────────────────────
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of device storage after mount */
    const d = loadDraft(user.id);
    setDraft(d);
    if (d) setForm(d.form);
    setMode(loadMode(user.id));
    setOutbox(loadOutbox(user.id));
    setRecentItems(loadRecentItems(user.id));
    setRecentTransfers(loadRecent(user.id, "transfer"));
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user.id]);

  useEffect(() => {
    if (!hydrated) return;
    if (!saveDraft(user.id, draft) && draft) showToast("This phone's storage is full. The draft may not be saved.");
    // showToast is stable enough for this purpose.
     
  }, [draft, hydrated, user.id]);

  useEffect(() => {
    if (hydrated) saveOutbox(user.id, outbox);
  }, [outbox, hydrated, user.id]);

  // Offline support: cache this page and its assets for a reload without signal.
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }

  /** Edits the draft. Any change after signing clears the signature: the worker signs what they see. */
  const update = useCallback((fn: (d: Draft) => void, opts?: { keepSignature?: boolean }) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      if (!opts?.keepSignature) {
        next.signature = null;
        next.signedAt = null;
      }
      next.updatedAt = new Date().toISOString();
      return next;
    });
  }, []);

  // ── outbox ──────────────────────────────────────────────────────────
  const flush = useCallback(async () => {
    if (sendingRef.current) return;
    const queue = loadOutbox(user.id);
    if (queue.length === 0) return;
    sendingRef.current = true;
    setSending(true);
    let sent = 0;
    let remaining = [...queue];
    for (const entry of queue) {
      try {
        const res = await submitSheetAction(entry.payload);
        if (res.ok) {
          sent += 1;
          remaining = remaining.filter((e) => e.clientId !== entry.clientId);
        } else if (!res.retry) {
          remaining = remaining.map((e) => (e.clientId === entry.clientId ? { ...e, state: "failed", error: res.error } : e));
        }
      } catch {
        // Network error: leave it pending for the next attempt.
      }
    }
    saveOutbox(user.id, remaining);
    setOutbox(remaining);
    sendingRef.current = false;
    setSending(false);
    if (sent > 0) {
      showToast(`${sent} sheet${sent === 1 ? "" : "s"} sent to the office`);
      router.refresh();
    }
     
  }, [router, user.id]);

  useEffect(() => {
    if (!hydrated || !online) return;
    const first = setTimeout(() => {
      if (loadOutbox(user.id).some((e) => e.state === "pending")) void flush();
    }, 0);
    const timer = setInterval(() => {
      if (navigator.onLine && loadOutbox(user.id).some((e) => e.state === "pending")) void flush();
    }, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
    // Only re-arm when connectivity or the hydration state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, hydrated]);

  // ── derived ─────────────────────────────────────────────────────────
  const items = useMemo(() => draft?.items ?? [], [draft]);
  const ranges = useMemo(() => palletRanges(items), [items]);
  const t = totals(items);
  const nextStart = t.pallets + 1;
  const sheetNo = draft ? vehicleNo(draft) || (draft.form === "container" ? "Container" : "Lorry") : "";
  const warnings = useMemo(() => (draft ? reviewWarnings(draft) : []), [draft]);

  // Shared history first (most recent), plus anything this phone used that the server hasn't seen yet.
  const suggestionPool = useMemo(() => {
    const seen = new Set(history.map((h) => h.name));
    return [...recentItems.filter((r) => !seen.has(r.name)), ...history];
  }, [history, recentItems]);

  const setupQtys = useMemo((): (number | "")[] => {
    if (pick.mode === "auto") return splitIntoPallets(parseInt(pick.total, 10) || 0, parseInt(pick.per, 10) || 0);
    const n = Math.min(parseInt(pick.count, 10) || 0, 200);
    return Array.from({ length: n }, () => "" as const);
  }, [pick]);

  // ── navigation ──────────────────────────────────────────────────────
  function go(s: Screen) {
    setScreen(s);
    setSubmitError("");
  }

  const back: Partial<Record<Screen, Screen>> = {
    type: "home",
    header: draft && draft.items.length ? "items" : "type",
    picker: items.length ? "items" : "header",
    setup: "picker",
    pallets: "items",
    items: "header",
    paper: "home",
    materials: mode === "paper" ? "paper" : "items",
    review: "materials",
    sign: "review",
    preview: "sign",
  };

  function startNew() {
    if (draft && (draft.items.length > 0 || vehicleNo(draft))) {
      if (!window.confirm("Start a new sheet? The current draft will be discarded.")) return;
    }
    setDraft(null);
    setCur(-1);
    setHeaderErrors({});
    go("type");
  }

  function chooseForm(f: SheetForm) {
    setForm(f);
  }

  function confirmType() {
    if (!draft || draft.form !== form) {
      const fresh = newDraft(form);
      // Keep anything already typed that both forms share.
      if (draft) fresh.header.date = draft.header.date;
      setDraft(fresh);
    }
    setHeaderErrors({});
    setPaperProblems([]);
    go(mode === "paper" ? "paper" : "header");
  }

  /** Switches between the step-by-step screens and the paper layout; both edit the same draft. */
  function switchMode(next: FillMode) {
    setMode(next);
    saveMode(user.id, next);
    setPaperProblems([]);
    if (next === "paper") go("paper");
    else go(draft && draft.items.length ? "items" : "header");
  }

  function paperNext() {
    if (!draft) return;
    const errors = validateHeader(draft.form, draft.header);
    setHeaderErrors(errors);
    const problems: string[] = [];
    const nErr = Object.keys(errors).length;
    if (nErr) problems.push(`Header: ${nErr} field${nErr === 1 ? "" : "s"} need${nErr === 1 ? "s" : ""} fixing`);
    if (!draft.items.length) problems.push("Fill at least one pallet row.");
    const unnamed = unnamedRows(draft.items);
    if (unnamed.length) problems.push(`Write the item on pallet ${unnamed.join(", ")}.`);
    setPaperProblems(problems);
    if (problems.length) return;
    if (draft.form === "lorry") setRecentTransfers(remember(user.id, "transfer", draft.header.transferTo.trim().toUpperCase()));
    for (const it of draft.items) {
      setRecentItems(rememberItem(user.id, { name: it.name.trim(), unit: it.unit, qtyPerPallet: it.qtyPerPallet, useCount: 1 }));
    }
    go("materials");
  }

  function headerNext() {
    if (!draft) return;
    const errors = validateHeader(draft.form, draft.header);
    setHeaderErrors(errors);
    if (Object.keys(errors).length) return;
    if (draft.form === "lorry") setRecentTransfers(remember(user.id, "transfer", draft.header.transferTo.trim().toUpperCase()));
    if (draft.items.length) go("items");
    else openPicker();
  }

  function openPicker() {
    const last = items[items.length - 1]?.pallets.at(-1);
    setPick(blankPick({ pltType: last?.pltType ?? "L", contractNo: last?.contractNo ?? "" }));
    go("picker");
  }

  function createItem() {
    if (!draft || setupQtys.length === 0) return;
    const name = pick.name.trim().toUpperCase();
    const total = parseInt(pick.total, 10) || 0;
    const item: DraftItem = {
      id: newId(),
      name,
      unit: normalizeUnit(pick.unit),
      targetQty: total > 0 ? total : null,
      qtyPerPallet: pick.mode === "auto" ? parseInt(pick.per, 10) || null : null,
      pallets: buildPallets(setupQtys, { pltType: pick.pltType, contractNo: pick.contractNo.trim().toUpperCase() }),
    };
    update((d) => {
      d.items.push(item);
    });
    setCur(items.length);
    setRecentItems(rememberItem(user.id, { name, unit: item.unit, qtyPerPallet: item.qtyPerPallet, useCount: 1 }));
    go("pallets");
  }

  async function submit() {
    if (!draft || !draft.signature) return;
    const payload = draftToPayload(draft, describeDevice());
    const summary = `${draft.form === "container" ? "Container" : "Lorry"} ${sheetNo} · ${t.pallets} pallets · ${formatQty(t.qty)}`;
    const entry: OutboxEntry = {
      clientId: draft.clientId,
      payload,
      vehicleNo: sheetNo,
      docNo: draft.form === "container" ? draft.header.contractNo : draft.header.doNo,
      pallets: t.pallets,
      qty: formatQty(t.qty),
      queuedAt: new Date().toISOString(),
      state: "pending",
    };

    const queueAndFinish = () => {
      const queue = [...loadOutbox(user.id).filter((e) => e.clientId !== entry.clientId), entry];
      saveOutbox(user.id, queue);
      setOutbox(queue);
      setDraft(null);
      setResult({ offline: true, reference: `Pending · ${entry.clientId.slice(0, 8).toUpperCase()}`, summary });
      go("success");
    };

    if (!navigator.onLine) {
      queueAndFinish();
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await submitSheetAction(payload);
      if (res.ok) {
        setDraft(null);
        setResult({ offline: false, reference: res.data.ref, summary });
        go("success");
        router.refresh();
      } else if (res.retry) {
        queueAndFinish();
      } else {
        setSubmitError(res.error);
      }
    } catch {
      queueAndFinish();
    } finally {
      setSubmitting(false);
    }
  }

  async function doSignOut() {
    if (draft && draft.items.length > 0 && !window.confirm("Sign out? Your draft stays on this phone for next time.")) return;
    await signOut();
  }

  // ── render ──────────────────────────────────────────────────────────
  const step = STEP_OF[screen];
  const curItem = cur >= 0 ? items[cur] : undefined;
  const bars: Partial<Record<Screen, [string, string]>> = {
    type: ["New tally sheet", ""],
    header: ["Header", draft?.form === "lorry" ? "Lorry · Form B" : "Container · Form A"],
    paper: ["Tally sheet", sheetNo || (draft?.form === "lorry" ? "Lorry · Form B" : "Container · Form A")],
    picker: ["Add item", `Item ${items.length + 1} · starts at Pallet ${nextStart}`],
    setup: [pick.name || "Item", `Item ${items.length + 1} · Pallet setup`],
    pallets: [
      curItem?.name ?? "",
      curItem && ranges[cur]
        ? `Item ${cur + 1} · Pallet ${ranges[cur].start}${curItem.pallets.length > 1 ? `–${ranges[cur].end}` : ""}`
        : "",
    ],
    items: ["Items", sheetNo],
    materials: [draft?.form === "lorry" ? "Materials & pallets" : "Packing materials", sheetNo],
    review: ["Review before signing", sheetNo],
    sign: ["Count & Prepared By", sheetNo],
    preview: ["Tally sheet preview", sheetNo],
  };
  const bar = bars[screen];
  const canSwitch = screen === "paper" || screen === "header" || screen === "items" || screen === "pallets" || screen === "picker" || screen === "setup";
  const modeSwitch = screen === "type" ? (
    <div className="mr-1 flex h-9 overflow-hidden rounded-lg border-[1.5px] border-field text-sm font-bold" role="group" aria-label="How to fill the sheet">
      {(["steps", "paper"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => {
            setMode(m);
            saveMode(user.id, m);
          }}
          className={cn("px-3", m === "paper" && "border-l-[1.5px] border-field", mode === m ? "bg-solid text-on-solid" : "text-ink")}
        >
          {m === "steps" ? "Steps" : "Paper"}
        </button>
      ))}
    </div>
  ) : canSwitch ? (
    <button
      type="button"
      onClick={() => switchMode(screen === "paper" ? "steps" : "paper")}
      className="mr-1 flex h-9 items-center rounded-lg border-[1.5px] border-field px-3 text-sm font-bold text-primary hover:bg-primary-soft"
    >
      {screen === "paper" ? "Step by step" : "Paper view"}
    </button>
  ) : null;

  let body: React.ReactNode = null;
  if (screen === "home") {
    body = (
      <HomeScreen
        userName={user.name}
        department={user.department}
        initials={user.initials}
        online={online}
        draft={hydrated ? draft : null}
        outbox={outbox}
        sending={sending}
        sheets={sheets}
        onNew={startNew}
        onResume={() => {
          if (!draft) return;
          setForm(draft.form);
          go(mode === "paper" ? "paper" : draft.items.length ? "items" : "header");
        }}
        onDiscardDraft={() => {
          if (window.confirm("Discard this draft? It can't be recovered.")) setDraft(null);
        }}
        onRetry={() => {
          const reset = loadOutbox(user.id).map((e) => ({ ...e, state: "pending" as const, error: undefined }));
          saveOutbox(user.id, reset);
          setOutbox(reset);
          void flush();
        }}
        onDiscardOutbox={(clientId) => {
          if (!window.confirm("Discard this sheet? It was never received by the office.")) return;
          const rest = loadOutbox(user.id).filter((e) => e.clientId !== clientId);
          saveOutbox(user.id, rest);
          setOutbox(rest);
        }}
        onSignOut={doSignOut}
        officeLink={user.isOffice}
      />
    );
  } else if (screen === "type") {
    body = <ChooseTypeScreen form={form} onChoose={chooseForm} onNext={confirmType} />;
  } else if (screen === "success" && result) {
    body = (
      <SuccessScreen
        offline={result.offline}
        reference={result.reference}
        summary={result.summary}
        onNew={() => {
          setDraft(null);
          go("type");
        }}
        onHome={() => go("home")}
      />
    );
  } else if (draft) {
    if (screen === "header") {
      body = (
        <HeaderFormScreen
          form={draft.form}
          header={draft.header}
          errors={headerErrors}
          transferSuggestions={recentTransfers}
          onChange={(key: keyof DraftHeader, value: string) => {
            update((d) => {
              d.header[key] = value;
            });
            setHeaderErrors((e) => ({ ...e, [key]: undefined }));
          }}
          onNext={headerNext}
        />
      );
    } else if (screen === "paper") {
      body = (
        <PaperScreen
          form={draft.form}
          header={draft.header}
          items={draft.items}
          errors={headerErrors}
          problems={paperProblems}
          transferSuggestions={recentTransfers}
          history={suggestionPool}
          onHeader={(key, value) => {
            update((d) => {
              d.header[key] = value;
            });
            setHeaderErrors((e) => ({ ...e, [key]: undefined }));
          }}
          onItems={(fn) =>
            update((d) => {
              d.items = fn(d.items);
            })
          }
          onNext={paperNext}
        />
      );
    } else if (screen === "picker") {
      body = (
        <ItemNameScreen
          pick={pick}
          history={suggestionPool}
          onName={(name) => setPick((p) => ({ ...p, name }))}
          onUnit={(unit) => setPick((p) => ({ ...p, unit }))}
          onSuggestion={(h) =>
            setPick((p) => ({ ...p, name: h.name, unit: h.unit, per: h.qtyPerPallet ? String(h.qtyPerPallet) : p.per }))
          }
          onNext={() => pick.name.trim() && go("setup")}
        />
      );
    } else if (screen === "setup") {
      body = (
        <PalletSetupScreen
          form={draft.form}
          pick={pick}
          qtys={setupQtys}
          nextStart={nextStart}
          onChange={(patch) => setPick((p) => ({ ...p, ...patch }))}
          onCreate={createItem}
        />
      );
    } else if (screen === "pallets" && curItem) {
      body = (
        <PalletDetailsScreen
          form={draft.form}
          items={items}
          itemIndex={cur}
          startNo={ranges[cur].start}
          onUpdate={(mutate) =>
            update((d) => {
              mutate(d.items[cur], d.items);
            })
          }
          onSave={() => {
            go("items");
            const it = items[cur];
            showToast(`Item saved · ${itemQty(it)} ${it.unit} on ${it.pallets.length} pallet${it.pallets.length === 1 ? "" : "s"}`);
          }}
        />
      );
    } else if (screen === "items") {
      body = (
        <ItemListScreen
          items={items}
          onEdit={(i) => {
            setCur(i);
            go("pallets");
          }}
          onMoveUp={(i) =>
            update((d) => {
              [d.items[i - 1], d.items[i]] = [d.items[i], d.items[i - 1]];
            })
          }
          onDelete={(i) => {
            update((d) => {
              d.items.splice(i, 1);
            });
            setCur(-1);
          }}
          onAdd={openPicker}
          onDone={() => go("materials")}
        />
      );
    } else if (screen === "materials") {
      body = (
        <MaterialsScreen
          draft={draft}
          onMaterial={(k, delta) =>
            update((d) => {
              d.materials[k] = Math.max(0, Math.min(9999, (d.materials[k] ?? 0) + delta));
            })
          }
          onCheck={(k, patch) =>
            update((d) => {
              d.checks[k] = { ...d.checks[k], ...patch };
            })
          }
          onPltAdjust={(k, delta) =>
            update((d) => {
              d.pltAdjust[k] = (d.pltAdjust[k] ?? 0) + delta;
            })
          }
          onRemark={(v) =>
            update((d) => {
              d.remark = v;
            })
          }
          onNext={() => go("review")}
        />
      );
    } else if (screen === "review") {
      body = (
        <ReviewScreen
          draft={draft}
          warnings={warnings}
          onEditHeader={() => go(mode === "paper" ? "paper" : "header")}
          onEditItem={(i) => {
            if (mode === "paper") return go("paper");
            setCur(i);
            go("pallets");
          }}
          onEditMaterials={() => go("materials")}
          onSign={() => go("sign")}
        />
      );
    } else if (screen === "sign") {
      body = (
        <SignatureScreen
          summary={`I confirm ${t.pallets} pallets, ${formatQty(t.qty)} were counted for ${sheetNo}.`}
          signerName={user.name}
          timeLabel={formatDateTime(new Date().toISOString())}
          initial={draft.signature}
          onConfirm={(png) => {
            update(
              (d) => {
                d.signature = png;
                d.signedAt = new Date().toISOString();
              },
              { keepSignature: true },
            );
            go("preview");
          }}
        />
      );
    } else if (screen === "preview") {
      body = (
        <PreviewScreen
          paper={paperFromDraft(draft, user.name)}
          summary={`${t.pallets} pallets · ${formatQty(t.qty)} · signed by ${user.name}`}
          submitting={submitting}
          error={submitError}
          onSubmit={submit}
        />
      );
    }
  }

  if (body === null) {
    // Nothing to show (e.g. a stale screen after the draft was cleared).
    body = (
      <div className="flex flex-1 items-center justify-center p-8">
        <button type="button" className="font-bold text-primary" onClick={() => go("home")}>
          Back to the list
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative mx-auto flex h-dvh flex-col overflow-hidden bg-canvas text-ink", screen === "paper" ? "max-w-[1280px]" : "max-w-[820px]")}>
      {bar ? (
        <TopBar title={bar[0]} subtitle={bar[1]} onBack={() => go(back[screen] ?? "home")} form={screen === "type" ? null : draft?.form} action={modeSwitch} />
      ) : null}
      {step !== undefined ? <Progress step={step} /> : null}
      {body}
      <Toast message={toast} />
    </div>
  );
}
