"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, LocateFixed, X, ZoomIn } from "lucide-react";
import type { Bounds, Crash, CrashPage, Severity } from "@/lib/crashes";
import { copy, count, crashPlace, crashType, localDate, type Language } from "@/lib/language";

export interface ListPanel {
  kind: "list";
  area: "view" | "country" | "nearby" | "hotspot";
  bounds: Bounds | null;
}

export type Panel = ListPanel | { kind: "detail"; id: number; back: ListPanel | null };

export function SeverityMark({ severity }: { severity: Severity }) {
  return <span className={`severity-mark severity-${severity}`} aria-hidden="true" />;
}

async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error("Crash request failed.");
  return response.json() as Promise<T>;
}

function CrashList({ panel, snapshotId, language, filterQuery, onOpen, onZoom }: {
  panel: ListPanel;
  snapshotId: string;
  language: Language;
  filterQuery: string;
  onOpen: (id: number) => void;
  onZoom: (() => void) | null;
}) {
  const t = copy[language];
  const [rows, setRows] = useState<Crash[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const bounds = panel.bounds?.join(",");
  const isHotspot = panel.area === "hotspot";

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams(filterQuery);
    if (bounds) query.set("bounds", bounds);
    if (cursor !== null) query.set("after", String(cursor));
    else if (isHotspot) query.set("includeTotal", "1");
    void read<CrashPage>(`/api/snapshots/${snapshotId}/crashes?${query}`, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setRows((previous) => cursor === null ? result.crashes : [...previous, ...result.crashes]);
        setNext(result.next);
        if (result.total !== undefined) setTotal(result.total);
        setStatus("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [snapshotId, bounds, cursor, attempt, isHotspot, filterQuery]);

  return (
    <>
      {isHotspot && (
        <div className="hotspot-summary">
          <p role="status">{total !== null && <><strong>{count(language, total)}</strong> {t.hotspotCount}</>}</p>
          {onZoom && (
            <button className="action-button" type="button" onClick={onZoom}>
              <ZoomIn size={16} aria-hidden="true" />{t.zoomToArea}
            </button>
          )}
        </div>
      )}
      <ul className="crash-list">
        {rows.map((crash) => (
          <li key={crash.id}>
            <button type="button" onClick={() => onOpen(crash.id)}>
              <SeverityMark severity={crash.severity} />
              <span className="list-row-text">
                <strong>{crashPlace(crash) || t.missing}</strong>
                <span>{localDate(language, crash.occurredAt)} · {t[crash.severity]}</span>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {status === "loading" && <p className="drawer-message" role="status">{t.loading}</p>}
      {status === "error" && (
        <div className="drawer-message" role="status">
          <p>{t.dataError}</p>
          <button className="action-button" type="button" onClick={() => { setStatus("loading"); setAttempt((n) => n + 1); }}>{t.retry}</button>
        </div>
      )}
      {status === "ready" && rows.length === 0 && <p className="drawer-message">{t.noRows}</p>}
      {status === "ready" && next !== null && (
        <button className="action-button drawer-more" type="button" onClick={() => { setStatus("loading"); setCursor(next); }}>{t.showMore}</button>
      )}
    </>
  );
}

function CrashDetail({ id, snapshotId, language, canLocate, onLocate, onSelect }: {
  id: number;
  snapshotId: string;
  language: Language;
  canLocate: boolean;
  onLocate: (crash: Crash) => void;
  onSelect: (crash: Crash) => void;
}) {
  const t = copy[language];
  const [crash, setCrash] = useState<Crash | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void read<Crash>(`/api/snapshots/${snapshotId}/crashes/${id}`, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setCrash(result);
        onSelect(result);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [id, snapshotId, attempt, onSelect]);

  if (!crash) {
    return failed ? (
      <div className="drawer-message" role="status">
        <p>{t.dataError}</p>
        <button className="action-button" type="button" onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>{t.retry}</button>
      </div>
    ) : <p className="drawer-message" role="status">{t.loading}</p>;
  }

  return (
    <div className="crash-detail">
      <p className="detail-severity"><SeverityMark severity={crash.severity} />{t[crash.severity]}</p>
      <dl className="crash-fields">
        <div><dt>{t.date}</dt><dd>{localDate(language, crash.occurredAt)}</dd></div>
        <div><dt>{t.place}</dt><dd>{crashPlace(crash) || t.missing}</dd></div>
        <div><dt>{t.type}</dt><dd>{crashType(language, crash.crashType)}</dd></div>
      </dl>
      <dl className="casualties">
        <div><dt>{t.injured}</dt><dd>{crash.injured === null ? t.missing : count(language, crash.injured)}</dd></div>
        <div><dt>{t.deaths}</dt><dd>{crash.deaths === null ? t.missing : count(language, crash.deaths)}</dd></div>
      </dl>
      {canLocate && (
        <button className="action-button" type="button" onClick={() => onLocate(crash)}>
          <LocateFixed size={17} aria-hidden="true" />{t.point}
        </button>
      )}
    </div>
  );
}

export function CrashDrawer({ panel, snapshotId, language, filterQuery, onClose, onOpen, onBack, onLocate, onSelect, onZoomArea }: {
  panel: Panel;
  snapshotId: string;
  language: Language;
  filterQuery: string;
  onClose: () => void;
  onOpen: (id: number) => void;
  onBack: (list: ListPanel) => void;
  onLocate: ((crash: Crash) => void) | null;
  onSelect: (crash: Crash) => void;
  onZoomArea: ((bounds: Bounds) => void) | null;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const t = copy[language];
  const key = panel.kind === "detail" ? `crash-${panel.id}` : `list-${panel.area}-${panel.bounds?.join(",")}`;
  const titles = { hotspot: t.hotspotList, view: t.viewList, nearby: t.nearbyList, country: t.allList };
  const title = panel.kind === "detail" ? t.details : titles[panel.area];
  const area = panel.kind === "list" && panel.area === "hotspot" ? panel.bounds : null;

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [key]);

  return (
    <aside className="drawer" aria-labelledby="drawer-title" data-panel={panel.kind}>
      <div className="drawer-header">
        <h2 ref={heading} id="drawer-title" tabIndex={-1}>{title}</h2>
        <button type="button" className="icon-button drawer-close" aria-label={t.close} onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="drawer-body" key={key}>
        {panel.kind === "list" ? (
          <CrashList key={`${snapshotId}:${filterQuery}`} panel={panel} snapshotId={snapshotId} language={language} filterQuery={filterQuery} onOpen={onOpen}
            onZoom={area && onZoomArea ? () => onZoomArea(area) : null} />
        ) : (
          <>
            {panel.back && (
              <button type="button" className="back-button" onClick={() => { if (panel.back) onBack(panel.back); }}>
                <ArrowLeft size={16} aria-hidden="true" />{t.back}
              </button>
            )}
            <CrashDetail id={panel.id} snapshotId={snapshotId} language={language} onSelect={onSelect}
              canLocate={onLocate !== null} onLocate={(crash) => onLocate?.(crash)} />
          </>
        )}
      </div>
    </aside>
  );
}
