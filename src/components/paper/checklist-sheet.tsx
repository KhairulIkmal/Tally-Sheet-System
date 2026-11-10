import {
  CHECKLIST_TEXT_MAX,
  CONTAINER_CHECKS,
  GOODS_CHECKS,
  PACKING_CHECKS,
  type Check,
  type ChecklistPaper,
  type YesNo,
} from "@/lib/tally/checklist";
import { BoldSignature, PAPER_HEIGHT, PAPER_WIDTH } from "./paper-sheet";

/**
 * Page 2: WH-FR-001 Stuffing / Loading Checklist, laid out like the paper form.
 * Always black on white. "Confirm by (W/H supervisor)" is left for a pen.
 */
const line = "1px solid #111";
const thick = "1.5px solid #111";
const mono = "var(--font-plex-mono), ui-monospace, monospace";
/** Rows in the product table, as on the form (it grows if a sheet has more items). */
const PRODUCT_ROWS = 11;

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", alignItems: "end", fontWeight: 700 }}>
      <span>{label}</span>
      <span>: {value}</span>
    </div>
  );
}

/** The fields page 2 has the worker write in. */
export type ChecklistTextField =
  "transportAgent" | "pList" | "liftruckDriver" | "forkliftDriver" | "stackerStuffer" | "temperature" | "qcBy" | "department";
export type TickSet = "container" | "goods" | "packing";

/** Filling page 2 in on the form itself (paper view): tap a box to tick it, type on the lines. */
export interface ChecklistEdit {
  tick: (set: TickSet, key: string, v: YesNo) => void;
  text: (field: ChecklistTextField, v: string) => void;
}

/** A blank on the form, typed into (paper view). Faintly shaded while empty. */
function Blank({
  field,
  value,
  label,
  edit,
  style,
}: {
  field: ChecklistTextField;
  value: string;
  label: string;
  edit: ChecklistEdit;
  style?: React.CSSProperties;
}) {
  const numeric = field === "temperature";
  return (
    <input
      aria-label={label}
      value={value}
      inputMode={numeric ? "decimal" : "text"}
      autoComplete="off"
      // The field being filled turns blue, as on page 1. An empty one is faintly blue, to show it's still to fill.
      className={value ? "bg-transparent focus:bg-primary-soft" : "bg-[rgba(37,99,235,.08)] focus:bg-primary-soft"}
      onChange={(e) =>
        edit.text(
          field,
          numeric ? e.target.value.replace(/[^0-9.-]/g, "").slice(0, 6) : e.target.value.toUpperCase().slice(0, CHECKLIST_TEXT_MAX),
        )
      }
      style={{
        font: `500 9.5px ${mono}`,
        color: "#111",
        textTransform: "uppercase",
        border: 0,
        borderRadius: 0,
        outline: "none",
        padding: "0 2px",
        margin: 0,
        minWidth: 0,
        width: "100%",
        height: "100%",
        ...style,
      }}
    />
  );
}

function Value({ children, align = "start" }: { children: React.ReactNode; align?: "start" | "center" }) {
  return (
    <span
      style={{ font: `500 9.5px ${mono}`, whiteSpace: "nowrap", overflow: "hidden", textAlign: align === "center" ? "center" : "left" }}
    >
      {children}
    </span>
  );
}

