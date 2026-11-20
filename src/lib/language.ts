import type { Crash, Snapshot } from "./crashes";

export type Language = "bg" | "en";

const bg = {
  title: "Пътни произшествия в България",
  skip: "Към картата",
  map: "Интерактивна карта на пътните произшествия в България",
  view: "Изглед на произшествията",
  hot: "Горещи точки",
  crashes: "Произшествия",
  basemap: "Вид карта",
  streets: "Улици",
  satellite: "Релеф",
  language: "Switch to English",
  mapCount: "на картата",
  coverage: "Покритие на данните",
  total: "Общо записа",
  excluded: "Без използваема точка в България",
  dataSource: "Данни за ПТП",
  sourceShort: "МВР",
  list: "Списък",
  allList: "Произшествия в България",
  viewList: "Произшествия в изгледа",
  nearbyList: "Произшествия на това място",
  details: "Подробности за произшествието",
  less: "По-малко",
  more: "Повече",
  hotLegend: "Концентрация на произшествия",
  crashLegend: "Тежест на произшествието",
  lessThan: "Приближете, за да видите отделните точки.",
  none: "Без пострадали",
  injury: "С ранени",
  fatal: "Със загинали",
  unknown: "Неизвестна тежест",
  zoomIn: "Приближи",
  zoomOut: "Отдалечи",
  reset: "Покажи цяла България",
  loading: "Зареждане на произшествията…",
  noSnapshot: "Все още няма зареден набор от данни.",
  noMapped: "В този набор няма използваеми точки.",
  dataError: "Данните не можаха да се заредят.",
  pointsError: "Точките не можаха да се заредят. Списъкът остава достъпен.",
  streetError: "Уличната карта е недостъпна. Точките остават видими.",
  imageryError: "Въздушните изображения са недостъпни. Точките остават видими.",
  noMap: "Интерактивната карта е недостъпна на това устройство.",
  retry: "Опитайте отново",
  close: "Затвори",
  back: "Към списъка",
  noRows: "В този изглед няма произшествия.",
  showMore: "Зареди още",
  missing: "Няма данни",
  date: "Дата и час",
  place: "Място",
  type: "Вид произшествие",
  injured: "Ранени",
  deaths: "Загинали",
  point: "Покажи на картата",
  clipped: "изглед само за България",
  elevation: "Релеф от Mapzen",
  mapAttribution: "Източник на картата",
  fixMap: "Поправка на картата",
};

const en: typeof bg = {
  title: "Road crashes in Bulgaria",
  skip: "Skip to map",
  map: "Interactive map of road crashes in Bulgaria",
  view: "Crash view",
  hot: "Hotspots",
  crashes: "Crashes",
  basemap: "Basemap",
  streets: "Streets",
  satellite: "Terrain",
  language: "Превключи на български",
  mapCount: "crashes mapped",
  coverage: "Data coverage",
  total: "Total records",
  excluded: "Without a usable point in Bulgaria",
  dataSource: "Crash data",
  sourceShort: "Interior Ministry",
  list: "Crash list",
  allList: "Crashes in Bulgaria",
  viewList: "Crashes in view",
  nearbyList: "Crashes at this location",
  details: "Crash details",
  less: "Fewer",
  more: "More",
  hotLegend: "Crash concentration",
  crashLegend: "Crash severity",
  lessThan: "Zoom in to see individual crashes.",
  none: "No injuries or deaths",
  injury: "Injuries",
  fatal: "Fatalities",
  unknown: "Unknown severity",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  reset: "Show all of Bulgaria",
  loading: "Loading crashes…",
  noSnapshot: "A crash snapshot is yet to be loaded.",
  noMapped: "This snapshot has no usable map points.",
  dataError: "Crash data could not load.",
  pointsError: "Map points could not load. The list is still available.",
  streetError: "Street tiles are unavailable. Crash points are still visible.",
  imageryError: "Aerial imagery is unavailable. Crash points are still visible.",
  noMap: "The interactive map is unavailable on this device.",
  retry: "Try again",
  close: "Close",
  back: "Back to list",
  noRows: "There are no crashes in this view.",
  showMore: "Show more",
  missing: "Unavailable",
  date: "Date and time",
  place: "Location",
  type: "Crash type",
  injured: "Injured",
  deaths: "Deaths",
  point: "Show on map",
  clipped: "display clipped to Bulgaria",
  elevation: "Mapzen elevation",
  mapAttribution: "Map attribution",
  fixMap: "Report a map issue",
};

export const copy = { bg, en };
const locales = { bg: "bg-BG", en: "en-GB" };

const englishTypes: Record<string, string> = {
  "сблъскване между МПС странично": "Sideswipe collision",
  "сблъскване между МПС отзад": "Rear-end collision",
  "блъскане на паркирано ППС": "Collision with a parked vehicle",
  "сблъскване между МПС под ъгъл": "Angle collision",
  "блъскане в крайпътно съоръжение": "Collision with a roadside structure",
  "друг вид ПТП": "Other crash",
  "блъскане на спряно ППС": "Collision with a stopped vehicle",
  "блъскане в предпазна ограда": "Collision with a guardrail",
  "блъскане на пешеходец": "Pedestrian struck",
  "блъскане в дърво": "Collision with a tree",
  "преобръщане на МПС извън пътното платно": "Vehicle rollover off the road",
  "блъскане на животно": "Collision with an animal",
  "блъскане в препятствие на пътя": "Collision with a road obstruction",
  "блъскане в стълб": "Collision with a pole",
  "сблъскване между МПС челно": "Head-on collision",
  "блъскане в скат": "Collision with an embankment",
  "блъскане на велосипедист": "Cyclist struck",
  "преобръщане на МПС на пътното платно": "Vehicle rollover on the road",
  "падане на пътник": "Passenger fall",
  "блъскане в подпорна колона": "Collision with a support column",
  "блъскане на каруца": "Collision with a horse-drawn cart",
  "блъскане в билборд": "Collision with a billboard",
  "блъскане на ППС и влак": "Road vehicle and train collision",
  "блъскане на лице работещо на пътя": "Road worker struck",
  "блъскане на дете с летни кънки, ролер, шейна": "Child on skates, rollerblades or a sled struck",
};

export function crashType(language: Language, value: string | null) {
  if (value === null) return copy[language].missing;
  return language === "en" && Object.hasOwn(englishTypes, value) ? englishTypes[value] : value;
}

export function count(language: Language, value: number) {
  return new Intl.NumberFormat(locales[language]).format(value);
}

export function dateRange(language: Language, snapshot: Snapshot) {
  if (!snapshot.firstAt || !snapshot.lastAt) return copy[language].missing;
  const format = new Intl.DateTimeFormat(locales[language], { dateStyle: "medium", timeZone: "UTC" });
  // Format recorded wall times without converting them through the browser's time zone.
  return format.formatRange(new Date(snapshot.firstAt + "Z"), new Date(snapshot.lastAt + "Z"));
}

export function localDate(language: Language, value: string | null) {
  if (!value) return copy[language].missing;
  return new Intl.DateTimeFormat(locales[language], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value + "Z"));
}

export function crashPlace(crash: Crash) {
  const parts = [crash.location, crash.municipality, crash.region].filter((part) => part !== null);
  return [...new Set(parts)].join(", ");
}
