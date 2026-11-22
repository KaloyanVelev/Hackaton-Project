"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, BarChart3, CalendarDays, ChevronDown, ChevronUp, Github, Globe2, Info, List, LocateFixed, Map as MapIcon, MapPin, Minus, Mountain, Plus, Route } from "lucide-react";
import { type Bounds, type Crash, type Snapshot, severities } from "@/lib/crashes";
import { copy, count, dateRange, type Language } from "@/lib/language";
import { useLanguage } from "@/lib/use-language";
import type { Basemap, CrashView, Imagery } from "@/lib/map-style";
import type { TripResult } from "@/lib/trip";
import { tripCopy } from "@/lib/trip-copy";
import { CrashDrawer, SeverityMark, type ListPanel, type Panel } from "./crash-drawer";
import { MapCanvas, type MapControls, type MapNotice } from "./map-canvas";
import { StatsDropdown } from "./stats-dropdown";
import { TripPlanner } from "./trip-planner";

const repositoryUrl = "https://github.com/KaloyanVelev/Hackaton-Project";

function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const isOffline = () => !navigator.onLine;
const serverIsOffline = () => false;

function Attribution({ basemap, imagery, language }: { basemap: Basemap; imagery: Imagery | null; language: Language }) {
  const t = copy[language];
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const visible = hovered || expanded;
  const provider = basemap === "streets" ? "© OpenStreetMap" :
    imagery === "maptiler" ? "© MapTiler" :
      imagery === "copernicus" ? "Copernicus · EEA" :
        imagery === "eox" ? "© EOX" : t.elevation;

  return (
    <footer className="map-footer">
      <div className="map-footer-brand">
        {basemap === "satellite" && imagery === "maptiler" && (
          <a href="https://www.maptiler.com/" className="maptiler-logo" target="_blank" rel="noreferrer">
            {/* The free plan requires the linked logo in the lower-left corner. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="MapTiler" src="https://api.maptiler.com/resources/logo.svg" height="16" />
          </a>
        )}
      </div>
      <a className="map-repo-link" href={repositoryUrl} target="_blank" rel="noreferrer">
        <Github size={15} aria-hidden="true" />
        Check our repo
      </a>
      <div className="map-credits"
        onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") setHovered(false); }}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && visible) {
            event.stopPropagation();
            setHovered(false);
            setExpanded(false);
            trigger.current?.focus();
          }
        }}>
        <button ref={trigger} type="button" className="map-credits-trigger" aria-label={`${t.mapAttribution} · ${provider}`}
          aria-expanded={visible} aria-controls="map-credits-panel"
          onClick={(event) => {
            if (event.detail === 0 || !window.matchMedia("(hover: hover)").matches ||
                (event.nativeEvent instanceof PointerEvent && event.nativeEvent.pointerType !== "mouse")) {
              setExpanded((open) => !open);
            }
          }}>
          {provider}
        </button>
        <div id="map-credits-panel" className="tile-credit" aria-label={t.mapAttribution} hidden={!visible}>
          {basemap === "streets" ? (
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
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
            <span className="heatmap-scale" aria-hidden="true" />
            <span>{t.more}</span>
          </div>
          <p className="hotspot-hint">{t.selectHotspot}</p>
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
  const [language, setLanguage] = useLanguage();
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
  const [tripOpen, setTripOpen] = useState(false);
  const [trip, setTrip] = useState<TripResult | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [introCollapsed, setIntroCollapsed] = useState(false);
  const statsBoundary = useRef<HTMLDivElement>(null);
  const statsTrigger = useRef<HTMLButtonElement>(null);
  const closeStats = useCallback(() => setShowStats(false), []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("street-aware-intro-collapsed");
      if (saved !== null) {
        setIntroCollapsed(saved === "true");
      }
    } catch {
      // LocalStorage access may be restricted
    }
  }, []);

  const toggleIntro = useCallback((collapsed: boolean) => {
    setIntroCollapsed(collapsed);
    try {
      window.localStorage.setItem("street-aware-intro-collapsed", String(collapsed));
    } catch {
      // LocalStorage access may be restricted
    }
  }, []);
  const offline = useSyncExternalStore(subscribeToConnection, isOffline, serverIsOffline);
  const opener = useRef<HTMLElement | null>(null);
  const tripButton = useRef<HTMLButtonElement>(null);
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
    setTripOpen(false);
    setTrip(null);
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

  const closeTrip = useCallback(() => {
    setTripOpen(false);
    setTrip(null);
    requestAnimationFrame(() => tripButton.current?.focus({ preventScroll: true }));
  }, []);

  function toggleTrip() {
    if (tripOpen) {
      closeTrip();
      return;
    }
    setPanel(null);
    setSelected(null);
    setTripOpen(true);
  }

  function returnToMapOnMobile() {
    if (window.matchMedia("(max-width: 620px)").matches) {
      setPanel(null);
      requestAnimationFrame(() => {
        const canvas = workspace.current?.querySelector<HTMLCanvasElement>(".maplibregl-canvas");
        (canvas ?? workspace.current)?.focus({ preventScroll: true });
      });
    }
  }

  function locateCrash(crash: Crash) {
    map?.locate(crash);
    returnToMapOnMobile();
  }

  function zoomToArea(bounds: Bounds) {
    map?.zoomToArea(bounds);
    returnToMapOnMobile();
  }

  useEffect(() => {
    if (!panel && !tripOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (tripOpen) closeTrip();
        else closePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, tripOpen, closePanel, closeTrip]);

  const unavailableRows = snapshot ? snapshot.sourceCount - snapshot.mappedCount : 0;
  const canList = Boolean(snapshot);
  const activeList = panel?.kind === "detail" ? panel.back : panel;
  const selectedArea = view === "hotspots" && activeList?.area === "hotspot" ? activeList.bounds : null;
  const activeNotice = offline ? t.offline : notices.pointsError ? t.pointsError :
    basemap === "streets" && notices.streetError ? t.streetError :
      basemap === "satellite" && notices.imageryError ? t.imageryError : null;

  return (
    <div className={`app-shell theme-${basemap}${trip ? " trip-result-visible" : ""}`}>
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
        <div className="toolbar-end" ref={statsBoundary}>
          <button type="button" className="language-button" aria-label={t.language}
            onClick={() => setLanguage(language === "bg" ? "en" : "bg")}>
            <Globe2 size={17} aria-hidden="true" />{language === "bg" ? "EN" : "BG"}
          </button>
          <button ref={statsTrigger} type="button" className={`stats-toggle-button ${showStats ? "active" : ""}`}
            aria-label={t.stats} title={t.stats} aria-expanded={showStats}
            aria-controls={showStats ? "stats-dropdown" : undefined}
            onClick={() => setShowStats((prev) => !prev)}>
            <BarChart3 size={17} aria-hidden="true" />
            <span className="stats-button-label">{t.stats}</span>
          </button>
          {showStats && (
            <StatsDropdown
              language={language}
              snapshotId={snapshot?.id ?? null}
              boundaryRef={statsBoundary} triggerRef={statsTrigger} onClose={closeStats}
            />
          )}
        </div>
      </header>

      <main ref={workspace} id="workspace" tabIndex={-1} className="workspace" data-points-ready={pointsReady}>
        <MapCanvas imageryKey={imageryKey} streetsStyle={streetsStyle} basemap={basemap} view={view} language={language} label={t.map}
          snapshotId={snapshot?.id ?? null} selected={selected} selectedArea={selectedArea}
          trip={trip} inspectCrashes={!tripOpen} onReady={setMap}
          onUnavailable={() => setUnavailable(true)} onImagery={setImagery}
          onPointsReady={setPointsReady}
          onNotice={onNotice} onCrash={openCrash} onHotspot={(bounds) => openList("hotspot", bounds)}
          onOverlap={(bounds) => openList("nearby", bounds)} />
        {introCollapsed ? (
          <section className="map-intro is-collapsed" aria-label={t.title}>
            <button
              type="button"
              className="map-intro-pill"
              onClick={() => toggleIntro(false)}
              aria-expanded="false"
              aria-label={`${t.title}: ${snapshot ? count(language, snapshot.mappedCount) : ""} ${t.mapCount}. ${t.expandIntro}`}
              title={t.expandIntro}
            >
              <MapPin size={15} className="intro-pill-icon" aria-hidden="true" />
              <span className="intro-pill-text">
                <strong>{snapshot ? count(language, snapshot.mappedCount) : "..."}</strong> {t.mapCount}
              </span>
              <ChevronDown size={15} className="intro-pill-chevron" aria-hidden="true" />
            </button>
          </section>
        ) : (
          <section className="map-intro" aria-labelledby="map-title">
            <div className="map-intro-header">
              <h1 id="map-title">{t.title}</h1>
              <button
                type="button"
                className="intro-collapse-btn"
                onClick={() => toggleIntro(true)}
                aria-expanded="true"
                aria-label={t.collapseIntro}
                title={t.collapseIntro}
              >
                <ChevronUp size={18} aria-hidden="true" />
              </button>
            </div>
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
        )}

        {unavailable ? (
          <div className="map-unavailable" role="status">
            <MapIcon size={24} aria-hidden="true" /><p>{offline ? t.offline : t.noMap}</p>
            {canList && <button className="action-button" type="button" onClick={() => openList("country", null)}>{t.list}</button>}
          </div>
        ) : (
          <div role="status">{activeNotice && <p className="map-notice">{activeNotice}</p>}</div>
        )}

        {!trip && <Legend view={view} language={language} listEnabled={canList}
          onList={() => openList(map ? "view" : "country", map?.bounds() ?? null)} />}

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
            onLocate={map ? locateCrash : null} onZoomArea={map ? zoomToArea : null} />
        )}
        {tripOpen && <TripPlanner language={language} result={trip} onResult={setTrip} onClose={closeTrip} />}
      </main>
      <div className="trip-dock">
        <button ref={tripButton} type="button" className="trip-primary" aria-expanded={tripOpen}
          aria-controls={tripOpen ? "trip-planner" : undefined} onClick={toggleTrip}>
          <Route size={18} aria-hidden="true" />{tripCopy[language].button}
        </button>
      </div>
      <Attribution basemap={basemap} imagery={imagery} language={language} />
    </div>
  );
}
