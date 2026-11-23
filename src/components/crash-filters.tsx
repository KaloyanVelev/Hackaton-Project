"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import {
  countActiveFilters,
  dayOfWeekOptions,
  placeOptions,
  severities,
  timeOfDayOptions,
  type CrashFilters,
  type Snapshot,
} from "@/lib/crashes";
import { availableCrashTypes, copy, crashType, type Language } from "@/lib/language";

export interface CrashFiltersProps {
  language: Language;
  snapshot: Snapshot;
  filters: CrashFilters;
  onChange: (filters: CrashFilters) => void;
}

export function CrashFiltersWidget({ language, snapshot, filters, onChange }: CrashFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  const t = copy[language];
  const activeCount = countActiveFilters(filters);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        setIsOpen(false);
        toggleButtonRef.current?.focus({ preventScroll: true });
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function update(partial: Partial<CrashFilters>) {
    onChange({ ...filters, ...partial });
  }

  function clearAll() {
    onChange({});
  }

  const firstYear = Math.max(2000, Number(snapshot.firstAt?.slice(0, 4) ?? 0));
  const lastYear = Math.min(2100, Number(snapshot.lastAt?.slice(0, 4) ?? 0));
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);

  return (
    <div ref={containerRef} className="filters-widget">
      <button
        ref={toggleButtonRef}
        type="button"
        className={`filter-toggle-button ${activeCount > 0 ? "has-active" : ""}`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? "crash-filter-panel" : undefined}
        aria-haspopup="dialog"
        aria-label={`${t.filterButton}${activeCount > 0 ? ` (${activeCount} ${t.activeFilters})` : ""}`}
        title={t.filterButton}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <SlidersHorizontal size={17} aria-hidden="true" />
        <span className="filter-toggle-label">{t.filters}</span>
        {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
      </button>

      {isOpen && (
        <div className="filter-dropdown" id="crash-filter-panel" role="dialog" aria-label={t.filters}>
          <div className="filter-dropdown-header">
            <div className="filter-dropdown-title">
              <SlidersHorizontal size={16} aria-hidden="true" />
              <h3>{t.filters}</h3>
              {activeCount > 0 && <span className="filter-badge header-badge">{activeCount}</span>}
            </div>
            <div className="filter-header-actions">
              <button type="button" className="filter-clear-button" aria-disabled={activeCount === 0} onClick={clearAll}>
                {t.clearFilters}
              </button>
              <button
                type="button"
                className="icon-button filter-close-button"
                aria-label={t.close}
                onClick={() => {
                  setIsOpen(false);
                  toggleButtonRef.current?.focus({ preventScroll: true });
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="filter-dropdown-body">
            <div className="filter-field">
              <span className="filter-label" id="filter-severity">{t.filterSeverity}</span>
              <div className="filter-options-grid" role="group" aria-labelledby="filter-severity">
                <button
                  type="button"
                  className={`filter-option-btn ${!filters.severity ? "selected" : ""}`}
                  aria-pressed={!filters.severity}
                  onClick={() => update({ severity: null })}
                >
                  {t.all}
                </button>
                {severities.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`filter-option-btn ${filters.severity === s ? "selected" : ""}`}
                    aria-pressed={filters.severity === s}
                    onClick={() => update({ severity: filters.severity === s ? null : s })}
                  >
                    {t[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-field">
              <span className="filter-label" id="filter-time">{t.filterTimeOfDay}</span>
              <div className="filter-options-grid" role="group" aria-labelledby="filter-time">
                <button
                  type="button"
                  className={`filter-option-btn ${!filters.timeOfDay ? "selected" : ""}`}
                  aria-pressed={!filters.timeOfDay}
                  onClick={() => update({ timeOfDay: null })}
                >
                  {t.all}
                </button>
                {timeOfDayOptions.map((time) => (
                  <button
                    key={time}
                    type="button"
                    className={`filter-option-btn ${filters.timeOfDay === time ? "selected" : ""}`}
                    aria-pressed={filters.timeOfDay === time}
                    onClick={() => update({ timeOfDay: filters.timeOfDay === time ? null : time })}
                  >
                    {time === "day" ? t.dayTime : t.nightTime}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-field">
              <span className="filter-label" id="filter-day">{t.filterDayOfWeek}</span>
              <div className="filter-options-grid" role="group" aria-labelledby="filter-day">
                <button
                  type="button"
                  className={`filter-option-btn ${!filters.dayOfWeek ? "selected" : ""}`}
                  aria-pressed={!filters.dayOfWeek}
                  onClick={() => update({ dayOfWeek: null })}
                >
                  {t.all}
                </button>
                {dayOfWeekOptions.map((dow) => (
                  <button
                    key={dow}
                    type="button"
                    className={`filter-option-btn ${filters.dayOfWeek === dow ? "selected" : ""}`}
                    aria-pressed={filters.dayOfWeek === dow}
                    onClick={() => update({ dayOfWeek: filters.dayOfWeek === dow ? null : dow })}
                  >
                    {dow === "weekday" ? t.weekdays : t.weekend}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-field">
              <label className="filter-label" htmlFor="filter-type">{t.filterCrashType}</label>
              <div className="sub-dropdown">
                <select
                  id="filter-type"
                  className="sub-dropdown-toggle"
                  value={filters.crashType ?? ""}
                  onChange={(event) => update({ crashType: event.target.value || null })}
                >
                  <option value="">{t.allTypes}</option>
                  {availableCrashTypes.map((type) => <option key={type} value={type}>{crashType(language, type)}</option>)}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </div>
            </div>

            <div className="filter-field">
              <span className="filter-label" id="filter-place">{t.filterPlace}</span>
              <div className="filter-options-grid" role="group" aria-labelledby="filter-place">
                <button
                  type="button"
                  className={`filter-option-btn ${!filters.place ? "selected" : ""}`}
                  aria-pressed={!filters.place}
                  onClick={() => update({ place: null })}
                >
                  {t.all}
                </button>
                {placeOptions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`filter-option-btn ${filters.place === p ? "selected" : ""}`}
                    aria-pressed={filters.place === p}
                    onClick={() => update({ place: filters.place === p ? null : p })}
                  >
                    {p === "urban" ? t.urban : t.rural}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-field">
              <span className="filter-label" id="filter-year">{t.filterYear}</span>
              <div className="filter-options-grid" role="group" aria-labelledby="filter-year">
                <button
                  type="button"
                  className={`filter-option-btn ${!filters.year ? "selected" : ""}`}
                  aria-pressed={!filters.year}
                  onClick={() => update({ year: null })}
                >
                  {t.all}
                </button>
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`filter-option-btn ${filters.year === y ? "selected" : ""}`}
                    aria-pressed={filters.year === y}
                    onClick={() => update({ year: filters.year === y ? null : y })}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
