import { MATERIALS_FIRST_BOXES } from "@/lib/tally/constants";
import { formatQty } from "@/lib/tally/draft";
import { pageCount, pageRows, type PaperData, type PaperRow } from "@/lib/tally/sheet";

/**
 * One A4 page (794×1123 CSS px at 96 dpi) laid out like the paper Count
 * Tally Sheet. Always black on white, whatever the app theme. A mixed
 * pallet is one row whose Qty/Expired/Prod/Batch cells stack their lines.
 */
export const PAPER_WIDTH = 794;
export const PAPER_HEIGHT = 1123;

const line = "1px solid #111";
const mono = "var(--font-plex-mono), ui-monospace, monospace";

/** Column widths measured off the paper forms. */
const COLUMNS = {
  container: "36px 183px 64px 80px 88px 158px minmax(0,1fr)",
  lorry: "32px 58px 84px 151px 44px 69px 72px 133px minmax(0,1fr)",
};

function HeaderField({ label, value, labelWidth, right }: { label: string; value: string; labelWidth: number; right?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `${labelWidth}px 10px 1fr`, alignItems: "end" }}>
      <span style={right ? { textAlign: "right", paddingRight: 3 } : undefined}>{label}</span>
      <span>:</span>
      <span
        style={{
          borderBottom: line,
          font: `600 11px ${mono}`,
          padding: "0 4px 1px",
          height: 15,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Item TOTALs and circled qtys stand out in red, kept when printing (browsers drop colours by default). */
const RED: React.CSSProperties = { color: "#d1201b", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" };

function Stacked({ values, align, circled = false }: { values: string[]; align: "start" | "center" | "end"; circled?: boolean }) {
  // On a mixed pallet only the last batch's qty is circled.
  const circleAt = circled ? values.findLastIndex((v) => !!v) : -1;
  return (
    <div
      style={{
        borderRight: line,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: align === "start" ? "flex-start" : align === "end" ? "flex-end" : "center",
        padding: "0 4px",
        overflow: "hidden",
      }}
    >
      {values.map((v, i) => (
        <div
          key={i}
          style={{ lineHeight: values.length > 2 ? "8px" : "11px", fontSize: values.length > 2 ? 7.5 : undefined, whiteSpace: "nowrap" }}
        >
          {i === circleAt ? (
            // A pallet that is not full: circled, as written on paper.
            <span
              style={{
                ...RED,
                display: "inline-block",
                border: "1.4px solid currentColor",
                borderRadius: 999,
                padding: "1px 5px",
                lineHeight: "11px",
                fontWeight: 700,
              }}
            >
              {v}
            </span>
          ) : (
            v
          )}
        </div>
      ))}
    </div>
  );
}

function Cell({ children, center, last, bold }: { children?: React.ReactNode; center?: boolean; last?: boolean; bold?: boolean }) {
  return (
    <div
      style={{
        borderRight: last ? undefined : line,
        display: "flex",
        alignItems: "center",
        justifyContent: center ? "center" : "flex-start",
        padding: center ? 0 : "0 5px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        fontWeight: bold ? 700 : undefined,
      }}
    >
      {children}
    </div>
  );
}

function Signature({ data }: { data: PaperData }) {
  return (
    <>
      <div style={{ width: 230, height: 44, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        {data.signature ? <BoldSignature src={data.signature} /> : null}
      </div>
      <div style={{ width: 230, borderBottom: "1.5px dotted #111" }} />
      <div style={{ fontSize: 9, fontWeight: 400, marginTop: 4 }}>{data.signedBy}</div>
    </>
  );
}

/**
 * REMARKS on two ruled lines: the text runs on from the first line onto the
 * second, as when written by hand. The rules are borders (print without
 * "background graphics"), the text sits on them with a matching line height.
 */
function RuledRemark({ label, labelWidth, text, step }: { label: string; labelWidth: number; text: string; step: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `${labelWidth}px 10px 1fr`, alignItems: "start" }}>
      <span style={{ lineHeight: `${step}px` }}>{label}</span>
      <span style={{ lineHeight: `${step}px` }}>:</span>
      <span style={{ position: "relative", height: step * 2 }}>
        <span style={{ position: "absolute", inset: "0 0 auto", height: step, borderBottom: line }} />
        <span style={{ position: "absolute", inset: `${step}px 0 auto`, height: step, borderBottom: line }} />
        <span
          style={{
            position: "relative",
            display: "block",
            height: step * 2,
            overflow: "hidden",
            padding: "0 4px",
            font: `500 10px/${step}px ${mono}`,
            overflowWrap: "anywhere",
          }}
        >
          {text}
        </span>
      </span>
    </div>
  );
}

/**
 * The pad's strokes come out thin once shrunk to the signature line, so the
 * image is stacked with copies nudged each way. Plain images, not a CSS filter,
 * so it prints the same and also thickens sheets signed earlier.
 */
const INK_NUDGE = ["0.5px, 0", "-0.5px, 0", "0, 0.5px", "0, -0.5px"];

function BoldSignature({ src }: { src: string }) {
  return (
    <span style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL signature, not a static asset */}
      <img src={src} alt="Signature" style={{ maxHeight: 42, maxWidth: 220, objectFit: "contain" }} />
      {INK_NUDGE.map((n) => (
        // eslint-disable-next-line @next/next/no-img-element -- a data: URL signature, not a static asset
        <img
          key={n}
          src={src}
          alt=""
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", transform: `translate(${n})` }}
        />
      ))}
    </span>
  );
}

/** One set of the container form's packing-material boxes. */
function MaterialBoxes({ boxes }: { boxes: PaperData["materials"] }) {
  return (
    <div style={{ border: "1.5px solid #111", width: 165 }}>
      {boxes.map((m, i) => (
        <div
          key={m.label}
          style={{ display: "grid", gridTemplateColumns: "84px 1fr", height: 23, borderBottom: i < boxes.length - 1 ? line : undefined }}
        >
          <span style={{ padding: "0 4px", display: "flex", alignItems: "center", fontSize: 9, whiteSpace: "nowrap", borderRight: line }}>
            {m.label}
          </span>
          <span style={{ font: `600 10px ${mono}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {m.value === "0" ? "" : m.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function rowsFor(form: PaperData["form"], rows: PaperRow[], highlightMixed: boolean) {
  const cols = COLUMNS[form];
  return rows.map((r) => {
    const q = r.lines.map((l) => l.qty);
    const e = r.lines.map((l) => l.expired);
    const p = r.lines.map((l) => l.prod);
    const b = r.lines.map((l) => l.batch);
    return (
      <div
        key={r.no}
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          height: 28,
          borderBottom: line,
          font: `500 ${form === "container" ? 9.5 : 9}px ${mono}`,
          background: highlightMixed && r.lines.length > 1 ? "#fff6d6" : "transparent",
        }}
      >
        <div
          style={{ borderRight: line, display: "flex", alignItems: "center", justifyContent: "center", font: "700 10px Arial, sans-serif" }}
        >
          {r.no}
        </div>
        {form === "lorry" ? (
          <>
            <Cell center bold>
              {/* Written by the worker for an Others pallet, so it may need a second line. */}
              {r.pltType.length > 9 ? (
                <span style={{ whiteSpace: "normal", fontSize: 7.5, lineHeight: "9px", textAlign: "center", overflowWrap: "anywhere" }}>
                  {r.pltType}
                </span>
              ) : (
                r.pltType
              )}
            </Cell>
            <Cell>{r.contractNo}</Cell>
          </>
        ) : null}
        <Cell>
          {r.itemSub ? (
            <span style={{ display: "flex", flexDirection: "column", lineHeight: "11px" }}>
              <span>{r.item}</span>
              <span style={{ ...RED, fontSize: 7.5, fontWeight: 700 }}>{r.itemSub}</span>
            </span>
          ) : (
            <span style={r.itemIsTotal ? { ...RED, fontSize: 8.5, fontWeight: 700 } : undefined}>{r.item}</span>
          )}
        </Cell>
        <Stacked values={q} align="center" circled={!!r.circled} />
        <Stacked values={e} align="center" />
        <Stacked values={p} align="center" />
        <Stacked values={b} align="start" />
        <Cell last>
          <span style={{ fontSize: form === "container" ? 9 : 8.5 }}>{r.remark}</span>
        </Cell>
      </div>
    );
  });
}

export function PaperSheet({ data, page = 1, highlightMixed = false }: { data: PaperData; page?: number; highlightMixed?: boolean }) {
  const pages = pageCount(data.rows.length);
  const isLast = page >= pages;
  const rows = pageRows(data.rows, page);
  const h = data.header;
  const isContainer = data.form === "container";
  const headCols = COLUMNS[data.form];
  const heads = isContainer
    ? ["NO.", "ITEM (DESCRIPTION)", "QTY", "EXPIRED", "PROD", "BATCH", "REMARK"]
    : ["PLT\nNO", "PLT\nTYPE", "CONTRACT\nNO.", "ITEM (DESC)", "QTY", "EXPIRED", "PROD", "BATCH", "REMARK"];

  return (
    <div
      style={{
        width: PAPER_WIDTH,
        height: PAPER_HEIGHT,
        background: "#fff",
        boxSizing: "border-box",
        padding: "42px 40px 34px",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#111",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 19, letterSpacing: ".02em", marginBottom: 14 }}>COUNT TALLY SHEET</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isContainer ? "349px minmax(0,1fr)" : "1fr 1fr",
          columnGap: isContainer ? 15 : 50,
          rowGap: 10,
          fontSize: 11,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {isContainer ? (
          <>
            {/* As on the paper form: Contract, Container, Seal down the left; SI, Disport, Date down the right. */}
            <HeaderField label="CONTRACT NO" value={h.contractNo} labelWidth={124} right />
            <HeaderField label="SI NO" value={h.siNo} labelWidth={73} right />
            <HeaderField label="CONTAINER NO" value={h.containerNo} labelWidth={124} right />
            <HeaderField label="DISPORT" value={h.disport} labelWidth={73} right />
            <HeaderField label="SEAL NO" value={h.sealNo} labelWidth={124} right />
            <HeaderField label="DATE" value={h.date} labelWidth={73} right />
          </>
        ) : (
          <>
            <HeaderField label="TRANSFER TO" value={h.transferTo} labelWidth={110} />
            <HeaderField label="DATE" value={h.date} labelWidth={87} />
            <HeaderField label="D/O NO" value={h.doNo} labelWidth={110} />
            <HeaderField label="LORRY NO" value={h.lorryNo} labelWidth={87} />
          </>
        )}
      </div>

      <div style={{ border: "1.5px solid #111" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: headCols,
            height: 30,
            borderBottom: "1.5px solid #111",
            fontSize: isContainer ? 9.5 : 8.5,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: "10px",
          }}
        >
          {heads.map((t, i) => (
            <div
              key={t}
              style={{
                borderRight: i < heads.length - 1 ? line : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                whiteSpace: "pre-line",
              }}
            >
              {t}
            </div>
          ))}
        </div>
        {rowsFor(data.form, rows, highlightMixed)}
      </div>

      {isLast && isContainer ? (
        <div style={{ marginTop: 12, fontSize: 10.5, fontWeight: 700 }}>
          <div style={{ padding: "0 76px 0 42px" }}>
            <RuledRemark label="REMARKS" labelWidth={62} text={data.remark} step={24} />
          </div>
          {/* As on the paper: the signature on the left, then two sets of boxes side by side, level at the bottom. */}
          <div style={{ display: "grid", gridTemplateColumns: "282px 165px minmax(0,1fr)", alignItems: "end", marginTop: 8 }}>
            <div style={{ paddingLeft: 42 }}>
              <div>COUNT &amp; PREPARED BY :</div>
              <Signature data={data} />
            </div>
            <MaterialBoxes boxes={data.materials.slice(0, MATERIALS_FIRST_BOXES)} />
            <div style={{ justifySelf: "end" }}>
              <MaterialBoxes boxes={data.materials.slice(MATERIALS_FIRST_BOXES)} />
            </div>
          </div>
        </div>
      ) : null}

      {isLast && !isContainer ? (
        <>
          <div
            style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 200px", gap: 41, marginTop: 6, fontSize: 10.5, fontWeight: 700 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 19 }}>
              {data.checks.map((c) => (
                <div key={c.label} style={{ display: "grid", gridTemplateColumns: "76px 10px 40px 1fr", alignItems: "end", gap: "0 4px" }}>
                  <span>{c.label}</span>
                  <span>:</span>
                  <span
                    style={{
                      width: 40,
                      height: 20,
                      border: "1.5px solid #111",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                    }}
                  >
                    {c.value}
                  </span>
                  <span
                    style={{
                      borderBottom: line,
                      font: `500 10px ${mono}`,
                      padding: "0 4px 1px",
                      height: 14,
                      marginLeft: 8,
                      overflow: "hidden",
                    }}
                  >
                    {c.note}
                  </span>
                </div>
              ))}
              <RuledRemark label="REMARK" labelWidth={80} text={data.remark} step={20} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ textAlign: "right", fontSize: 10.5, height: 14 }}>TOTAL NUMBER OF PLT</div>
              {data.plt.map((p) => (
                <div key={p.label} style={{ display: "grid", gridTemplateColumns: "1fr 66px", border: "1.5px solid #111", height: 20 }}>
                  <span style={{ padding: "0 6px", display: "flex", alignItems: "center", fontSize: 9.5, borderRight: "1.5px solid #111" }}>
                    {p.label}
                  </span>
                  <span style={{ font: `600 10.5px ${mono}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {p.value}
                  </span>
                </div>
              ))}
              {/* Only a sheet stored while the form had a line under OTHERS. */}
              {data.pltOtherNote ? <div style={{ font: `500 9px ${mono}`, textAlign: "right" }}>{data.pltOtherNote}</div> : null}
            </div>
          </div>
          <div style={{ marginTop: 8, paddingLeft: 36, fontSize: 10.5, fontWeight: 700 }}>
            <div>COUNT &amp; PREPARED BY :</div>
            <Signature data={data} />
          </div>
        </>
      ) : null}

      {!isLast ? (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 10.5,
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div>COUNT &amp; PREPARED BY :</div>
            <Signature data={data} />
          </div>
          <div style={{ border: "1.5px solid #111", padding: "8px 12px", fontSize: 10 }}>CONTINUED ON PAGE {page + 1} →</div>
        </div>
      ) : null}

      {/* Ref and page number: on screen only, the printed sheet stays as clean as the paper form. */}
      <div
        data-noprint
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          bottom: 14,
          display: "flex",
          justifyContent: "space-between",
          font: `400 8px ${mono}`,
          color: "#666",
        }}
      >
        <span>
          {data.ref} · {data.totalPallets} PLT · {formatQty(data.qtyByUnit)}
        </span>
        <span>
          PAGE {page} OF {pages}
        </span>
      </div>
    </div>
  );
}

/** Every page of a sheet, for the hidden print area. */
export function PaperPages({ data }: { data: PaperData }) {
  const pages = pageCount(data.rows.length);
  return (
    <>
      {Array.from({ length: pages }, (_, i) => (
        // Exactly one A4 sheet per page: 794×1123 px is 210×297 mm at 96 dpi,
        // and the clip stops sub-pixel rounding from spilling onto a blank page.
        // Only break between pages: a break after the last one prints a blank page.
        <div key={i} style={{ width: "210mm", height: "297mm", overflow: "hidden", breakAfter: i < pages - 1 ? "page" : "auto" }}>
          <PaperSheet data={data} page={i + 1} />
        </div>
      ))}
    </>
  );
}
