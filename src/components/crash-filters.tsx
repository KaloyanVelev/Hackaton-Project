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
  type DayOfWeek,
  type PlaceFilter,
  type Severity,
  type TimeOfDay,
} from "@/lib/crashes";
import { availableCrashTypes, copy, crashType, type Language } from "@/lib/language";

export interface CrashFiltersProps {
  language: Language;
  filters: CrashFilters;
  onChange: (filters: CrashFilters) => void;
}

export function CrashFiltersWidget({ language, filters, onChange }: CrashFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  const t = copy[language];
  const activeCount = countActiveFilters(filters);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setTypeMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (typeMenuOpen) {
          setTypeMenuOpen(false);
        } else {
          setIsOpen(false);
          toggleButtonRef.current?.focus({ preventScroll: true });
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, typeMenuOpen]);

  function update(partial: Partial<CrashFilters>) {
    onChange({ ...filters, ...partial });
  }

  function clearAll() {
    onChange({});
    setTypeMenuOpen(false);
  }

  const years = [2024, 2025, 2026] as const;

  return (
    <div ref={containerRef} className="filters-widget">
      <button
        ref={toggleButtonRef}
        type="button"
        className={`filter-toggle-button ${activeCount > 0 ? "has-active" : ""}`}
        aria-expanded={isOpen}
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
        <div className="filter-dropdown" role="dialog" aria-label={t.filters}>
          <div className="filter-dropdown-header">
            <div className="filter-dropdown-title">
              <SlidersHorizontal size={16} aria-hidden="true" />
              <h3>{t.filters}</h3>
              {activeCount > 0 && <span className="filter-badge header-badge">{activeCount}</span>}
            </div>
            <div className="filter-header-actions">
              {activeCount > 0 && (
                <button type="button" className="filter-clear-button" onClick={clearAll}>
                  {t.clearFilters}
                </button>
              )}
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
            {/* 1. Severity */}
            <div className="filter-field">
              <label className="filter-label">{t.filterSeverity}</label>
              <div className="filter-options-grid" role="group">
                <button
                  type="button"
                  className={`filter-option-btn ${!filters.severity ? "selected" : ""}`}
                  onClick={() => update({ severity: null })}
                >
                  {t.all}
                </button>
                {severities.filter((s) => s !== "unknown").map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`filter-option-btn ${filters.severity === s ? "selected" : ""}`}
                    onClick={() => update({ severity: filters.severity === s ? null : (s as Severity) })}
                  >
                    {t[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Time of day */}
            <div className="filter-field">
              <label className="filter-label">{t.filterTimeOfDay}</label>
              <div className="filter-options-grid" role="group">
                <button
                  type="button"
                  className={`filter-option-btn ${!filters.timeOfDay ? "selected" : ""}`}
                  onClick={() => update({ timeOfDay: null })}
                >
                  {t.all}
                </button>
                {timeOfDayOptions.map((time) => (
                  <button
                    key={time}
                    type="button"
                    className={`filter-option-btn ${filters.timeOfDay === time ? "selected" : ""}`}
                    onClick={() => update({ timeOfDay: filters.timeOfDay === time ? null : (time as TimeOfDay) })}
                  >
                    {time === "day" ? t.dayTime : t.nightTime}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Day of week */}
            <div className="filter-field">
              <label className="filter-label">{t.filterDayOfWeek}</label>
              <div className="filter-options-grid" role="group">
                <button
                  type="button"
                  className={`filter-option-btn ${!filters.dayOfWeek ? "selected" : ""}`}
                  onClick={() => update({ dayOfWeek: null })}
                >
                  {t.all}
                </button>
                {dayOfWeekOptions.map((dow) => (
                  <button
                    key={dow}
                    type="button"
                    className={`filter-option-btn ${filters.dayOfWeek === dow ? "selected" : ""}`}
                    onClick={() => update({ dayOfWeek: filters.dayOfWeek === dow ? null : (dow as DayOfWeek) })}
                  >
                    {dow === "weekday" ? t.weekdays : t.weekend}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Crash Type - User specified: own small dropdown, scrollable so it doesn't mess up UX */}
            <div className="filter-field" ref={typeMenuRef}>
              <label className="filter-label">{t.filterCrashType}</label>
              <div className="sub-dropdown">
                <button
                  type="button"
                  className="sub-dropdown-toggle"
                  aria-expanded={typeMenuOpen}
                  aria-haspopup="listbox"
                  onClick={() => setTypeMenuOpen((prev) => !prev)}
                >
                  <span className="sub-dropdown-selected-text">
                    {filters.crashType ? crashType(language, filters.crashType) : t.allTypes}
                  </span>
                  <ChevronDown size={14} aria-hidden="true" className={typeMenuOpen ? "rotated" : ""} />
                </button>

                {typeMenuOpen && (
                  <ul className="scrollable-dropdown-list" role="listbox" tabIndex={-1}>
                    <li>
                      <button
                        type="button"
                        className={`type-option-item ${!filters.crashType ? "selected" : ""}`}
                        onClick={() => {
                          update({ crashType: null });
                          setTypeMenuOpen(false);
                        }}
                      >
                        {t.allTypes}
                      </button>
                    </li>
                    {availableCrashTypes.map((type) => (
                      <li key={type}>
                        <button
                          type="button"
                          className={`type-option-item ${filters.crashType === type ? "selected" : ""}`}
                          onClick={() => {
                            update({ crashType: type });
                            setTypeMenuOpen(false);
                          }}
                        >
                          {crashType(language, type)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* 7. Urban vs Rural Place */}
            <div className="filter-field">
              <label className="filter-label">{t.filterPlace}</label>
              <div className="filter-options-grid" role="group">
                <button
                  type="button"
                  className={`filter-option-btn ${!filters.place ? "selected" : ""}`}
                  onClick={() => update({ place: null })}
                >
                  {t.all}
                </button>
                {placeOptions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`filter-option-btn ${filters.place === p ? "selected" : ""}`}
                    onClick={() => update({ place: filters.place === p ? null : (p as PlaceFilter) })}
                  >
                    {p === "urban" ? t.urban : t.rural}
                  </button>
                ))}
              </div>
            </div>

            {/* 9. Year */}
            <div className="filter-field">
              <label className="filter-label">{t.filterYear}</label>
              <div className="filter-options-grid" role="group">
                <button
                  type="button"
                  className={`filter-option-btn ${!filters.year ? "selected" : ""}`}
                  onClick={() => update({ year: null })}
                >
                  {t.all}
                </button>
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`filter-option-btn ${filters.year === y ? "selected" : ""}`}
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