/** The YES / NO boxes for one set of checks, with a ✓ in the chosen one. */
function Ticks({
  checks,
  values,
  labelWidth,
  set,
  edit,
  groups,
}: {
  checks: readonly Check[];
  values: Partial<Record<string, YesNo>>;
  labelWidth: number;
  set: TickSet;
  edit?: ChecklistEdit;
  /** Rows per box where the form draws the boxes apart (A–D, E–H, I); one box when left out. */
  groups?: number[];
}) {
  const starts = new Set<number>();
  for (let at = 0, g = 0; g < (groups ?? []).length; at += groups![g], g++) starts.add(at);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `${labelWidth}px 46px 46px`, rowGap: 0 }}>
      <span />
      <span style={{ border: thick, borderBottom: line, textAlign: "center", fontWeight: 700, fontSize: 9 }}>YES</span>
      <span style={{ border: thick, borderLeft: 0, borderBottom: line, textAlign: "center", fontWeight: 700, fontSize: 9 }}>NO</span>
      {checks.map((c, i) => {
        const v = values[c.key];
        const last = i === checks.length - 1 || (i > 0 && starts.has(i + 1));
        const opens = i > 0 && starts.has(i);
        const box = (on: boolean, first: boolean): React.CSSProperties => ({
          borderTop: opens ? thick : 0,
          marginTop: opens ? 5 : 0,
          borderLeft: first ? thick : line,
          borderRight: first ? line : thick,
          borderBottom: last ? thick : line,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          minHeight: 17,
          color: on ? "#111" : "transparent",
        });
        return (
          <div key={c.key} style={{ display: "contents" }}>
            <span style={{ fontSize: 9, fontWeight: 700, lineHeight: "11px", padding: "2px 6px 2px 0", marginTop: opens ? 5 : 0 }}>
              {c.label}
              {c.note ? <span style={{ fontWeight: 500 }}> {c.note}</span> : null}
            </span>
            {(["yes", "no"] as const).map((answer) =>
              edit ? (
                <button
                  key={answer}
                  type="button"
                  aria-label={`${c.label} ${answer.toUpperCase()}`}
                  aria-pressed={v === answer}
                  onClick={() => edit.tick(set, c.key, v === answer ? "" : answer)}
                  // The box being tapped (or zoomed in on) turns blue, as on page 1.
                  className="bg-transparent focus:bg-primary-soft"
                  style={{
                    ...box(v === answer, answer === "yes"),
                    padding: 0,
                    margin: 0,
                    cursor: "pointer",
                  }}
                >
                  ✓
                </button>
              ) : (
                <span key={answer} style={box(v === answer, answer === "yes")}>
                  ✓
                </span>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ChecklistSheet({
  data,
  form,
  page,
  pages,
  edit,
}: {
  data: ChecklistPaper;
  form: "container" | "lorry";
  page: number;
  pages: number;
  /** Given in the paper view, where the worker fills the form in. */
  edit?: ChecklistEdit;
}) {
  const rows = Math.max(PRODUCT_ROWS, data.products.length);
  const side: [string, string, ChecklistTextField?][] = [
    ["P/LIST (OFFICE)", data.pList, "pList"],
    ["LIFTRUCK DRIVER", data.liftruckDriver, "liftruckDriver"],
    ["FORKLIFT DRIVER", data.forkliftDriver, "forkliftDriver"],
    ["STACKER / STUFFER", data.stackerStuffer, "stackerStuffer"],
    ["", ""],
    ["TIME START", data.timeStart],
    ["TIME END", data.timeEnd],
  ];
  const cell: React.CSSProperties = {
    borderRight: line,
    borderBottom: line,
    padding: "0 4px",
    height: 18,
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
  };
  return (
    <div
      style={{
        width: PAPER_WIDTH,
        height: PAPER_HEIGHT,
        background: "#fff",
        boxSizing: "border-box",
        padding: "40px 48px 30px",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: 10,
        color: "#111",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ borderBottom: line, paddingBottom: 3, display: "grid", gridTemplateColumns: "150px 1fr", fontWeight: 700 }}>
        <span>HACCP</span>
        <span>: PRE-REQUISITE PROGRAM DISTRIBUTION CONTROL</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 210px", rowGap: 8 }}>
        <Meta label="SUBJECT" value="DISTRIBUTION CONTROL" />
        <span />
        <Meta label="Type of Document" value="STUFFING / LOADING CHECKLIST" />
        <span />
        <Meta label="Document No" value="WH-FR-001" />
        <div style={{ fontWeight: 700 }}>
          Issued Date : <span style={{ font: `600 10px ${mono}`, borderBottom: line, paddingRight: 30 }}>{data.issuedDate}</span>
        </div>
        <Meta label="Revision No" value="08" />
        <div style={{ fontWeight: 700 }}>No of Pages : 1 of 1</div>
      </div>
      <div style={{ fontWeight: 700 }}>
        SHIPPING INSTRUCTION NO:{" "}
        <span style={{ font: `600 10px ${mono}`, borderBottom: line, padding: "0 60px 0 8px", marginLeft: 20 }}>{data.siNo}</span>
      </div>

      {/* The loading table: page 1's details on the left, who did the loading on the right. */}
      <div style={{ border: thick, fontSize: 9.5 }}>
        <div style={{ borderBottom: line, textAlign: "center", fontWeight: 700, padding: "2px 0" }}>
          KINDLY FILL UP THE CHECKLIST DURING STUFFING / LOADING:-
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "310px 89px 1fr" }}>
          <div style={{ ...cell, fontWeight: 700 }}>SHIPMENT INST / CONTRACT</div>
          <div style={cell}>
            <Value>{data.contract}</Value>
          </div>
          <div style={{ ...cell, borderRight: 0, justifyContent: "center", fontWeight: 700 }}>
            <span style={{ flex: "none" }}>TRANSPORT / AGENT</span>
            {edit ? (
              <Blank
                field="transportAgent"
                label="Transport / Agent"
                value={data.transportAgent}
                edit={edit}
                style={{ marginLeft: 8, flex: 1, height: 16 }}
              />
            ) : data.transportAgent ? (
              <span style={{ font: `500 9.5px ${mono}`, marginLeft: 8 }}>{data.transportAgent}</span>
            ) : null}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "310px 89px 1fr" }}>
          <div style={{ ...cell, fontWeight: 700 }}>TRUCK / CONTAINER NO</div>
          <div style={cell}>
            <Value>{data.vehicleNo}</Value>
          </div>
          <div style={{ ...cell, borderRight: 0 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ borderRight: line }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 58px 58px", fontWeight: 700 }}>
              <div style={cell}>PRODUCT NAME</div>
              <div style={{ ...cell, justifyContent: "center" }}>QUANTITY</div>
              <div style={{ ...cell, borderRight: 0, justifyContent: "center" }}>PACKING</div>
            </div>
            {Array.from({ length: rows }, (_, i) => data.products[i]).map((p, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 58px 58px" }}>
                <div style={cell}>
                  <Value>{p?.name ?? ""}</Value>
                </div>
                <div style={{ ...cell, justifyContent: "center" }}>
                  <Value align="center">{p?.quantity ?? ""}</Value>
                </div>
                <div style={{ ...cell, borderRight: 0, justifyContent: "center" }}>
                  <Value align="center">{p?.packing ?? ""}</Value>
                </div>
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 116px" }}>
              <div style={{ ...cell, borderBottom: 0, fontWeight: 700 }}>TTL QTY STUFFED / LOADED</div>
              <div style={{ ...cell, borderRight: 0, borderBottom: 0, justifyContent: "center" }}>
                <Value align="center">{data.totalQty}</Value>
              </div>
            </div>
          </div>
          <div>
            {side.map(([label, value, field], i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ ...cell, fontWeight: 700 }}>{label}</div>
                <div style={{ ...cell, borderRight: 0, padding: field && edit ? 0 : cell.padding }}>
                  {field && edit ? <Blank field={field} label={label} value={value} edit={edit} /> : <Value>{value}</Value>}
                </div>
              </div>
            ))}
            {Array.from({ length: rows + 2 - side.length }, (_, i) => (
              <div key={`b${i}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ ...cell, borderBottom: i === rows + 1 - side.length ? 0 : line }} />
                <div style={{ ...cell, borderRight: 0, borderBottom: i === rows + 1 - side.length ? 0 : line }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontWeight: 700 }}>
        TICK IN THE BOX THAT ARE APPLICABLE <span style={{ border: thick, padding: "0 24px", marginLeft: 40 }}>✓</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 34 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontWeight: 700 }}>1) CONDITION OF THE {form === "lorry" ? "CONTAINER / LORRY" : "CONTAINER / LORRY"}</div>
          <Ticks checks={CONTAINER_CHECKS} values={data.container} labelWidth={250} set="container" edit={edit} groups={[4, 4, 1]} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontWeight: 700 }}>2) CONDITION OF DRUM / CTNS / TINS</div>
          <Ticks checks={GOODS_CHECKS} values={data.goods} labelWidth={160} set="goods" edit={edit} />
          <div style={{ fontSize: 9, fontWeight: 700, marginTop: 4 }}>*Should be free from Damage/Contamination</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 34 }}>
        <Ticks checks={PACKING_CHECKS} values={data.packing} labelWidth={250} set="packing" edit={edit} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontWeight: 700, fontSize: 9.5 }}>
          <span>APPLICABLE FOR AMBIENT PRODUCTS ONLY</span>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 }}>
            <span>ENVIRONMENT TEMPERATURE °C DURING STUFFING</span>
            <span
              style={{
                border: thick,
                height: 52,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: `600 16px ${mono}`,
              }}
            >
              {edit ? (
                <Blank
                  field="temperature"
                  label="Environment temperature °C during stuffing"
                  value={data.temperature}
                  edit={edit}
                  style={{ font: `600 16px ${mono}`, textAlign: "center" }}
                />
              ) : (
                data.temperature
              )}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 34, fontWeight: 700, marginTop: 4 }}>
        <div>
          4) QC / GOODS INSPECTIONS BY:{" "}
          {edit ? (
            <Blank
              field="qcBy"
              label="QC / Goods inspections by"
              value={data.qcBy}
              edit={edit}
              style={{ width: 150, height: 16, borderBottom: line, marginLeft: 4 }}
            />
          ) : (
            <span style={{ font: `500 9.5px ${mono}`, borderBottom: line, padding: "0 30px 0 6px" }}>{data.qcBy}</span>
          )}
        </div>
        <div>
          DEPARTMENT:{" "}
          {edit ? (
            <Blank
              field="department"
              label="Department"
              value={data.department}
              edit={edit}
              style={{ width: 150, height: 16, borderBottom: line, marginLeft: 4 }}
            />
          ) : (
            <span style={{ font: `500 9.5px ${mono}`, borderBottom: line, padding: "0 30px 0 6px" }}>{data.department}</span>
          )}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 34, fontWeight: 700, marginTop: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div>
            CHECK BY: {/* Signed, as the clerk does on paper: page 1's signature. */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "flex-end",
                justifyContent: "center",
                width: 200,
                height: 34,
                borderBottom: line,
                verticalAlign: "bottom",
                marginLeft: 4,
              }}
            >
              {data.signature ? (
                <BoldSignature src={data.signature} height={32} />
              ) : edit ? (
                <span style={{ fontSize: 8.5, fontWeight: 500, color: "#888", paddingBottom: 2 }}>Your signature from page 1</span>
              ) : null}
            </span>
          </div>
          <span style={{ marginLeft: 90, fontSize: 9 }}>(TALLY CLERK)</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div>
            CONFIRM BY: <span style={{ borderBottom: line, display: "inline-block", width: 170 }} />
          </div>
          <span style={{ marginLeft: 100, fontSize: 9 }}>(W/H SUPERVISOR)</span>
        </div>
      </div>

      <div
        data-noprint
        style={{
          position: "absolute",
          left: 48,
          right: 48,
          bottom: 12,
          display: "flex",
          justifyContent: "flex-end",
          font: `400 8px ${mono}`,
          color: "#666",
        }}
      >
        PAGE {page} OF {pages}
      </div>
    </div>
  );
}
