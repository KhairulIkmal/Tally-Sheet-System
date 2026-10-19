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

function HeaderField({ label, value, labelWidth }: { label: string; value: string; labelWidth: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `${labelWidth}px 10px 1fr`, alignItems: "end" }}>
      <span>{label}</span>
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

function Stacked({ values, align, circled = false }: { values: string[]; align: "start" | "center" | "end"; circled?: boolean }) {
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
        <div key={i} style={{ lineHeight: values.length > 2 ? "8px" : "11px", fontSize: values.length > 2 ? 7.5 : undefined, whiteSpace: "nowrap" }}>
          {circled && v ? (
            // A pallet that is not full: circled, as written on paper.
            <span style={{ display: "inline-block", border: "1.2px solid #111", borderRadius: 999, padding: "1px 5px", lineHeight: "11px" }}>{v}</span>
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
      <div style={{ height: 44, display: "flex", alignItems: "flex-end", paddingLeft: 14 }}>
        {data.signature ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URL signature, not a static asset
          <img src={data.signature} alt="Signature" style={{ height: 42, maxWidth: 230, objectFit: "contain", objectPosition: "left bottom" }} />
        ) : null}
      </div>
      <div style={{ width: 230, borderBottom: "1.5px dotted #111" }} />
      <div style={{ fontSize: 9, fontWeight: 400, marginTop: 4 }}>{data.signedBy}</div>
    </>
  );
}

function rowsFor(form: PaperData["form"], rows: PaperRow[], highlightMixed: boolean) {
  const cols =
    form === "container"
      ? "34px minmax(0,1fr) 46px 62px 62px 92px 86px"
      : "32px 34px 76px minmax(0,1fr) 38px 56px 56px 78px 62px";
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
        <div style={{ borderRight: line, display: "flex", alignItems: "center", justifyContent: "center", font: "700 10px Arial, sans-serif" }}>
          {r.no}
        </div>
        {form === "lorry" ? (
          <>
            <Cell center bold>
              {r.pltType}
            </Cell>
            <Cell>{r.contractNo}</Cell>
          </>
        ) : null}
        <Cell>
          {r.itemSub ? (
            <span style={{ display: "flex", flexDirection: "column", lineHeight: "11px" }}>
              <span>{r.item}</span>
              <span style={{ fontSize: 7.5 }}>{r.itemSub}</span>
            </span>
          ) : (
            <span style={r.itemIsTotal ? { fontSize: 8.5 } : undefined}>{r.item}</span>
          )}
        </Cell>
        <Stacked values={q} align="end" circled={!!r.loose && r.lines.length === 1} />
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
  const headCols = isContainer
    ? "34px minmax(0,1fr) 46px 62px 62px 92px 86px"
    : "32px 34px 76px minmax(0,1fr) 38px 56px 56px 78px 62px";
  const heads = isContainer
    ? ["NO", "ITEM (DESCRIPTION)", "QTY", "EXPIRED", "PROD", "BATCH", "REMARK"]
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
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 15, letterSpacing: ".02em", marginBottom: 14 }}>COUNT TALLY SHEET</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 40,
          rowGap: 7,
          fontSize: 10.5,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {isContainer ? (
          <>
            <HeaderField label="CONTRACT NO" value={h.contractNo} labelWidth={92} />
            <HeaderField label="DATE" value={h.date} labelWidth={70} />
            <HeaderField label="CONTAINER NO" value={h.containerNo} labelWidth={92} />
            <HeaderField label="SEAL NO" value={h.sealNo} labelWidth={70} />
            <HeaderField label="SI NO" value={h.siNo} labelWidth={92} />
            <HeaderField label="DISPORT" value={h.disport} labelWidth={70} />
          </>
        ) : (
          <>
            <HeaderField label="TRANSFER TO" value={h.transferTo} labelWidth={92} />
            <HeaderField label="DATE" value={h.date} labelWidth={70} />
            <HeaderField label="D/O NO" value={h.doNo} labelWidth={92} />
            <HeaderField label="LORRY NO" value={h.lorryNo} labelWidth={70} />
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
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 28, marginTop: 16, fontSize: 10.5, fontWeight: 700 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "72px 10px 1fr", alignItems: "end" }}>
              <span>REMARKS</span>
              <span>:</span>
              <span style={{ borderBottom: line, font: `500 10px ${mono}`, padding: "0 4px 1px", minHeight: 14, overflow: "hidden" }}>
                {data.remark}
              </span>
            </div>
            <div style={{ marginLeft: 82, borderBottom: line, height: 14 }} />
            <div style={{ marginTop: 12 }}>COUNT &amp; PREPARED BY :</div>
            <Signature data={data} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 10px", alignContent: "start" }}>
            {data.materials.map((m) => (
              <div key={m.label} style={{ display: "grid", gridTemplateColumns: "1fr 36px", border: line, height: 22 }}>
                <span style={{ padding: "0 6px", display: "flex", alignItems: "center", fontSize: 9, borderRight: line }}>{m.label}</span>
                <span style={{ font: `600 10px ${mono}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {m.value === "0" ? "" : m.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isLast && !isContainer ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 230px", gap: 40, marginTop: 12, fontSize: 10.5, fontWeight: 700 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 16 }}>
              {data.checks.map((c) => (
                <div key={c.label} style={{ display: "grid", gridTemplateColumns: "76px 10px 24px 1fr", alignItems: "end", gap: "0 4px" }}>
                  <span>{c.label}</span>
                  <span>:</span>
                  <span
                    style={{
                      width: 22,
                      height: 16,
                      border: "1.5px solid #111",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                    }}
                  >
                    {c.value}
                  </span>
                  <span style={{ borderBottom: line, font: `500 10px ${mono}`, padding: "0 4px 1px", height: 14, marginLeft: 8, overflow: "hidden" }}>
                    {c.note}
                  </span>
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "76px 10px 1fr", alignItems: "end", gap: "0 4px" }}>
                <span>REMARK</span>
                <span>:</span>
                <span style={{ borderBottom: line, font: `500 10px ${mono}`, padding: "0 4px 1px", minHeight: 14, overflow: "hidden" }}>
                  {data.remark}
                </span>
              </div>
              <div style={{ marginLeft: 94, borderBottom: line, height: 14 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ textAlign: "right", fontSize: 10.5, marginBottom: 2 }}>TOTAL NUMBER OF PLT</div>
              {data.plt.map((p) => (
                <div key={p.label} style={{ display: "grid", gridTemplateColumns: "1fr 60px", border: "1.5px solid #111", height: 21 }}>
                  <span style={{ padding: "0 6px", display: "flex", alignItems: "center", fontSize: 9.5, borderRight: "1.5px solid #111" }}>
                    {p.label}
                  </span>
                  <span style={{ font: `600 10.5px ${mono}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 10.5, fontWeight: 700 }}>COUNT &amp; PREPARED BY :</div>
          <Signature data={data} />
        </>
      ) : null}

      {!isLast ? (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 10.5, fontWeight: 700 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div>COUNT &amp; PREPARED BY :</div>
            <Signature data={data} />
          </div>
          <div style={{ border: "1.5px solid #111", padding: "8px 12px", fontSize: 10 }}>CONTINUED ON PAGE {page + 1} →</div>
        </div>
      ) : null}

      <div
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
        <div key={i} style={{ width: "210mm", height: "297mm", overflow: "hidden", breakAfter: "page" }}>
          <PaperSheet data={data} page={i + 1} />
        </div>
      ))}
    </>
  );
}
