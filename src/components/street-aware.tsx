"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Globe2, Info, List, LocateFixed, Map as MapIcon, Minus, Mountain, Plus } from "lucide-react";
import { type Bounds, type Crash, type Snapshot, severities } from "@/lib/crashes";
import { copy, count, dateRange, type Language } from "@/lib/language";
import type { Basemap, CrashView, Imagery } from "@/lib/map-style";
import { CrashDrawer, SeverityMark, type ListPanel, type Panel } from "./crash-drawer";
import { MapCanvas, type MapControls, type MapNotice } from "./map-canvas";

const crashDataUrl = "https://testdata.egov.bg/data/view/0c5d9df9-2162-4b32-8c12-862b259efbdc";

function Attribution({ basemap, imagery, language }: { basemap: Basemap; imagery: Imagery | null; language: Language }) {
  const t = copy[language];
  return (
    <footer className="map-footer">
      <div className="data-credit">
        {basemap === "satellite" && imagery === "maptiler" && (
          <a href="https://www.maptiler.com/" className="maptiler-logo" target="_blank" rel="noreferrer">
            {/* The free plan requires the linked logo in the lower-left corner. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="MapTiler" src="https://api.maptiler.com/resources/logo.svg" height="16" />
          </a>
        )}
        <a href={crashDataUrl} target="_blank" rel="noreferrer">{t.dataSource} · {t.sourceShort}</a>
      </div>
      <div className="tile-credit" aria-label={t.mapAttribution}>
        {basemap === "streets" ? (
          <>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
            <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">{t.fixMap}</a>
          </>
        ) : imagery === "maptiler" ? (
          <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">© MapTiler</a>
        ) : imagery === "copernicus" ? (
          <>
            <a href="https://sdi.eea.europa.eu/catalogue/srv/api/records/ac127b0b-8087-4889-8f99-cab372cfc0fc"
              target="_blank" rel="noreferrer">Copernicus Land Monitoring Service · EEA</a>
            <span>{t.clipped}</span>
          </>
        ) : imagery === "eox" ? (
          <a href="https://cloudless.eox.at/" target="_blank" rel="noreferrer">
            EOxCloudless by EOX IT Services GmbH · Contains modified Copernicus Sentinel data 2016
          </a>
        ) : null}
        {basemap === "satellite" && (
          <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">{t.elevation}</a>
        )}
      </div>
    </footer>
  );
}

function Legend({ view, language, listEnabled, onList }: {
  view: CrashView; language: Language; listEnabled: boolean; onList: () => void;
}) {
  const t = copy[language];
  return (
    <section className="legend" aria-label={view === "hotspots" ? t.hotLegend : t.crashLegend}>
      {view === "hotspots" ? (
        <>
          <h2>{t.hotLegend}</h2>
          <div className="hotspot-key">
            <span>{t.less}</span>
            <span className="legend-circles" aria-hidden="true"><i /><i /><i /></span>
            <span>{t.more}</span>
          </div>
        </>
      ) : (
        <>
          <h2>{t.crashLegend}</h2>
          <ul className="severity-key">
            {severities.map((severity) => (
              <li key={severity}><SeverityMark severity={severity} /><span>{t[severity]}</span></li>
            ))}
          </ul>
        </>
      )}
      <button className="list-button" type="button" onClick={onList} disabled={!listEnabled}>
        <List size={17} aria-hidden="true" /><span>{t.list}</span><ArrowRight size={15} aria-hidden="true" />
      </button>
    </section>
  );
}

export function StreetAware({ imageryKey, streetsStyle }: { imageryKey: string | null; streetsStyle: string }) {
  const [language, setLanguage] = useState<Language>("bg");
  const [basemap, setBasemap] = useState<Basemap>("streets");
  const [view, setView] = useState<CrashView>("hotspots");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [map, setMap] = useState<MapControls | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [imagery, setImagery] = useState<Imagery | null>(null);
  const [notices, setNotices] = useState<Partial<Record<MapNotice, boolean>>>({});
  const [pointsReady, setPointsReady] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [selected, setSelected] = useState<Crash | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const workspace = useRef<HTMLElement>(null);
  const t = copy[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `Street Aware | ${copy[language].title}`;
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/snapshot", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the snapshot.");
        const item = await response.json() as { snapshot: Snapshot | null };
        if (controller.signal.aborted) return;
        setSnapshot(item.snapshot);
        setLoad("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setLoad("error"); });
    return () => controller.abort();
  }, [attempt]);

  const onNotice = useCallback((notice: MapNotice, show: boolean) => {
    setNotices((previous) => Boolean(previous[notice]) === show ? previous : { ...previous, [notice]: show });
  }, []);

  const rememberFocus = useCallback(() => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active :
      workspace.current?.querySelector<HTMLButtonElement>(".list-button") ?? workspace.current;
  }, []);

  const openList = useCallback((area: ListPanel["area"], bounds: Bounds | null) => {
    if (!panel) rememberFocus();
    setSelected(null);
    setPanel({ kind: "list", area, bounds });
  }, [panel, rememberFocus]);

  const openCrash = useCallback((id: number) => {
    if (!panel) rememberFocus();
    setSelected(null);
    setPanel({ kind: "detail", id, back: panel?.kind === "list" ? panel : panel?.back ?? null });
  }, [panel, rememberFocus]);

  const closePanel = useCallback(() => {
    setPanel(null);
    setSelected(null);
    requestAnimationFrame(() => {
      const target = opener.current?.isConnected ? opener.current : workspace.current;
      target?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, closePanel]);

  const unavailableRows = snapshot ? snapshot.sourceCount - snapshot.mappedCount : 0;
  const canList = Boolean(snapshot);
  const activeNotice = notices.pointsError ? t.pointsError :
    basemap === "streets" && notices.streetError ? t.streetError :
      basemap === "satellite" && notices.imageryError ? t.imageryError : null;

  return (
    <div className={`app-shell theme-${basemap}`}>
      <a className="skip" href="#workspace">{t.skip}</a>
      <header className="toolbar">
        <button type="button" className="brand" onClick={() => map?.reset()} aria-label={`Street Aware — ${t.reset}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/brand/${basemap}.png`} width="170" height="29" alt="Street Aware" />
        </button>
        <div className="segmented view-switch" role="group" aria-label={t.view}>
          <button type="button" aria-pressed={view === "hotspots"} onClick={() => setView("hotspots")}>
            <span className="hotspot-icon" aria-hidden="true"><i /><i /><i /></span>{t.hot}
          </button>
          <button type="button" aria-pressed={view === "crashes"} onClick={() => setView("crashes")}>
            <LocateFixed size={17} aria-hidden="true" />{t.crashes}
          </button>
        </div>
        <div className="segmented basemap-switch" role="group" aria-label={t.basemap}>
          <button type="button" title={t.streets} aria-label={t.streets} aria-pressed={basemap === "streets"} onClick={() => setBasemap("streets")}>
            <MapIcon size={17} aria-hidden="true" /><span>{t.streets}</span>
          </button>
          <button type="button" title={t.satellite} aria-label={t.satellite} aria-pressed={basemap === "satellite"} onClick={() => setBasemap("satellite")}>
            <Mountain size={17} aria-hidden="true" /><span>{t.satellite}</span>
          </button>
        </div>
        <button type="button" className="language-button" aria-label={t.language}
          onClick={() => setLanguage(language === "bg" ? "en" : "bg")}>
          <Globe2 size={17} aria-hidden="true" />{language === "bg" ? "EN" : "BG"}
        </button>
      </header>

      <main ref={workspace} id="workspace" tabIndex={-1} className="workspace" data-points-ready={pointsReady}>
        <MapCanvas imageryKey={imageryKey} streetsStyle={streetsStyle} basemap={basemap} view={view} language={language} label={t.map}
          snapshotId={snapshot?.id ?? null} selected={selected} onReady={setMap}
          onUnavailable={() => setUnavailable(true)} onImagery={setImagery}
          onPointsReady={setPointsReady}
          onNotice={onNotice} onCrash={openCrash} onOverlap={(bounds) => openList("nearby", bounds)} />
        <section className="map-intro" aria-labelledby="map-title">
          <h1 id="map-title">{t.title}</h1>
          {snapshot && (
            <>
              <p className="period"><CalendarDays size={15} aria-hidden="true" />{dateRange(language, snapshot)}</p>
              <div className="mapped-line">
                <p><strong>{count(language, snapshot.mappedCount)}</strong> {t.mapCount}</p>
                <details className="coverage">
                  <summary aria-label={t.coverage} title={t.coverage}><Info size={17} aria-hidden="true" /></summary>
                  <div className="coverage-content">
                    <h2>{t.coverage}</h2>
                    <dl>
                      <div><dt>{t.total}</dt><dd>{count(language, snapshot.sourceCount)}</dd></div>
                      <div><dt>{t.excluded}</dt><dd>{count(language, unavailableRows)}</dd></div>
                    </dl>
                  </div>
                </details>
              </div>
            </>
          )}
          {load === "loading" && <p className="status-text" role="status">{t.loading}</p>}
          {load === "error" && (
            <div className="status-text" role="status">
              {t.dataError} <button type="button" className="text-button" onClick={() => { setLoad("loading"); setAttempt((n) => n + 1); }}>{t.retry}</button>
            </div>
          )}
          {load === "ready" && !snapshot && <p className="status-text">{t.noSnapshot}</p>}
          {snapshot?.mappedCount === 0 && <p className="status-text">{t.noMapped}</p>}
          {snapshot && snapshot.mappedCount > 0 && !pointsReady && !unavailable && !notices.pointsError && (
            <p className="status-text" role="status">{t.loading}</p>
          )}
        </section>

        {unavailable ? (
          <div className="map-unavailable" role="status">
            <MapIcon size={24} aria-hidden="true" /><p>{t.noMap}</p>
            {canList && <button className="action-button" type="button" onClick={() => openList("country", null)}>{t.list}</button>}
          </div>
        ) : activeNotice ? <p className="map-notice" role="status">{activeNotice}</p> : null}

        <Legend view={view} language={language} listEnabled={canList}
          onList={() => openList(map ? "view" : "country", map?.bounds() ?? null)} />

        {map && (
          <div className="map-navigation">
            <div className="zoom-buttons">
              <button type="button" className="icon-button" aria-label={t.zoomIn} title={t.zoomIn} onClick={() => map.zoom(1)}><Plus size={20} aria-hidden="true" /></button>
              <button type="button" className="icon-button" aria-label={t.zoomOut} title={t.zoomOut} onClick={() => map.zoom(-1)}><Minus size={20} aria-hidden="true" /></button>
            </div>
            <button type="button" className="icon-button reset-button" aria-label={t.reset} title={t.reset}
              onClick={map.reset}><LocateFixed size={19} aria-hidden="true" /></button>
          </div>
        )}
        {panel && snapshot && (
          <CrashDrawer panel={panel} snapshotId={snapshot.id} language={language}
            onClose={closePanel} onOpen={openCrash} onSelect={setSelected}
            onBack={(list) => { setSelected(null); setPanel(list); }}
            onLocate={map ? map.locate : null} />
        )}
      </main>
      <Attribution basemap={basemap} imagery={imagery} language={language} />
    </div>
  );
}
