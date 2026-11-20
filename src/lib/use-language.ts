"use client";

import { useSyncExternalStore } from "react";
import type { Language } from "./language";

const key = "street-aware-language";
const textChanged = "street-aware-language-change";
let fallbackLanguage: Language = "bg";

function subscribe(onChange: () => void) {
  window.addEventListener(textChanged, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(textChanged, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readLanguage(): Language {
  try {
    return window.localStorage.getItem(key) === "en" ? "en" : "bg";
  } catch {
    return fallbackLanguage;
  }
}

function setLanguage(language: Language) {
  fallbackLanguage = language;
  try {
    window.localStorage.setItem(key, language);
  } catch {
    // The in-memory preference still applies when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(textChanged));
}

const initialLanguage = (): Language => "bg";

export function useLanguage() {
  return [useSyncExternalStore(subscribe, readLanguage, initialLanguage), setLanguage] as const;
}
