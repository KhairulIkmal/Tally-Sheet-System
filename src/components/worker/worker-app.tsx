"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ListOrdered, Undo2 } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import { submitSheetAction, uploadPalletPhotoAction, type ActionResult } from "@/lib/data/actions";
import type { SubmitResult } from "@/lib/data/types";
import { photoObjectPath, photosToUpload, withPhotoPaths } from "@/lib/tally/photos";
import { deletePhotosFor, getPhoto } from "./photo-store";
import { normalizeUnit, type SheetForm, MAX_PALLETS } from "@/lib/tally/constants";
import { formatDateTime } from "@/lib/tally/dates";
import {
  buildPallets,
  formatQty,
  itemQty,
  newDraft,
  palletRanges,
  reviewWarnings,
  setupPallets,
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
import { PaperScreen, type PaperFix } from "./screens/paper";
import { ChecklistScreen } from "./screens/checklist";
import { draftChecklist } from "@/lib/tally/draft";
import type { Checklist } from "@/lib/tally/checklist";
import { sampleDraft } from "@/lib/tally/sample";

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
  | "checklist"
  | "review"
  | "sign"
  | "preview"
  | "success";

/** Edits closer together than this undo as one (typing a word). */
const UNDO_GROUP_MS = 1000;
const UNDO_LIMIT = 50;

const STEP_OF: Partial<Record<Screen, number>> = {
  header: 0,
  picker: 1,
  setup: 1,
  pallets: 2,
  // The items list is the "Item" step; "Pallet" is one item's pallets.
  items: 1,
  materials: 3,
  checklist: 4,
  review: 5,
  sign: 6,
  preview: 6,
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
  const [mode, setMode] = useState<FillMode>("paper");
  const [paperProblems, setPaperProblems] = useState<string[]>([]);
  const [cur, setCur] = useState(-1);
  // Set when the worker leaves the review to fix something: "Save" and "Back" then return to the review.
  const [fromReview, setFromReview] = useState(false);
  const [focusPallet, setFocusPallet] = useState<number | null>(null);
  // Fix from the review in paper mode: the sheet row (0-based) and cells to mark.
  const [paperFix, setPaperFix] = useState<PaperFix | null>(null);
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
  // Undo: the draft as it was before each change. Edits close together (typing a word) are one step.
  const undoStack = useRef<Draft[]>([]);
  const lastEditAt = useRef(0);
  const draftRef = useRef<Draft | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  /** The sheet the undo steps belong to: another sheet (new, sample, submitted) has nothing to undo. */
  const undoSheet = useRef<string | null>(null);
  const sendingRef = useRef(false);

  // ── device storage ──────────────────────────────────────────────────
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of device storage after mount */
    let d = loadDraft(user.id);
    let opened: Screen = "home";
    // /worker?sample=1 (container), ?sample=container-full, ?sample=lorry, ?sample=lorry-full or ?sample=lorry-paper loads a complete sheet that only needs signing (for demos).
    const url = new URL(window.location.href);
    const sample = url.searchParams.get("sample");
    if (sample === "1" || sample === "container-full" || sample === "lorry" || sample === "lorry-full" || sample === "lorry-paper") {
      url.searchParams.delete("sample");
      window.history.replaceState(null, "", url.pathname + url.search);
      if (!d || (!d.items.length && !vehicleNo(d)) || window.confirm("Load the sample sheet? The current draft will be replaced.")) {
        d = sampleDraft(new Date(), sample === "1" ? "container" : sample);
        opened = "review";
      }
    }
    setDraft(d);
    if (d) setForm(d.form);
    setScreen(opened);
    setMode(opened === "review" ? "steps" : loadMode(user.id));
    setOutbox(loadOutbox(user.id));
    setRecentItems(loadRecentItems(user.id));
    setRecentTransfers(loadRecent(user.id, "transfer"));
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user.id]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

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
    const before = draftRef.current;
    const now = Date.now();
    if (before && undoSheet.current !== before.clientId) {
      undoStack.current = [];
      undoSheet.current = before.clientId;
    }
    if (before && now - lastEditAt.current > UNDO_GROUP_MS) {
      undoStack.current = [...undoStack.current.slice(-(UNDO_LIMIT - 1)), before];
      setUndoCount(undoStack.current.length);
    }
    lastEditAt.current = now;
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

  /** Edits page 2, the stuffing / loading checklist. */
  const editChecklist = useCallback(
    (fn: (c: Checklist) => void) =>
      update((d) => {
        const c = structuredClone(draftChecklist(d));
        fn(c);
        d.checklist = c;
      }),
    [update],
  );

  /** Puts the draft back as it was before the last change. */
  function undo() {
    const previous = undoStack.current.at(-1);
    if (!previous || previous.clientId !== draftRef.current?.clientId) return;
    undoStack.current = undoStack.current.slice(0, -1);
    setUndoCount(undoStack.current.length);
    lastEditAt.current = 0;
    draftRef.current = previous;
    setDraft(previous);
    showToast("Last change undone");
  }

  /**
   * Sends one signed sheet: its pallet photos first (each into this worker's folder for the
   * sheet), then the sheet with their paths. A photo no longer on the phone is left off.
   * Safe to repeat: a photo already stored and a sheet already submitted both count as done.
   */
  const sendEntry = useCallback(
    async (entry: OutboxEntry): Promise<ActionResult<SubmitResult>> => {
      const paths = new Map<number, string>();
      for (const ph of entry.photos ?? []) {
        const blob = await getPhoto(ph.key);
        if (!blob) continue;
        const path = photoObjectPath(user.id, entry.clientId, ph.palletNo);
        const form = new FormData();
        form.set("path", path);
        form.set("photo", new File([blob], `p${ph.palletNo}.jpg`, { type: "image/jpeg" }));
        const up = await uploadPalletPhotoAction(form);
        if (!up.ok) return up;
        paths.set(ph.palletNo, path);
      }
      const res = await submitSheetAction(withPhotoPaths(entry.payload, paths));
      if (res.ok) void deletePhotosFor(entry.clientId);
      return res;
    },
    [user.id],
  );

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
        const res = await sendEntry(entry);
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
  }, [router, user.id, sendEntry]);

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
    return setupPallets(parseInt(pick.total, 10) || 0, parseInt(pick.per, 10) || 0, MAX_PALLETS - totals(items).pallets);
  }, [pick, items]);

  // ── navigation ──────────────────────────────────────────────────────
  function go(s: Screen) {
    setScreen(s);
    setSubmitError("");
    setFocusPallet(null);
    if (s !== "paper") setPaperFix(null);
    if (s === "review" || s === "home" || s === "type" || s === "paper") setFromReview(false);
  }

  /** Opens an item's pallets, optionally scrolled to one pallet. */
  function openItem(i: number, pallet: number | null = null) {
    setCur(i);
    go("pallets");
    setFocusPallet(pallet);
  }

  /** From the review: fix one part, then come straight back. */
  function fixFromReview(open: () => void) {
    open();
    setFromReview(true);
  }

  /** The step bar: jump to a part of the sheet (step-by-step view). */
  function jumpTo(i: number) {
    if (!draft) return;
    if (screen === "header") {
      const errors = validateHeader(draft.form, draft.header);
      setHeaderErrors(errors);
      if (i > 0 && Object.keys(errors).length) {
        showToast("Fix the header first");
        return;
      }
    }
    const keep = fromReview;
    if (i === 0) go("header");
    else if (i === 1) go("items");
    else if (i === 2) openItem(cur >= 0 && cur < items.length ? cur : 0);
    else if (i === 3) go("materials");
    else if (i === 4) go("checklist");
    else if (i === 5) go("review");
    if (keep && i < 5) setFromReview(true);
  }

  // Steps the worker can jump to: the header always; the rest once there is an item.
  const canJump = (i: number) => i === 0 || (i <= 5 && items.length > 0 && !!draft);

  const back: Partial<Record<Screen, Screen>> = {
    type: "home",
    header: draft && draft.items.length ? "items" : "type",
    picker: items.length ? "items" : "header",
    setup: "picker",
    pallets: "items",
    items: "header",
    paper: "home",
    materials: mode === "paper" ? "paper" : "items",
    checklist: "materials",
    review: mode === "paper" ? "paper" : "checklist",
    sign: "review",
    preview: "sign",
  };

  function startNew() {
    if (draft && (draft.items.length > 0 || vehicleNo(draft))) {
      if (!window.confirm("Start a new sheet? The current draft will be discarded.")) return;
    }
    if (draft) void deletePhotosFor(draft.clientId);
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
    // On the review the view only changes where "Back" and "Edit" lead.
    if (screen === "review") return;
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
    // Materials, remark and PLT totals are on the paper itself.
    go("review");
  }

  function headerNext() {
    if (!draft) return;
    const errors = validateHeader(draft.form, draft.header);
    setHeaderErrors(errors);
    if (Object.keys(errors).length) return;
    if (draft.form === "lorry") setRecentTransfers(remember(user.id, "transfer", draft.header.transferTo.trim().toUpperCase()));
    if (fromReview) go("review");
    else if (draft.items.length) go("items");
    else openPicker();
  }

  function openPicker() {
    const last = items[items.length - 1]?.pallets.at(-1);
    setPick(blankPick({ pltType: last?.pltType ?? "", pltOther: last?.pltOther ?? "", contractNo: last?.contractNo ?? "" }));
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
      qtyPerPallet: parseInt(pick.per, 10) || null,
      pallets: buildPallets(setupQtys, {
        pltType: pick.pltType,
        pltOther: pick.pltOther,
        contractNo: pick.contractNo.trim().toUpperCase(),
      }),
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
      photos: photosToUpload(draft),
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
      const res = await sendEntry(entry);
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
    checklist: ["Stuffing / loading checklist", sheetNo],
    review: ["Review before signing", sheetNo],
    sign: ["Count & Prepared By", sheetNo],
    preview: ["Tally sheet preview", sheetNo],
  };
  const bar = bars[screen];
  // Both views edit the same draft, so the worker can switch on any screen while filling the sheet.
  const canSwitch = (["paper", "header", "picker", "setup", "pallets", "items", "materials", "checklist", "review"] as Screen[]).includes(
    screen,
  );
  const toPaper = screen === "review" ? mode !== "paper" : screen !== "paper";
  const modeSwitch =
    screen === "type" ? (
      <div
        className="mr-1 flex h-9 overflow-hidden rounded-lg border-[1.5px] border-field text-sm font-bold"
        role="group"
        aria-label="How to fill the sheet"
      >
        {(["steps", "paper"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            aria-label={m === "steps" ? "Step by step" : "Paper view"}
            title={m === "steps" ? "Step by step" : "Paper view"}
            onClick={() => {
              setMode(m);
              saveMode(user.id, m);
            }}
            className={cn(
              "grid w-10 place-items-center",
              m === "paper" && "border-l-[1.5px] border-field",
              mode === m ? "bg-solid text-on-solid" : "text-ink",
            )}
          >
            {m === "steps" ? <ListOrdered aria-hidden className="size-5" /> : <FileText aria-hidden className="size-5" />}
          </button>
        ))}
      </div>
    ) : canSwitch ? (
      <button
        type="button"
        onClick={() => switchMode(toPaper ? "paper" : "steps")}
        aria-label={toPaper ? "Switch to paper view" : "Switch to step by step"}
        title={toPaper ? "Switch to paper view" : "Switch to step by step"}
        className="mr-1 grid size-10 place-items-center rounded-lg border-[1.5px] border-field text-primary hover:bg-primary-soft"
      >
        {toPaper ? <FileText aria-hidden className="size-5" /> : <ListOrdered aria-hidden className="size-5" />}
      </button>
    ) : null;

  const undoButton =
    canSwitch && undoCount > 0 && draft && undoSheet.current === draft.clientId ? (
      <button
        type="button"
        onClick={undo}
        aria-label="Undo the last change"
        title="Undo the last change"
        className="mr-1 grid size-10 place-items-center rounded-lg border-[1.5px] border-field text-primary hover:bg-primary-soft"
      >
        <Undo2 aria-hidden className="size-5" />
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
          if (!window.confirm("Discard this draft? It can't be recovered.")) return;
          if (draft) void deletePhotosFor(draft.clientId);
          setDraft(null);
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
          nextLabel={fromReview ? "Save · Back to review" : undefined}
        />
      );
    } else if (screen === "paper") {
      body = (
        <PaperScreen
          draft={draft}
          signerName={user.name}
          onEdit={(fn) => update(fn)}
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
          fix={paperFix}
          onFixDone={() => setPaperFix(null)}
          onBackToReview={() => go("review")}
        />
      );
    } else if (screen === "picker") {
      body = (
        <ItemNameScreen
          pick={pick}
          history={suggestionPool}
          onName={(name) =>
            // A qty per pallet the previous item's history filled in doesn't belong to this name.
            setPick((p) => ({
              ...p,
              name,
              ...(p.perFromHistory && p.per === p.perFromHistory ? { per: "" } : {}),
              perFromHistory: undefined,
            }))
          }
          onUnit={(unit) => setPick((p) => ({ ...p, unit }))}
          onSuggestion={(h) =>
            setPick((p) => {
              const fromHistory = h.qtyPerPallet ? String(h.qtyPerPallet) : undefined;
              return { ...p, name: h.name, unit: h.unit, per: fromHistory ?? p.per, perFromHistory: fromHistory };
            })
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
          room={MAX_PALLETS - totals(items).pallets}
          nextStart={nextStart}
          onChange={(patch) => setPick((p) => ({ ...p, ...patch }))}
          onCreate={createItem}
        />
      );
    } else if (screen === "pallets" && !curItem) {
      // Undo took away the item being edited.
      body = (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-base font-semibold text-body">This item was undone.</p>
          <button type="button" className="h-12 rounded-xl bg-primary px-5 font-bold text-white" onClick={() => go("items")}>
            Back to the items
          </button>
        </div>
      );
    } else if (screen === "pallets" && curItem) {
      body = (
        <PalletDetailsScreen
          photoPrefix={draft.clientId}
          form={draft.form}
          items={items}
          itemIndex={cur}
          startNo={ranges[cur].start}
          focusPallet={focusPallet}
          saveLabel={fromReview ? "Save · Back to review" : undefined}
          onUpdate={(mutate) =>
            update((d) => {
              mutate(d.items[cur], d.items);
            })
          }
          onSave={() => {
            go(fromReview ? "review" : "items");
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
            const keep = fromReview;
            openItem(i);
            if (keep) setFromReview(true);
          }}
          onRename={(i, name) =>
            update((d) => {
              d.items[i].name = name;
            })
          }
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
          onDone={() => go(fromReview ? "review" : "materials")}
          doneLabel={fromReview ? "Done · Back to review" : undefined}
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
          onNext={() => go(fromReview ? "review" : "checklist")}
          nextLabel={fromReview ? "Save · Back to review" : "Next · Checklist"}
        />
      );
    } else if (screen === "checklist") {
      body = (
        <ChecklistScreen
          draft={draft}
          onEdit={editChecklist}
          onNext={() => go("review")}
          nextLabel={fromReview ? "Save · Back to review" : undefined}
        />
      );
    } else if (screen === "review") {
      body = (
        <ReviewScreen
          draft={draft}
          warnings={warnings}
          onEditHeader={() => (mode === "paper" ? go("paper") : fixFromReview(() => go("header")))}
          onEditItem={(i, pallet, fields) => {
            if (mode !== "paper") return fixFromReview(() => openItem(i, pallet ?? null));
            const row = ranges[i].start - 1 + (pallet ?? 0);
            const label = `Pallet ${row + 1}${fields?.length ? `: fill in ${fields.map((f) => f[0].toUpperCase() + f.slice(1)).join(", ")}` : ""}`;
            go("paper");
            setPaperFix({ row, fields: pallet === undefined ? undefined : fields, label, seq: Date.now() });
          }}
          onEditMaterials={() => (mode === "paper" ? go("paper") : fixFromReview(() => go("materials")))}
          onEditChecklist={() => (mode === "paper" ? go("paper") : fixFromReview(() => go("checklist")))}
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
    <div
      className={cn(
        "relative mx-auto flex h-dvh flex-col overflow-hidden bg-canvas text-ink",
        screen === "paper" ? "max-w-[1280px]" : "max-w-[820px]",
      )}
    >
      {bar ? (
        <TopBar
          title={bar[0]}
          subtitle={bar[1]}
          onBack={() => {
            // Leaving a fix started from the review goes back to the review (an item in progress returns to its list).
            if (
              fromReview &&
              (screen === "header" || screen === "items" || screen === "pallets" || screen === "materials" || screen === "checklist")
            )
              go("review");
            else go(back[screen] ?? "home");
          }}
          form={screen === "type" ? null : draft?.form}
          action={
            <>
              {undoButton}
              {modeSwitch}
            </>
          }
        />
      ) : null}
      {step !== undefined ? (
        <Progress
          step={step}
          canJump={canJump}
          onStep={screen === "sign" || screen === "preview" || screen === "picker" || screen === "setup" ? undefined : jumpTo}
        />
      ) : null}
      {body}
      <Toast message={toast} />
    </div>
  );
}
