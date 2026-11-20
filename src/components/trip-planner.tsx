"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Route, X } from "lucide-react";
import { copy, type Language } from "@/lib/language";
import { tripPrototype, type TripCity, type TripRequest, type TripResult } from "@/lib/trip";
import { tripCopy } from "@/lib/trip-copy";
import cityData from "../../public/maps/bg-trip-cities.json";

const cities = cityData as TripCity[];
const cityOptions = Object.fromEntries((["bg", "en"] as const).map((language) => {
  const collator = new Intl.Collator(language);
  return [language, cities.map(([id, bg, en]) => ({ id, name: language === "bg" ? bg : en }))
    .sort((a, b) => collator.compare(a.name, b.name))];
})) as Record<Language, Array<{ id: number; name: string }>>;

type ErrorCode = "samePlace" | "invalidTrip" | "routeBusy" | "noRoute" | "routeUnavailable" | "noEvidence" | "failed";
const serverErrors = new Set(["invalidTrip", "routeBusy", "noRoute", "routeUnavailable", "noEvidence"]);

export function TripPlanner({ language, result, onResult, onClose }: {
  language: Language;
  result: TripResult | null;
  onResult: (result: TripResult | null) => void;
  onClose: () => void;
}) {
  const t = tripCopy[language];
  const locale = language === "bg" ? "bg-BG" : "en-GB";
  const numbers = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const kilometers = new Intl.NumberFormat(locale, { style: "unit", unit: "kilometer", maximumFractionDigits: 1 });
  const minutes = new Intl.NumberFormat(locale, { style: "unit", unit: "minute", maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const days = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  const months = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
  const heading = useRef<HTMLHeadingElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const pending = useRef<AbortController | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [hour, setHour] = useState(17);
  const [weekday, setWeekday] = useState(5);
  const [month, setMonth] = useState(11);
  const [pointCount, setPointCount] = useState(String(tripPrototype.defaultPoints));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);

  useEffect(() => {
    heading.current?.focus();
    return () => pending.current?.abort();
  }, []);

  useEffect(() => {
    if (result) resultsHeading.current?.focus();
  }, [result]);

  function changeField<T>(setValue: (value: T) => void, value: T) {
    setValue(value);
    setError(null);
    if (result) onResult(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError(null);
    if (!origin || !destination) return setError("invalidTrip");
    if (origin === destination) return setError("samePlace");

    const input: TripRequest = { start: Number(origin), end: Number(destination), hour, weekday, month, points: Number(pointCount) };
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    onResult(null);
    try {
      const response = await fetch("/api/trips", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input), signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        const code = body?.error;
        if (!controller.signal.aborted) setError(code && serverErrors.has(code) ? code as ErrorCode : "failed");
        return;
      }
      const trip = await response.json() as TripResult;
      if (!controller.signal.aborted) onResult(trip);
    } catch {
      if (!controller.signal.aborted) setError("failed");
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <aside className="drawer trip-panel" id="trip-planner" aria-labelledby="trip-title">
      <div className="drawer-header">
        <h2 id="trip-title" ref={heading} tabIndex={-1}>{t.title}</h2>
        <button className="icon-button drawer-close" type="button" aria-label={copy[language].close} onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="drawer-body trip-body">
        {!result && <p className="trip-context">{t.learn}</p>}
        <form onSubmit={submit} className="trip-form" aria-busy={busy}>
          <div className="trip-places">
            <label className="trip-field">
              <span>{t.origin}</span>
              <select required value={origin} disabled={busy} onChange={(event) => changeField(setOrigin, event.target.value)}>
                <option value="">{t.chooseCity}</option>
                {cityOptions[language].map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label className="trip-field">
              <span>{t.destination}</span>
              <select required value={destination} disabled={busy} onChange={(event) => changeField(setDestination, event.target.value)}>
                <option value="">{t.chooseCity}</option>
                {cityOptions[language].map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          </div>
          <div className="trip-conditions">
            <label className="trip-field">
              <span>{t.hour}</span>
              <select value={hour} disabled={busy} onChange={(event) => changeField(setHour, Number(event.target.value))}>
                {Array.from({ length: 24 }, (_, value) => (
                  <option key={value} value={value}>{String(value).padStart(2, "0")}:00</option>
                ))}
              </select>
            </label>
            <label className="trip-field">
              <span>{t.weekday}</span>
              <select value={weekday} disabled={busy} onChange={(event) => changeField(setWeekday, Number(event.target.value))}>
                {Array.from({ length: 7 }, (_, index) => (
                  <option key={index} value={index + 1}>{days.format(Date.UTC(2024, 0, index + 1))}</option>
                ))}
              </select>
            </label>
            <label className="trip-field">
              <span>{t.month}</span>
              <select value={month} disabled={busy} onChange={(event) => changeField(setMonth, Number(event.target.value))}>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index} value={index + 1}>{months.format(Date.UTC(2024, index, 1))}</option>
                ))}
              </select>
            </label>
            <label className="trip-field">
              <span>{t.points}</span>
              <input type="number" min={tripPrototype.minimumPoints} max={tripPrototype.maximumPoints}
                value={pointCount} disabled={busy} required onChange={(event) => changeField(setPointCount, event.target.value)} />
            </label>
          </div>
          <button type="submit" className="trip-primary" disabled={busy}>
            <Route size={17} aria-hidden="true" />{t.submit}
          </button>
          {busy && <p className="trip-hint" role="status">{t.loading}</p>}
          {error && <p className="trip-error" role="alert">{t[error]}</p>}
        </form>

        {result && (
          <section className="trip-results" aria-labelledby="trip-results">
            <h3 ref={resultsHeading} id="trip-results" tabIndex={-1}>{t.results}</h3>
            <p className="trip-hint">{kilometers.format(result.distanceKm)} · {minutes.format(result.durationMinutes)}</p>
            <p className="trip-hint trip-meaning">{t.learn}</p>
            <dl className="trip-metrics">
              <div><dt>{t.max}</dt><dd>{percent.format(result.maximum)}</dd></div>
              <div><dt>{t.average}</dt><dd>{percent.format(result.average)}</dd></div>
            </dl>
            <table className="trip-table">
              <thead><tr><th scope="col">{t.point}</th><th scope="col">{t.distance}</th>
                <th scope="col">{t.evidence}</th><th scope="col">{t.probability}</th></tr></thead>
              <tbody>{result.points.map((point) => (
                <tr key={point.number}>
                  <th scope="row">{point.number}</th>
                  <td>{kilometers.format(point.distanceKm)}</td>
                  <td title={point.majorCrashes === 0 ? t.national : undefined}>{numbers.format(point.majorCrashes)}</td>
                  <td>{percent.format(point.probability)}</td>
                </tr>
              ))}</tbody>
            </table>
            <p className="trip-hint">{t.methodology}</p>
          </section>
        )}
        <div className="trip-credits">
          <p className="trip-hint">{t.dataUse}</p>
          <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">{t.routing} © FOSSGIS</a>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
          <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">{copy[language].fixMap}</a>
          <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">{t.places} © GeoNames</a>
        </div>
      </div>
    </aside>
  );
}
