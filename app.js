import { cities } from "./shared/cities.js";
import { clusterPoints } from "./shared/geo.js";
import { loadLibrary, motionDuration } from "./client/runtime.js";
import { CameraPlayer } from "./client/camera-player.js";

// Estado Global da Aplicação
const state = {
  city: cities[1], // São Paulo, Brasil (padrão inicial e fallback de geolocalização)
  page: "explore",
  kind: "all",
  view: "globe",
  stations: [],
  globalStations: [],
  offset: 0,
  cameras: [],
  station: null,
  camera: null,
  favorites: readStore("radio-atlas-favorites", { stations: [], cameras: [], places: [] }),
  recents: readStore("radio-atlas-journeys", []),
  libraryTab: "stations",
  loadingStations: false,
  loadingCameras: false,
  weather: null,
  weatherLoading: false,
  weatherRequestId: 0,
  airports: [],
  airportsVisible: false,
  activeAirport: null,
  windyMapOpen: false,
  windyMapLayer: "wind",
  windyDetailOpen: true,
  windyMenuOpen: false,
  windySatPalette: "blue",
  windyAirports: false,
  windyWMO: false,
  windyPWS: false,
  windyShipBuoy: false,
  windyPressure: true,
  windyParticles: true,
  map: null,
  mapMarkers: [],
  globe: null,
  searchItems: [],
  searchIndex: 0,
  searchTimer: null,
  toastTimer: null,
  tourTimer: null,
  tourIntervalTimer: null,
  tourCountdown: 12,
  tourIndex: 0,
  isTouring: false,
  mini: false,
  hls: null,
  mapRequestTimer: null,
  cameraConfig: null,
  drawerType: "stations",
  stationRequestId: 0,
  cameraRequestId: 0,
  searchStationResults: [],
  cameraViewportRequestId: 0,
  sleepTimer: null,
  cameraPlayerInstance: null,
  radioGardenPlaces: [],
  radioGardenLoaded: false,
  currentRadioGardenPlace: null,
  isDraggingGlobe: false,
  lastUserInteractionTime: (typeof performance !== "undefined" ? performance.now() : Date.now()),
  tuningDebounceTimer: null,
  tvgarden: {
    countries: [],
    currentCountry: "ALL",
    webcams: [],
    search: "",
    offset: 0,
    limit: 24,
    total: 4033,
    loading: false,
    initialized: false,
    searchTimer: null
  },
  globalWebcamPoints: [],
  globalWebcamPointsLoaded: false,
  globalTvPoints: [],
  globalTvPointsLoaded: false,
  tvChannels: [],
  loadingTvChannels: false,
  tv: {
    countries: [],
    currentCountry: "ALL",
    channels: [],
    search: "",
    offset: 0,
    limit: 24,
    total: 6768,
    loading: false,
    initialized: false,
    searchTimer: null
  },
  mapTilerKey: (typeof localStorage !== "undefined" ? localStorage.getItem("MAPTILER_API_KEY") : "") || "fVnSiLiMILfAw3T6c5YJ",
  mapTilerStyle: "hybrid-v4",
  autoRotatePaused: false
};

const DEFAULT_MAPTILER_KEY = "fVnSiLiMILfAw3T6c5YJ";

const $ = (id) => document.getElementById(id);
const audio = $("audioPlayer");

const cityName = (city) => city?.name || "Mundo";
const cityCountryLine = (city) =>
  (city?.country || "").toLocaleUpperCase("pt-BR") + " · " +
  Math.abs(city?.lat || 0).toFixed(2) + "° " + ((city?.lat || 0) >= 0 ? "N" : "S") + ", " +
  Math.abs(city?.lon || 0).toFixed(2) + "° " + ((city?.lon || 0) >= 0 ? "E" : "W");

const COUNTRY_NAME_TO_CODE = {
  "united states": "US", "usa": "US", "estados unidos": "US", "us": "US",
  "brazil": "BR", "brasil": "BR", "br": "BR",
  "japan": "JP", "japão": "JP", "jp": "JP",
  "united kingdom": "GB", "reino unido": "GB", "great britain": "GB", "uk": "GB", "gb": "GB",
  "germany": "DE", "alemanha": "DE", "de": "DE",
  "france": "FR", "frança": "FR", "fr": "FR",
  "italy": "IT", "itália": "IT", "it": "IT",
  "spain": "ES", "espanha": "ES", "es": "ES",
  "canada": "CA", "canadá": "CA", "ca": "CA",
  "australia": "AU", "austrália": "AU", "au": "AU",
  "austria": "AT", "áustria": "AT", "at": "AT",
  "switzerland": "CH", "suíça": "CH", "ch": "CH",
  "netherlands": "NL", "holanda": "NL", "países baixos": "NL", "nl": "NL",
  "portugal": "PT", "pt": "PT",
  "russia": "RU", "rússia": "RU", "ru": "RU",
  "china": "CN", "cn": "CN",
  "india": "IN", "índia": "IN", "in": "IN",
  "south korea": "KR", "coreia do sul": "KR", "kr": "KR",
  "mexico": "MX", "méxico": "MX", "mx": "MX",
  "argentina": "AR", "ar": "AR",
  "chile": "CL", "cl": "CL",
  "colombia": "CO", "colômbia": "CO", "co": "CO",
  "peru": "PE", "pe": "PE",
  "south africa": "ZA", "áfrica do sul": "ZA", "za": "ZA",
  "turkey": "TR", "turquia": "TR", "tr": "TR",
  "greece": "GR", "grécia": "GR", "gr": "GR",
  "sweden": "SE", "suécia": "SE", "se": "SE",
  "norway": "NO", "noruega": "NO", "no": "NO",
  "denmark": "DK", "dinamarca": "DK", "dk": "DK",
  "finland": "FI", "finlândia": "FI", "fi": "FI",
  "poland": "PL", "polônia": "PL", "pl": "PL",
  "belgium": "BE", "bélgica": "BE", "be": "BE",
  "czech republic": "CZ", "república tcheca": "CZ", "cz": "CZ",
  "ireland": "IE", "irlanda": "IE", "ie": "IE",
  "new zealand": "NZ", "nova zelândia": "NZ", "nz": "NZ",
  "indonesia": "ID", "indonésia": "ID", "id": "ID",
  "philippines": "PH", "filipinas": "PH", "ph": "PH",
  "thailand": "TH", "tailândia": "TH", "th": "TH",
  "vietnam": "VN", "vietnã": "VN", "vn": "VN",
  "egypt": "EG", "egito": "EG", "eg": "EG",
  "morocco": "MA", "marrocos": "MA", "ma": "MA",
  "ukraine": "UA", "ucrânia": "UA", "ua": "UA"
};

function getCountryCode(countryName) {
  if (!countryName) return "";
  const clean = String(countryName).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (COUNTRY_NAME_TO_CODE[clean]) return COUNTRY_NAME_TO_CODE[clean];
  if (/^[a-z]{2}$/i.test(clean)) return clean.toUpperCase();
  for (const [key, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (clean.includes(key) || key.includes(clean)) return code;
  }
  return "";
}

const COUNTRY_FLAGS = {
  US: "🇺🇸", JP: "🇯🇵", IT: "🇮🇹", NL: "🇳🇱", ES: "🇪🇸", GB: "🇬🇧", UK: "🇬🇧",
  CA: "🇨🇦", MX: "🇲🇽", TW: "🇹🇼", CZ: "🇨🇿", BR: "🇧🇷", DE: "🇩🇪", FR: "🇫🇷",
  AU: "🇦🇺", CH: "🇨🇭", AT: "🇦🇹", PT: "🇵🇹", NO: "🇳🇴", SE: "🇸🇪", KR: "🇰🇷",
  AR: "🇦🇷", CL: "🇨🇱", ZA: "🇿🇦", TR: "🇹🇷", GR: "🇬🇷", IS: "🇮🇸", RO: "🇷🇴",
  IE: "🇮🇪", BE: "🇧🇪", NZ: "🇳🇿", PL: "🇵🇱", FI: "🇫🇮", DK: "🇩🇰", IL: "🇮🇱",
  IN: "🇮🇳", CN: "🇨🇳", RU: "🇷🇺", AE: "🇦🇪", EG: "🇪🇬", TH: "🇹🇭", CO: "🇨🇴"
};

function getWebcamThumbnail(cam) {
  if (cam.thumbnail) return cam.thumbnail;
  if (cam.embedUrl) {
    const match = cam.embedUrl.match(/(?:embed\/|vi\/|v=)([a-zA-Z0-9_-]{11})/);
    if (match) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
  }
  return "";
}

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

const textMatch = (a, b) =>
  String(a || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .includes(
      String(b || "")
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    );

function readStore(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showToast("Armazenamento local temporariamente indisponível.");
  }
}

async function request(path) {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível carregar os dados.");
  return body;
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

// 23. HORÁRIO LOCAL E CLIMA ATMOSFÉRICO (DAY / SUNSET / NIGHT) DINÂMICO
function getAtmosphere(city) {
  if (!city) return { type: "night", label: "NOITE", icon: "🌙" };
  let hour = 12;
  try {
    if (city.timezone && city.timezone !== "UTC") {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: city.timezone,
        hour: "numeric",
        hour12: false
      });
      hour = parseInt(formatter.format(new Date()), 10);
    } else if (city.lon != null) {
      // Cálculo astronômico da hora solar pelo meridiano: 360° = 24h -> 1° = 4 minutos
      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
      const localDate = new Date(utcTime + city.lon * 4 * 60 * 1000);
      hour = localDate.getHours();
    }
  } catch {
    hour = 12;
  }

  if (hour >= 6 && hour < 18) {
    return { type: "day", label: "DIA", icon: "☀️" };
  } else if (hour >= 18 && hour < 20) {
    return { type: "sunset", label: "PÔR DO SOL", icon: "🌅" };
  } else {
    return { type: "night", label: "NOITE", icon: "🌙" };
  }
}

function localTime(city) {
  if (!city) return "--:--";
  try {
    if (city.timezone && city.timezone !== "UTC") {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: city.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date());
    }
  } catch {}

  // Se não houver timezone IANA ou for UTC, calcula a hora local exata por longitude solar
  if (city.lon != null) {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const localDate = new Date(utcTime + city.lon * 4 * 60 * 1000);
    const h = String(localDate.getHours()).padStart(2, "0");
    const m = String(localDate.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  return "--:--";
}

function distanceKm(latA, lonA, latB, lonB) {
  const rad = (val) => (val * Math.PI) / 180;
  const dLat = rad(latB - latA);
  const dLon = rad(lonB - lonA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// RENDERIZAÇÃO DOS DESTINOS
function renderDestinations() {
  const rail = $("destinationRail");
  if (rail) {
    rail.innerHTML = cities
      .slice(0, 10)
      .map(
        (city) =>
          `<button class="destination-card${state.city.id === city.id ? " selected" : ""}" data-city="${city.id}">
            <span class="country-chip">${escapeHtml(city.countryCode)}</span>
            <span class="destination-info">
              <strong>${escapeHtml(city.name)}</strong>
              <small>${escapeHtml(city.country)}</small>
            </span>
            <span class="destination-arrow">↗</span>
          </button>`
      )
      .join("");

    rail.querySelectorAll("[data-city]").forEach((button) =>
      button.addEventListener("click", () => selectCity(button.dataset.city))
    );
  }

  const liveList = $("liveDestinations");
  if (liveList) {
    liveList.innerHTML = cities
      .map(
        (city) =>
          `<button class="live-city${city.id === state.city.id ? " active" : ""}" data-city="${city.id}">
            ${escapeHtml(city.name)} <span>· ${escapeHtml(city.country)}</span>
          </button>`
      )
      .join("");

    liveList.querySelectorAll("[data-city]").forEach((button) =>
      button.addEventListener("click", () => selectCity(button.dataset.city))
    );
  }
}

// ATUALIZAÇÃO EDITORIAL DO HERO
function updateCityCopy() {
  const city = state.city;
  $("cityTitle").innerHTML = escapeHtml(cityName(city)) + '<span class="title-period">.</span>';
  $("cityCoordinates").textContent = cityCountryLine(city);

  const savedPlace = state.favorites.places.some((item) => item.id === city.id);
  $("favoritePlace").classList.toggle("saved", savedPlace);
  $("favoritePlace").textContent = savedPlace ? "♥" : "♡";

  // Horário Local e Atmosfera
  const timeStr = localTime(city);
  $("localClock").textContent = timeStr + " LOCAL";
  $("cameraLocalTime").textContent = timeStr + " LOCAL";

  renderWeather();

  if ($("globeCityName")) $("globeCityName").textContent = (city.english || city.name).toLocaleUpperCase("pt-BR");
  $("drawerTitle").textContent =
    (state.drawerType === "cameras" ? "Câmeras em " : (state.drawerType === "tv" ? "Canais de TV em " : "Rádios em ")) + city.name;

  if (!state.camera) {
    $("heroEyebrow").textContent = "PRÓXIMO DESTINO";
    $("editorialCopy").textContent =
      `Sintonize as frequências e assista às transmissões públicas de ${city.name} agora em tempo real.`;
  }
}

// SELEÇÃO DE CIDADE
function selectCity(id, options = {}) {
  const city = cities.find((item) => item.id === id);
  if (!city) return;
  const changed = state.city.id !== city.id;
  state.city = city;

  if (changed) {
    state.stationRequestId += 1;
    state.cameraRequestId += 1;
    state.weatherRequestId += 1;
    state.loadingStations = false;
    state.stations = [];
    state.offset = 0;
    state.cameras = [];
    state.camera = null;
    state.weather = null;

    $("cameraFrame").innerHTML = "";
    $("miniFrame").innerHTML = "";
    $("miniPlayer").classList.add("hidden");
    $("stationDrawer").classList.add("hidden");
    $("cameraPanel").classList.add("hidden");
    $("cameraContext").classList.add("hidden");
    $("worldStage").classList.remove("camera-active");
    $("backToGlobe").classList.add("hidden");
    $("mapLegend").classList.remove("hidden");
    $("featuredStationName").textContent = "Sintonizando frequência local...";
    $("stationCount").textContent = "—";
    $("cameraCount").textContent = "—";
    $("tvCount").textContent = "—";
    $("metricStationCount").textContent = "—";
    $("metricCameraCount").textContent = "—";
    $("metricTvCount").textContent = "—";
  }

  updateCityCopy();
  if (changed) recordJourney("place", city);
  renderDestinations();

  // Movimento da Câmera no Globo ou Mapa
  const duration = options.instant ? 0 : 1400;
  if (state.globe) {
    state.globe.pointOfView(
      { lat: city.lat, lng: city.lon, altitude: state.view === "globe" ? 1.6 : 0.8 },
      duration
    );
  }
  if (state.map) {
    state.map.flyTo({ center: [city.lon, city.lat], zoom: 10.5, duration });
  }

  if (changed || !state.stations.length) loadStations(false);
  loadCameras();
  loadTvChannels();
  loadWeather();
  if (state.windyMapOpen) updateWindyMap();
}

// INTEGRAÇÃO WINDY POINT FORECAST (PREVISÃO METEOROLÓGICA)
async function loadWeather() {
  const city = state.city;
  if (!city || city.lat == null || city.lon == null) return;
  const requestId = ++state.weatherRequestId;
  state.weatherLoading = true;

  try {
    const data = await request(`/api/weather?lat=${encodeURIComponent(city.lat)}&lon=${encodeURIComponent(city.lon)}`);
    if (requestId !== state.weatherRequestId || city.id !== state.city.id) return;
    state.weather = data;
    renderWeather();
  } catch (err) {
    if (requestId !== state.weatherRequestId || city.id !== state.city.id) return;
    state.weather = null;
    renderWeather();
  } finally {
    if (requestId === state.weatherRequestId) state.weatherLoading = false;
  }
}

function renderWeather() {
  const city = state.city;
  const weather = state.weather;
  const badge = $("localAtmosphere");
  const iconSpan = $("atmosphereIcon");
  const labelSpan = $("atmosphereLabel");

  if (weather && weather.temperature != null) {
    if (badge) {
      badge.className = `atmosphere-badge ${weather.type || 'day'}`;
      if (iconSpan) iconSpan.textContent = weather.icon || "☀️";
      if (labelSpan) labelSpan.textContent = `${weather.temperature}°C · ${weather.condition}`;
      badge.title = `Clima em ${cityName(city)}: ${weather.condition}, ${weather.temperature}°C. Vento: ${weather.windSpeed} km/h. Clique para abrir a previsão detalhada da Windy.`;
    }

    if ($("weatherCardIcon")) $("weatherCardIcon").textContent = weather.icon || "☀️";
    if ($("weatherCardTemp")) $("weatherCardTemp").textContent = `${weather.temperature}°`;
    if ($("weatherCardCondition")) $("weatherCardCondition").textContent = weather.condition;
    if ($("weatherCardCity")) $("weatherCardCity").textContent = `${cityName(city)}, ${city.country || ''}`;
    if ($("weatherCardWind")) $("weatherCardWind").textContent = `${weather.windSpeed} km/h`;
    if ($("weatherCardGust")) $("weatherCardGust").textContent = `${weather.windGust} km/h`;
    if ($("weatherCardHumidity")) $("weatherCardHumidity").textContent = `${weather.humidity}%`;
    if ($("weatherCardPressure")) $("weatherCardPressure").textContent = `${weather.pressure} hPa`;

    const timeline = $("weatherHourlyTimeline");
    if (timeline && weather.hourly && weather.hourly.length) {
      timeline.innerHTML = weather.hourly.map((step) => {
        const d = new Date(step.time || step.timestamp);
        const hours = String(d.getHours()).padStart(2, '0') + ':00';
        return `
          <div class="weather-hourly-step">
            <span class="step-time">${hours}</span>
            <span class="step-icon">${step.icon || '☀️'}</span>
            <span class="step-temp">${step.temperature}°</span>
          </div>
        `;
      }).join('');
    }
  } else {
    const atmosphere = getAtmosphere(city);
    if (badge) {
      badge.className = `atmosphere-badge ${atmosphere.type}`;
      if (iconSpan) iconSpan.textContent = atmosphere.icon;
      if (labelSpan) labelSpan.textContent = atmosphere.label;
      badge.title = `Condição estimada em ${cityName(city)}. Clique para carregar a previsão Windy.`;
    }
  }
}

function toggleWeatherCard(force) {
  const card = $("weatherForecastCard");
  if (!card) return;
  const isHidden = card.classList.contains("hidden");
  const nextOpen = force !== undefined ? force : isHidden;
  card.classList.toggle("hidden", !nextOpen);
  if (nextOpen && !state.weather && !state.weatherLoading) {
    loadWeather();
  }
}

// CAMADA OFICIAL DE AEROPORTOS DO MUNDO (ARCGIS WORLD AIRPORTS)
async function loadAirports() {
  if (state.airports && state.airports.length > 0) return state.airports;
  try {
    const res = await request('/api/airports');
    if (res && Array.isArray(res.airports)) {
      state.airports = res.airports;
      return state.airports;
    }
  } catch (err) {
    console.warn("Falha ao carregar aeroportos mundiais:", err);
  }
  return [];
}

async function toggleAirports(force) {
  const shouldShow = force !== undefined ? force : !state.airportsVisible;
  state.airportsVisible = shouldShow;
  const btn = $("btnAirports");
  const legend = $("legendAirport");
  btn?.classList.toggle("active", shouldShow);
  legend?.classList.toggle("hidden", !shouldShow);

  if (shouldShow && (!state.airports || state.airports.length === 0)) {
    showToast("✈️ Carregando aeroportos mundiais (ArcGIS)...");
    await loadAirports();
  }

  updateGlobePoints(true);
  if (shouldShow) {
    showToast(`✈️ Aeroportos do mundo ativados (${state.airports.length || 9943} aeroportos)`);
  } else {
    showToast("✈️ Camada de aeroportos desativada");
  }
}

function findClosestAirport(lat, lon, maxDistKm = 140) {
  if (!state.airports || state.airports.length === 0) return null;
  let best = null, bestDist = maxDistKm;
  for (const apt of state.airports) {
    const d = distanceKm(lat, lon, apt.lat, apt.lon);
    if (d < bestDist) {
      bestDist = d;
      best = apt;
    }
  }
  return best;
}

function selectAirport(apt) {
  if (!apt) return;
  state.activeAirport = apt;
  const aLat = apt.lat;
  const aLng = apt.lon;
  state.globe.pointOfView({ lat: aLat, lng: aLng, altitude: 0.85 }, 1200);

  updateReticleTheme("airport");
  const reticle = $("tuningReticle");
  const reticleLabel = $("reticleLabel");
  if (reticle) {
    reticle.classList.remove("searching");
    reticle.classList.add("locked");
  }
  const iataBadge = apt.iata ? `[${apt.iata}] ` : '';
  const loc = [apt.city, apt.country].filter(Boolean).join(", ");
  if (reticleLabel) {
    reticleLabel.textContent = `✈️ ${iataBadge}${apt.name} · ${loc}`;
  }
  updateGlobePoints(true);
  const elevInfo = apt.elev != null ? ` · Elev: ${apt.elev} ft` : '';
  showToast(`✈️ ${iataBadge}${apt.name} — ${loc}${elevInfo}`);
}

// INTEGRAÇÃO WINDY MAP FORECAST (MAPA DE VENTOS & RADAR EM TELA CHEIA)
function toggleWindyMap(force, layer) {
  const panel = $("windyMapPanel");
  const btn = $("toggleWindyMap");
  const btnTop = $("btnWindMap");
  const btnWeather = $("weatherOpenMapBtn");
  if (!panel) return;

  if (layer) state.windyMapLayer = layer;
  const isHidden = panel.classList.contains("hidden");
  const shouldOpen = force !== undefined ? force : isHidden;
  state.windyMapOpen = shouldOpen;

  panel.classList.toggle("hidden", !shouldOpen);
  btn?.classList.toggle("active", shouldOpen);
  btnTop?.classList.toggle("active", shouldOpen);
  btnWeather?.classList.toggle("active", shouldOpen);

  if (shouldOpen) {
    $("mapPanel")?.classList.add("hidden");
    $("cameraPanel")?.classList.add("hidden");
    $("stationDrawer")?.classList.add("hidden");
    $("weatherForecastCard")?.classList.add("hidden");
    updateWindyMap();
  }
}

function updateWindyMap() {
  if (!state.windyMapOpen) return;
  const wrapper = $("windyMapFrameWrapper");
  if (!wrapper) return;
  const city = state.city;
  const title = $("windyMapCityTitle");
  if (title) title.textContent = `${cityName(city).toUpperCase()} · VENTOS & RADAR AO VIVO`;

  const layer = state.windyMapLayer || 'wind';
  const overlayMap = {
    wind: 'wind',
    rain: 'rain',
    temp: 'temp',
    clouds: 'clouds',
    satellite: 'satellite',
    radar: 'radar',
    waves: 'waves',
    gust: 'gust'
  };
  const overlay = overlayMap[layer] || 'wind';
  const key = state.cameraConfig?.windyMapKey || '';

  // Sincroniza classes ativas de botões da barra superior
  document.querySelectorAll("[data-windy-layer]").forEach((b) => {
    b.classList.toggle("active", b.dataset.windyLayer === layer);
  });

  // Atualiza botão articulado de previsão 7D no canto inferior esquerdo
  const isDetailOpen = Boolean(state.windyDetailOpen);
  const btnToggleDetail = $("btnToggleWindyDetail");
  if (btnToggleDetail) {
    btnToggleDetail.classList.toggle("detail-closed", !isDetailOpen);
    const label = $("windyDetailLabel");
    if (label) label.textContent = isDetailOpen ? "Ocultar Previsão 7D" : "Abrir Previsão 7D";
    const icon = $("windyDetailIcon");
    if (icon) icon.textContent = isDetailOpen ? "▼" : "▲";
  }

  const detailParam = isDetailOpen ? "true" : "false";
  const pressureParam = state.windyPressure ? "true" : "false";

  // URL oficial limpa do Windy: menu= vazio para manter os controles de camadas nativos do Windy acessíveis no mapa
  const url = `https://embed.windy.com/embed2.html?lat=${encodeURIComponent(city.lat)}&lon=${encodeURIComponent(city.lon)}&detailLat=${encodeURIComponent(city.lat)}&detailLon=${encodeURIComponent(city.lon)}&width=100%25&height=100%25&zoom=7&level=surface&overlay=${overlay}&product=ecmwf&menu=&message=&marker=true&calendar=now&pressure=${pressureParam}&type=map&location=coordinates&detail=${detailParam}&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1${key ? `&key=${encodeURIComponent(key)}` : ''}`;

  let iframe = wrapper.querySelector("iframe");
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.title = "Mapa de Previsão e Ventos Windy";
    iframe.allow = "fullscreen";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    wrapper.appendChild(iframe);
  }
  if (iframe.src !== url) {
    iframe.src = url;
  }
}



// CARREGAMENTO DE RÁDIOS (RADIO BROWSER)
async function loadStations(keep) {
  if (state.loadingStations) return;
  state.loadingStations = true;
  const previous = keep ? state.stations : [];
  const offset = keep ? state.offset : 0;
  const requestId = ++state.stationRequestId;
  const requestCityId = state.city.id;

  try {
    const data = await request(
      `/api/stations?country=${encodeURIComponent(state.city.countryCode)}&lat=${state.city.lat}&lon=${state.city.lon}&offset=${offset}&limit=60`
    );

    if (requestId !== state.stationRequestId || requestCityId !== state.city.id) return;

    const merged = keep ? previous.concat(data.stations || []) : data.stations || [];
    const unique = new Map();
    merged.forEach((station) => unique.set(station.id, station));
    state.stations = Array.from(unique.values());
    state.offset = offset + (data.stations || []).length;

    if (!keep) {
      const best = state.stations.find((s) => s.isOnline && s.streamUrl) || state.stations[0];
      if (best) {
        $("featuredStationName").textContent = best.name;
        if (!state.station) setCurrentStation(best, false);
      } else {
        $("featuredStationName").textContent = "Nenhuma frequência geolocalizada";
      }
    }

    const nearbyCount = state.stations.filter(
      (s) =>
        s.latitude != null &&
        s.longitude != null &&
        distanceKm(state.city.lat, state.city.lon, s.latitude, s.longitude) <= 150
    ).length;

    const countDisplay = nearbyCount > 0 ? String(nearbyCount) : String(state.stations.length);
    $("stationCount").textContent = countDisplay;
    $("metricStationCount").textContent = countDisplay;

    $("drawerSummary").textContent = state.stations.length
      ? `${countDisplay} estações de rádio catalogadas em ${state.city.country} · ordenadas por qualidade e popularidade`
      : "Nenhuma rádio com coordenadas válidas retornada nesta busca.";

    $("loadMore").classList.toggle("hidden", !data.hasMore);
    if (state.drawerType === "stations") renderStationList();
    updateGlobePoints();
    if (state.view === "city" && state.map) renderMapMarkers();
  } catch (error) {
    if (requestId !== state.stationRequestId || requestCityId !== state.city.id) return;
    if (!keep && state.drawerType === "stations") {
      $("featuredStationName").textContent = "Catálogo de rádios em manutenção temporária";
      $("drawerSummary").textContent = error.message;
      $("stationList").innerHTML = `
        <div class="drawer-state">
          <strong>Não foi possível conectar ao Radio Browser</strong>
          ${escapeHtml(error.message)}<br>
          <button class="button-quiet retry-btn" style="margin-top:12px;">Tentar novamente</button>
        </div>`;
      $("stationList").querySelector(".retry-btn")?.addEventListener("click", () => loadStations(false));
    }
  } finally {
    if (requestId === state.stationRequestId) state.loadingStations = false;
  }
}

// CARREGAMENTO DOS LUGARES E CIDADES DO RADIO GARDEN (12.500+ CIDADES)
async function loadRadioGardenPlaces() {
  if (state.radioGardenLoaded) return;
  try {
    const res = await fetch("/api/radiogarden/places");
    const data = await res.json();
    if (data && Array.isArray(data.places) && data.places.length > 0) {
      state.radioGardenPlaces = data.places.map((item) => ({
        id: item.id,
        title: item.title,
        country: item.country,
        countryCode: item.countryCode || "",
        lat: item.lat != null ? item.lat : (item.geo ? item.geo[1] : 0),
        lon: item.lon != null ? item.lon : (item.geo ? item.geo[0] : 0),
        size: item.size || 1
      }));
      state.radioGardenLoaded = true;
      console.log(`Global Syncro: ${state.radioGardenPlaces.length} cidades do Radio Garden carregadas.`);
      
      // Sintoniza a cidade inicial se nenhuma estiver travada
      if (!state.currentRadioGardenPlace) {
        const initial = findClosestRadioGardenPlace(state.city.lat, state.city.lon, 400) || state.radioGardenPlaces[0];
        if (initial) {
          tuneToRadioGardenPlace(initial, false);
        }
      }
      updateGlobePoints();
    }
  } catch (err) {
    console.warn("Não foi possível carregar o catálogo de cidades do Radio Garden:", err.message);
  }
}

// CARREGAMENTO DOS PONTOS GLOBAIS DE WEBCAMS EM SEUS LOCAIS REAIS (4.000+ PONTOS)
async function loadGlobalWebcamPoints() {
  if (state.globalWebcamPointsLoaded) return;
  try {
    const res = await fetch("/api/tvgarden/webcams/points");
    const data = await res.json();
    if (data && Array.isArray(data.points) && data.points.length > 0) {
      state.globalWebcamPoints = data.points;
      state.globalWebcamPointsLoaded = true;
      console.log(`Global Syncro: ${state.globalWebcamPoints.length} webcams geolocalizadas carregadas no globo.`);
      updateGlobePoints();
    }
  } catch (err) {
    console.warn("Não foi possível carregar os pontos de webcams:", err.message);
  }
}

// CARREGAMENTO DOS PONTOS GLOBAIS DE CANAIS DE TV EM SEUS LOCAIS REAIS (6.700+ PONTOS)
async function loadGlobalTvPoints() {
  if (state.globalTvPointsLoaded) return;
  try {
    const res = await fetch("/api/tvgarden/tv/points");
    const data = await res.json();
    if (data && Array.isArray(data.points) && data.points.length > 0) {
      state.globalTvPoints = data.points;
      state.globalTvPointsLoaded = true;
      console.log(`Global Syncro: ${state.globalTvPoints.length} canais de TV geolocalizados carregados no globo.`);
      updateGlobePoints();
    }
  } catch (err) {
    console.warn("Não foi possível carregar os pontos de TV:", err.message);
  }
}

// TEMA VISUAL DINÂMICO DA RETÍCULA / ALVO CENTRAL
function updateReticleTheme(kind) {
  const reticle = $("tuningReticle");
  if (!reticle) return;
  reticle.classList.remove("mode-radio", "mode-camera", "mode-tv", "mode-all", "mode-none");
  const target = kind || state.kind || "all";
  reticle.classList.add(`mode-${target}`);
}

// BUSCA RÁPIDA DA CIDADE MAIS PRÓXIMA DE UMA COORDENADA NO CATÁLOGO DO RADIO GARDEN
function findClosestRadioGardenPlace(lat, lon, maxDistanceKm = 350) {
  if (!state.radioGardenPlaces || !state.radioGardenPlaces.length) return null;
  let nearest = null;
  let minDistance = Infinity;

  // Etapa 1: filtro de proximidade aproximada (4.5 graus)
  for (let i = 0; i < state.radioGardenPlaces.length; i++) {
    const p = state.radioGardenPlaces[i];
    if (Math.abs(p.lat - lat) > 4.5 || Math.abs(p.lon - lon) > 6) continue;
    const dist = distanceKm(lat, lon, p.lat, p.lon);
    if (dist < minDistance && dist <= maxDistanceKm) {
      minDistance = dist;
      nearest = p;
    }
  }

  // Etapa 2: se não encontrou em raio estreito, expande a busca
  if (!nearest) {
    for (let i = 0; i < state.radioGardenPlaces.length; i++) {
      const p = state.radioGardenPlaces[i];
      if (Math.abs(p.lat - lat) > 12 || Math.abs(p.lon - lon) > 15) continue;
      const dist = distanceKm(lat, lon, p.lat, p.lon);
      if (dist < minDistance && dist <= maxDistanceKm) {
        minDistance = dist;
        nearest = p;
      }
    }
  }

  return nearest;
}

// BUSCA DA WEBCAM MAIS PRÓXIMA DE UMA COORDENADA NO GLOBO
function findClosestWebcam(lat, lon, maxDistanceKm = 500) {
  const cams = state.globalWebcamPoints.length > 0 ? state.globalWebcamPoints : state.cameras;
  if (!cams || !cams.length) return null;
  let nearest = null;
  let minDistance = Infinity;

  for (let i = 0; i < cams.length; i++) {
    const c = cams[i];
    const cLat = c.lat != null ? c.lat : c.latitude;
    const cLon = c.lon != null ? c.lon : c.longitude;
    if (cLat == null || cLon == null) continue;
    if (Math.abs(cLat - lat) > 5 || Math.abs(cLon - lon) > 7) continue;
    const dist = distanceKm(lat, lon, cLat, cLon);
    if (dist < minDistance && dist <= maxDistanceKm) {
      minDistance = dist;
      nearest = c;
    }
  }

  if (!nearest) {
    for (let i = 0; i < cams.length; i++) {
      const c = cams[i];
      const cLat = c.lat != null ? c.lat : c.latitude;
      const cLon = c.lon != null ? c.lon : c.longitude;
      if (cLat == null || cLon == null) continue;
      if (Math.abs(cLat - lat) > 12 || Math.abs(cLon - lon) > 15) continue;
      const dist = distanceKm(lat, lon, cLat, cLon);
      if (dist < minDistance && dist <= maxDistanceKm) {
        minDistance = dist;
        nearest = c;
      }
    }
  }
  return nearest;
}

// BUSCA DO CANAL DE TV MAIS PRÓXIMO DE UMA COORDENADA NO GLOBO
function findClosestTv(lat, lon, maxDistanceKm = 500) {
  const tvs = state.globalTvPoints.length > 0 ? state.globalTvPoints : state.tvChannels;
  if (!tvs || !tvs.length) return null;
  let nearest = null;
  let minDistance = Infinity;

  for (let i = 0; i < tvs.length; i++) {
    const t = tvs[i];
    const tLat = t.lat != null ? t.lat : t.latitude;
    const tLon = t.lon != null ? t.lon : t.longitude;
    if (tLat == null || tLon == null) continue;
    if (Math.abs(tLat - lat) > 5 || Math.abs(tLon - lon) > 7) continue;
    const dist = distanceKm(lat, lon, tLat, tLon);
    if (dist < minDistance && dist <= maxDistanceKm) {
      minDistance = dist;
      nearest = t;
    }
  }

  if (!nearest) {
    for (let i = 0; i < tvs.length; i++) {
      const t = tvs[i];
      const tLat = t.lat != null ? t.lat : t.latitude;
      const tLon = t.lon != null ? t.lon : t.longitude;
      if (tLat == null || tLon == null) continue;
      if (Math.abs(tLat - lat) > 12 || Math.abs(tLon - lon) > 15) continue;
      const dist = distanceKm(lat, lon, tLat, tLon);
      if (dist < minDistance && dist <= maxDistanceKm) {
        minDistance = dist;
        nearest = t;
      }
    }
  }
  return nearest;
}

// BUSCA DE QUALQUER DESTINO MAIS PRÓXIMO (PARA O MODO TODOS)
function findClosestAny(lat, lon, maxDistanceKm = 500) {
  const candidates = [];
  const radio = findClosestRadioGardenPlace(lat, lon, maxDistanceKm);
  if (radio) {
    candidates.push({ kind: "radio", payload: radio, dist: distanceKm(lat, lon, radio.lat, radio.lon) });
  }
  const webcam = findClosestWebcam(lat, lon, maxDistanceKm);
  if (webcam) {
    const wLat = webcam.lat != null ? webcam.lat : webcam.latitude;
    const wLon = webcam.lon != null ? webcam.lon : webcam.longitude;
    candidates.push({ kind: "camera", payload: webcam, dist: distanceKm(lat, lon, wLat, wLon) });
  }
  const tv = findClosestTv(lat, lon, maxDistanceKm);
  if (tv) {
    const tLat = tv.lat != null ? tv.lat : tv.latitude;
    const tLon = tv.lon != null ? tv.lon : tv.longitude;
    candidates.push({ kind: "tv", payload: tv, dist: distanceKm(lat, lon, tLat, tLon) });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0];
}

// SINTONIZAÇÃO DINÂMICA DE WEBCAM NO ALVO DO GLOBO
function tuneToWebcam(webcam, autoPlay = true) {
  if (!webcam) return;
  updateReticleTheme("camera");
  const reticle = $("tuningReticle");
  const label = $("reticleLabel");
  if (reticle) {
    reticle.classList.remove("searching");
    reticle.classList.add("locked");
  }
  const displayName = webcam.city || webcam.name;
  if (label) {
    label.textContent = `${webcam.name} (${webcam.country || 'Ao Vivo'})`;
  }
  const wLat = webcam.lat != null ? webcam.lat : webcam.latitude;
  const wLon = webcam.lon != null ? webcam.lon : webcam.longitude;
  const countryCode = webcam.countryCode || getCountryCode(webcam.country) || "";

  state.city = {
    id: webcam.id || `cam-${displayName}`,
    name: displayName,
    english: displayName,
    country: webcam.country || "",
    countryCode,
    lat: wLat,
    lon: wLon,
    timezone: null
  };

  $("cityTitle").innerHTML = `${escapeHtml(displayName)}<span class="title-period">.</span>`;
  $("cityCoordinates").textContent = `${(webcam.country || "").toUpperCase()} · ${Math.abs(wLat).toFixed(2)}° ${wLat >= 0 ? "N" : "S"}, ${Math.abs(wLon).toFixed(2)}° ${wLon >= 0 ? "E" : "W"}`;
  if ($("globeCityName")) $("globeCityName").textContent = displayName.toUpperCase();
  $("heroEyebrow").textContent = "WEBCAM AO VIVO";
  $("featuredStationName").textContent = webcam.name;

  updateCityCopy();
  if (autoPlay) {
    setCamera(webcam);
  }
}

// SINTONIZAÇÃO DINÂMICA DE CANAL DE TV NO ALVO DO GLOBO
function tuneToTv(channel, autoPlay = true) {
  if (!channel) return;
  updateReticleTheme("tv");
  const reticle = $("tuningReticle");
  const label = $("reticleLabel");
  if (reticle) {
    reticle.classList.remove("searching");
    reticle.classList.add("locked");
  }
  const displayName = channel.city || channel.name;
  if (label) {
    label.textContent = `${channel.name} (${channel.country || 'TV'})`;
  }
  const tLat = channel.lat != null ? channel.lat : channel.latitude;
  const tLon = channel.lon != null ? channel.lon : channel.longitude;
  const countryCode = channel.countryCode || getCountryCode(channel.country) || "";

  state.city = {
    id: channel.id || `tv-${displayName}`,
    name: displayName,
    english: displayName,
    country: channel.country || "",
    countryCode,
    lat: tLat,
    lon: tLon,
    timezone: null
  };

  $("cityTitle").innerHTML = `${escapeHtml(displayName)}<span class="title-period">.</span>`;
  $("cityCoordinates").textContent = `${(channel.country || "").toUpperCase()} · ${Math.abs(tLat).toFixed(2)}° ${tLat >= 0 ? "N" : "S"}, ${Math.abs(tLon).toFixed(2)}° ${tLon >= 0 ? "E" : "W"}`;
  if ($("globeCityName")) $("globeCityName").textContent = displayName.toUpperCase();
  $("heroEyebrow").textContent = "CANAL DE TV AO VIVO";
  $("featuredStationName").textContent = channel.name;

  updateCityCopy();
  if (autoPlay) {
    openTvChannel(channel, false);
  }
}

// SINTONIZAÇÃO DINÂMICA DA CIDADE DO RADIO GARDEN
async function tuneToRadioGardenPlace(place, autoPlay = false) {
  if (!place) return;
  const changed = !state.currentRadioGardenPlace || state.currentRadioGardenPlace.id !== place.id;
  state.currentRadioGardenPlace = place;

  // Atualiza retícula no centro da tela para tema de rádio
  updateReticleTheme("radio");
  const reticle = $("tuningReticle");
  const label = $("reticleLabel");
  if (reticle) {
    reticle.classList.remove("searching");
    reticle.classList.add("locked");
  }
  if (label) {
    label.textContent = `${place.title}, ${place.country}`;
  }

  // Atualiza cidade e cabeçalho editorial
  const countryCode = place.countryCode || getCountryCode(place.country) || "";
  state.city = {
    id: place.id,
    name: place.title,
    english: place.title,
    country: place.country,
    countryCode,
    lat: place.lat,
    lon: place.lon,
    timezone: null // Horário e atmosfera calculados dinamicamente pela posição geográfica real
  };

  $("cityTitle").innerHTML = `${escapeHtml(place.title)}<span class="title-period">.</span>`;
  $("cityCoordinates").textContent = `${(place.country || "").toUpperCase()} · ${Math.abs(place.lat).toFixed(2)}° ${place.lat >= 0 ? "N" : "S"}, ${Math.abs(place.lon).toFixed(2)}° ${place.lon >= 0 ? "E" : "W"}`;
  $("metricStationCount").textContent = String(place.size || 1);
  $("stationCount").textContent = String(place.size || 1);
  $("featuredStationName").textContent = `Sintonizando frequências de ${place.title}...`;
  if ($("globeCityName")) $("globeCityName").textContent = place.title.toUpperCase();

  updateCityCopy();
  if (changed) recordJourney("place", state.city);

  // Busca as estações reais de rádio no Radio Garden para este lugar
  try {
    const data = await request(`/api/radiogarden/place?id=${encodeURIComponent(place.id)}`);
    if (data && Array.isArray(data.stations) && data.stations.length > 0) {
      state.stations = data.stations;
      $("stationCount").textContent = String(data.stations.length);
      $("metricStationCount").textContent = String(data.stations.length);
      $("drawerSummary").textContent = `${data.stations.length} estações de rádio ao vivo em ${place.title}, ${place.country}`;

      const best = state.stations[0];
      $("featuredStationName").textContent = best.name;

      if (autoPlay || (!audio.paused && state.station)) {
        playStation(best);
      } else if (!state.station) {
        setCurrentStation(best, false);
      }

      if (state.drawerType === "stations" && !$("stationDrawer").classList.contains("hidden")) {
        renderStationList();
      }
    } else {
      loadStations(false);
    }
  } catch (err) {
    console.warn(`Erro ao carregar canais do Radio Garden para ${place.title}:`, err.message);
    loadStations(false);
  }

  loadCameras();
  loadTvChannels();
  updateGlobePoints();
}

// CARREGAMENTO DE TODAS AS RÁDIOS DO MUNDO (CATÁLOGO GLOBAL)
async function loadGlobalStations() {
  if (state.loadingGlobalStations || state.globalStations.length > 0) return;
  state.loadingGlobalStations = true;
  try {
    const data = await request("/api/stations/global?limit=1500");
    if (data && Array.isArray(data.stations) && data.stations.length > 0) {
      state.globalStations = data.stations;
      console.log(`Global Syncro: ${state.globalStations.length} estações mundiais ativas no mapa.`);
      updateGlobePoints();
      if (state.view === "city" && state.map) renderMapMarkers();
    }
  } catch (error) {
    console.warn("Não foi possível carregar o catálogo global de rádios:", error.message);
  } finally {
    state.loadingGlobalStations = false;
  }
}

// CARREGAMENTO DE CÂMERAS COM INTEGRAÇÃO TV GARDEN E CÂMERAS DO MUNDO
async function loadCameras() {
  const city = state.city;
  const requestId = ++state.cameraRequestId;
  state.loadingCameras = true;

  try {
    // 1. Tenta buscar câmeras por proximidade geográfica (Câmeras do Mundo / Windy)
    let fetchedCameras = [];
    try {
      const data = await request(
        `/api/cameras?lat=${encodeURIComponent(city.lat)}&lon=${encodeURIComponent(city.lon)}&country=${encodeURIComponent(city.countryCode)}&radius=150`
      );
      if (data?.cameras?.length) fetchedCameras = data.cameras;
    } catch {}

    // 2. Complementa totalmente com todas as webcams do TV Garden para este país
    const code = city.countryCode || (city.country ? city.country.slice(0, 2).toUpperCase() : "");
    if (code) {
      try {
        const tvgData = await request(`/api/tvgarden/webcams?country=${encodeURIComponent(code)}`);
        if (tvgData?.webcams?.length) {
          const existingIds = new Set(fetchedCameras.map((c) => c.id || c.name));
          for (const tvCam of tvgData.webcams) {
            if (!existingIds.has(tvCam.id || tvCam.name)) {
              fetchedCameras.push(tvCam);
              existingIds.add(tvCam.id || tvCam.name);
            }
          }
        }
      } catch {}
    }

    // Se ainda assim tiver poucas câmeras, complementa com as câmeras em destaque globais do TV Garden
    if (fetchedCameras.length < 4) {
      try {
        const popularData = await request("/api/tvgarden/webcams?limit=24&offset=0");
        if (popularData?.webcams?.length) {
          const existingIds = new Set(fetchedCameras.map((c) => c.id || c.name));
          for (const tvCam of popularData.webcams) {
            if (!existingIds.has(tvCam.id || tvCam.name)) {
              fetchedCameras.push(tvCam);
              existingIds.add(tvCam.id || tvCam.name);
              if (fetchedCameras.length >= 15) break;
            }
          }
        }
      } catch {}
    }

    if (requestId !== state.cameraRequestId || city.id !== state.city.id) return;
    state.cameras = fetchedCameras;

    // Mescla as câmeras recebidas (Windy Webcams + TV Garden) aos pontos globais do Globo 3D
    if (fetchedCameras.length > 0) {
      const existingCamPoints = new Set(
        state.globalWebcamPoints.map((c) => c.id || `${c.lat || c.latitude},${c.lon || c.longitude}`)
      );
      for (const fc of fetchedCameras) {
        const idKey = fc.id || `${fc.lat || fc.latitude},${fc.lon || fc.longitude}`;
        if (!existingCamPoints.has(idKey)) {
          state.globalWebcamPoints.push(fc);
          existingCamPoints.add(idKey);
        }
      }
    }

    const count = state.cameras.length;
    $("cameraCount").textContent = count > 0 ? String(count) : "0";
    $("metricCameraCount").textContent = count > 0 ? String(count) : "0";

    updateGlobePoints();
    if (state.drawerType === "cameras" && !$("stationDrawer").classList.contains("hidden")) {
      renderCameraList();
    }
    if (state.view === "city" && state.map) renderMapMarkers();
  } catch (error) {
    if (requestId !== state.cameraRequestId || city.id !== state.city.id) return;
    state.cameras = [];
    $("cameraCount").textContent = "0";
    $("metricCameraCount").textContent = "0";
    updateGlobePoints();
  } finally {
    if (requestId === state.cameraRequestId) state.loadingCameras = false;
  }
}

// CARREGAMENTO DE CANAIS DE TV AO VIVO DA REGIÃO (TV GARDEN TV)
async function loadTvChannels() {
  const city = state.city;
  const code = city.countryCode || (city.country ? city.country.slice(0, 2).toUpperCase() : "");
  if (!code) {
    state.tvChannels = [];
    if ($("tvCount")) $("tvCount").textContent = "0";
    if ($("metricTvCount")) $("metricTvCount").textContent = "0";
    return;
  }

  state.loadingTvChannels = true;
  try {
    const data = await request(`/api/tvgarden/tv/channels?country=${encodeURIComponent(code)}`);
    const channels = (data?.channels || []).map((ch) => ({
      ...ch,
      isTv: true,
      provider: "TV Garden TV"
    }));
    state.tvChannels = channels;
    const count = channels.length;
    if ($("tvCount")) $("tvCount").textContent = count > 0 ? String(count) : "0";
    if ($("metricTvCount")) $("metricTvCount").textContent = count > 0 ? String(count) : "0";

    if (state.drawerType === "tv" && !$("stationDrawer").classList.contains("hidden")) {
      renderTvDrawerList();
    }
  } catch (err) {
    console.warn("Erro ao carregar canais de TV para o país:", err.message);
    state.tvChannels = [];
    if ($("tvCount")) $("tvCount").textContent = "0";
    if ($("metricTvCount")) $("metricTvCount").textContent = "0";
  } finally {
    state.loadingTvChannels = false;
  }
}

function stationLocation(station) {
  const distance =
    station.latitude == null || station.longitude == null
      ? null
      : distanceKm(state.city.lat, state.city.lon, station.latitude, station.longitude);
  return distance == null
    ? station.state || station.country || state.city.country
    : distance < 10
    ? `em ${state.city.name}`
    : `${distance} km de ${state.city.name}`;
}

function stationLogo(favicon, name, className) {
  const url = safeUrl(favicon);
  const initial = escapeHtml(String(name || "R").trim().slice(0, 1).toUpperCase());
  return `<span class="${className}">${
    url ? `<img loading="lazy" src="${escapeHtml(url)}" alt="" onerror="this.remove()">` : initial
  }</span>`;
}

// 17. LISTA DE ESTAÇÕES
function renderStationList() {
  const list = $("stationList");
  if (!state.stations.length) {
    if (!list.querySelector(".drawer-state")) {
      list.innerHTML = `
        <div class="drawer-state">
          <strong>Buscando frequências ativas...</strong>
          Estações com transmissão verificada estão sendo carregadas.
        </div>`;
    }
    return;
  }

  list.innerHTML = state.stations
    .map((station) => {
      const tags = station.genres.slice(0, 2).join(" · ") || station.language || station.codec || "Rádio";
      const distance = stationLocation(station);
      const online = station.isOnline ? "ONLINE" : "VERIFICANDO";
      const isCurrent = state.station?.id === station.id;

      return `
        <article class="station-row${isCurrent ? " current" : ""}">
          ${stationLogo(station.favicon, station.name, "station-logo")}
          <div class="station-row-main">
            <strong>${escapeHtml(station.name)}</strong>
            <small>${escapeHtml(distance)} · ${escapeHtml(station.country || state.city.country)}</small>
            <div class="station-row-meta">
              ${escapeHtml(tags)}${station.bitrate ? " · " + station.bitrate + " KBPS" : ""}${station.codec ? " · " + escapeHtml(station.codec) : ""} · <span style="color:${station.isOnline ? "#8bc34a" : "#aaa"}">${online}</span>
            </div>
          </div>
          <button class="station-play" data-play-station="${escapeHtml(station.id)}" aria-label="Reproduzir ${escapeHtml(station.name)}" title="Tocar">
            ${isCurrent && !audio.paused ? "⏸" : "▶"}
          </button>
        </article>`;
    })
    .join("");

  list.querySelectorAll("[data-play-station]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const station = state.stations.find((item) => item.id === btn.dataset.playStation);
      if (station) playStation(station);
    })
  );
}

// LISTA DE CÂMERAS NO DRAWER
function renderCameraList() {
  state.drawerType = "cameras";
  $("drawerTitle").textContent = "Câmeras em " + state.city.name;
  $("drawerEyebrow").textContent = "TRANSMISSÕES AO VIVO";
  $("loadMore").classList.add("hidden");

  const list = $("stationList");
  if (!state.cameras.length) {
    list.innerHTML = `
      <div class="drawer-state">
        <strong>Nenhuma câmera cadastrada para ${escapeHtml(state.city.name)}</strong>
        Explore cidades vizinhas ou consulte a fonte pública em
        <br><a href="https://camerasdomundo.com/" target="_blank" rel="noopener noreferrer">Câmeras do Mundo ↗</a>
      </div>`;
    $("drawerSummary").textContent = "0 câmeras encontradas.";
    return;
  }

  $("drawerSummary").textContent = `${state.cameras.length} câmeras ao vivo disponíveis`;
  list.innerHTML = state.cameras
    .map((camera) => {
      const isCurrent = state.camera?.id === camera.id;
      return `
        <article class="station-row${isCurrent ? " current" : ""}" data-cam-id="${escapeHtml(camera.id)}" style="cursor: pointer;">
          ${stationLogo(camera.thumbnail, camera.name, "station-logo")}
          <div class="station-row-main">
            <strong>${escapeHtml(camera.name)}</strong>
            <small>${escapeHtml([camera.city, camera.country].filter(Boolean).join(" · ") || state.city.name)}</small>
            <div class="station-row-meta">${escapeHtml(camera.category || "Câmera ao vivo")} · ${camera.provider}</div>
          </div>
          <button class="station-play" data-open-cam="${escapeHtml(camera.id)}" aria-label="Abrir ${escapeHtml(camera.name)}" title="Assistir">
            ↗
          </button>
        </article>`;
    })
    .join("");

  list.querySelectorAll(".station-row").forEach((row) =>
    row.addEventListener("click", () => {
      const camId = row.dataset.camId;
      const camera = state.cameras.find((item) => item.id === camId);
      if (camera) {
        setCamera(camera);
        renderCameraList();
      }
    })
  );
}

function updateDrawerState(open) {
  const drawer = $("stationDrawer");
  if (!drawer) return;
  drawer.classList.toggle("hidden", !open);
  document.body.classList.toggle("drawer-open", Boolean(open));
}

function openCameraSidebar() {
  state.drawerType = "cameras";
  const drawer = $("stationDrawer");
  drawer.classList.add("camera-sidebar-glass");
  $("drawerTitle").textContent = "Câmeras ao vivo";
  $("drawerEyebrow").textContent = "TRANSMISSÕES AO VIVO";
  $("loadMore").classList.add("hidden");
  updateDrawerState(true);
  renderCameraList();
}

function openTvDrawer() {
  state.drawerType = "tv";
  const drawer = $("stationDrawer");
  if (!drawer) return;
  drawer.classList.add("camera-sidebar-glass");
  const countryName = state.camera?.country || state.city?.country || "Região";
  const count = state.tvChannels?.length || 0;
  $("drawerTitle").textContent = `Canais de TV em ${countryName}`;
  $("drawerEyebrow").textContent = `TV GARDEN · ${count > 0 ? count + ' CANAIS' : 'CANAIS AO VIVO'}`;
  $("drawerSummary").textContent = count > 0 
    ? `${count} canais de televisão ao vivo disponíveis em ${countryName}`
    : `Buscando emissoras de TV ao vivo...`;
  $("loadMore").classList.add("hidden");
  updateDrawerState(true);
  renderTvDrawerList();
}

function openStationDrawer() {
  state.drawerType = "stations";
  const drawer = $("stationDrawer");
  drawer.classList.remove("camera-sidebar-glass");
  $("drawerTitle").textContent = "Rádios em " + state.city.name;
  $("drawerEyebrow").textContent = "FREQUÊNCIAS DA REGIÃO";
  $("loadMore").classList.toggle("hidden", !state.stations.length);
  updateDrawerState(true);
  renderStationList();
  if (!state.stations.length) loadStations(false);
}

function closeStationDrawer() {
  const drawer = $("stationDrawer");
  drawer.classList.remove("camera-sidebar-glass");
  updateDrawerState(false);
}

// 18. PLAYER DE RÁDIO
function setCurrentStation(station, redraw = true, revealPlayer = false) {
  state.station = station || null;
  if (station && revealPlayer) {
    $("radioPlayer")?.classList.remove("hidden");
    document.body.classList.add("has-active-player");
  }
  $("playerStationName").textContent = station?.name || "Escolha uma frequência";
  $("playerStationPlace").textContent = station
    ? [stationLocation(station), station.country || state.city.country, station.genres?.[0]].filter(Boolean).join(" · ")
    : "O mundo está a um play de distância";
  if ($("playerBitrate")) $("playerBitrate").textContent = station?.bitrate ? `${station.bitrate} KBPS` : "— KBPS";

  const logo = safeUrl(station?.favicon);
  $("playerCover").innerHTML = logo
    ? `<img src="${escapeHtml(logo)}" alt="" onerror="this.remove()">`
    : `<span>${escapeHtml(String(station?.name || "RA").slice(0, 2).toUpperCase())}</span>`;

  const isSaved = Boolean(station && state.favorites.stations.some((item) => item.id === station.id));
  $("favoriteStation").classList.toggle("saved", isSaved);
  $("favoriteStation").textContent = isSaved ? "♥" : "♡";

  $("featuredStationName").textContent = station?.name || "Sintonizando frequência local...";

  if (station?.homepage) {
    const srcLink = $("stationSource");
    srcLink.href = safeUrl(station.homepage);
    srcLink.classList.remove("hidden");
  } else {
    $("stationSource").classList.add("hidden");
  }

  if (redraw) updateGlobePoints();
}

function renderPlayState(status, type = "") {
  const label = $("streamStatus");
  const wrap = label?.parentElement;
  if (!label || !wrap) return;

  wrap.classList.toggle("on", status === "playing");
  wrap.classList.toggle("error", status === "error");

  const captions = {
    ready: "PRONTO PARA SINTONIZAR",
    loading: "CONECTANDO À FREQUÊNCIA",
    playing: "AO VIVO" + (type ? " · " + type : ""),
    paused: "PAUSADO",
    error: "TRANSMISSÃO INDISPONÍVEL"
  };

  label.innerHTML = `<i class="status-dot"></i> ${captions[status] || "PRONTO"}`;
  $("playPause").classList.toggle("playing", status === "playing");
  $("playPause").setAttribute("aria-label", status === "playing" ? "Pausar rádio" : "Reproduzir rádio");
}

async function playStation(station) {
  if (!station?.streamUrl) return showToast("Esta rádio não disponibilizou URL de transmissão.");
  const pauseCurrent = state.station?.id === station.id && !audio.paused;
  setCurrentStation(station, true, true);

  if (pauseCurrent) {
    audio.pause();
    return;
  }

  renderPlayState("loading");
  try {
    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }
    audio.removeAttribute("crossOrigin");

    if (station.hls && window.Hls?.isSupported()) {
      state.hls = new window.Hls({ enableWorker: true, lowLatencyMode: true });
      state.hls.loadSource(station.streamUrl);
      state.hls.attachMedia(audio);
      state.hls.on(window.Hls.Events.MANIFEST_PARSED, () => audio.play().catch(() => streamFailure()));
      state.hls.on(window.Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) streamFailure();
      });
    } else {
      audio.src = station.streamUrl;
      await audio.play();
    }

    fetch(`/api/stations/click?id=${encodeURIComponent(station.id)}`).catch(() => {});
    recordJourney("radio", station);
  } catch {
    streamFailure();
  }
}

function streamFailure() {
  renderPlayState("error");
  showToast("Esta transmissão não pôde ser aberta no navegador. Tente outra estação.");
}

audio.addEventListener("playing", () =>
  renderPlayState("playing", state.station?.genres?.[0]?.toUpperCase() || "")
);
audio.addEventListener("pause", () => {
  if (state.station && $("streamStatus").parentElement.classList.contains("on")) {
    renderPlayState("paused");
  }
});
audio.addEventListener("error", streamFailure);
audio.addEventListener("waiting", () => {
  if (state.station) renderPlayState("loading");
});

// CONTROLE VISUAL DO BOTÃO DE ÁUDIO DO PLAYER DE VÍDEO / TV
function updateAudioButtonUI() {
  const btn = $("cameraAudioBtn");
  const label = $("cameraAudioLabel");
  const icon = $("cameraAudioIcon");
  if (!btn) return;
  const isMuted = state.cameraPlayerInstance ? state.cameraPlayerInstance.isMuted() : false;
  btn.classList.toggle("muted", isMuted);
  if (label) label.textContent = isMuted ? "Mudo" : "Som";
  if (icon) {
    icon.innerHTML = isMuted
      ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`
      : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
  }
}

// 15. LIVE CAMERA PLAYER & 16. LISTEN + WATCH
function setCamera(camera) {
  state.camera = camera || null;
  state.mini = false;
  $("miniFrame").innerHTML = "";
  $("miniPlayer").classList.add("hidden");
  $("cameraContext").classList.toggle("hidden", !camera);
  $("backToGlobe").classList.toggle("hidden", !camera);

  if (!camera) {
    closeStationDrawer();
    $("cameraPanel").classList.add("hidden");
    $("worldStage").classList.remove("camera-active");
    document.body.classList.remove("camera-active");
    document.body.classList.remove("drawer-open");
    $("heroEyebrow").textContent = "PRÓXIMO DESTINO";
    $("editorialCopy").textContent =
      `Sintonize as frequências e assista às transmissões públicas de ${state.city.name} agora em tempo real.`;
    $("cameraFrame").innerHTML = "";
    $("mapLegend").classList.remove("hidden");
    setView(state.view);
    return;
  }

  const isTv = Boolean(
    camera.isTv ||
    camera.provider === "TV Garden TV" ||
    (state.drawerType === "tv" && camera.streamType)
  );

  $("cameraPanel").classList.remove("hidden");
  $("mapPanel").classList.add("hidden");
  $("mapLegend").classList.add("hidden");
  $("worldStage").classList.add("camera-active");
  document.body.classList.add("camera-active");

  if (isTv) {
    camera.isTv = true;
    camera.provider = "TV Garden TV";
    $("heroEyebrow").textContent = "CANAL DE TV AO VIVO";
    $("editorialCopy").textContent = `Transmitindo ${camera.name} (${camera.country || state.city.country}).`;
    $("cameraContextName").textContent = camera.name;
    $("cameraTitle").textContent = camera.name;
    $("cameraLocation").textContent = [camera.country || state.city.country, "TV Aberta & Cabo · Ao Vivo"].filter(Boolean).join(" · ");
    if ($("cameraSource")) $("cameraSource").href = safeUrl(camera.streamUrl || camera.embedUrl) || "https://tvgarden.world/tv";
    $("cameraProvider").textContent = "TV GARDEN · CANAL AO VIVO";
  } else {
    $("heroEyebrow").textContent = "AO VIVO DE";
    $("editorialCopy").textContent = `Assistindo a ${camera.name} em ${camera.city || state.city.name}.`;
    $("cameraContextName").textContent = camera.name;
    $("cameraTitle").textContent = camera.name;
    $("cameraLocation").textContent = [camera.city || state.city.name, camera.country || state.city.country].join(" · ");
    if ($("cameraSource")) $("cameraSource").href = safeUrl(camera.sourceUrl) || "https://camerasdomundo.com/";
    $("cameraProvider").textContent = (camera.provider || "TRANSMISSÃO AO VIVO").toUpperCase();
  }

  // Sincroniza retículo central com o tema do item ativo
  updateReticleTheme(isTv ? "tv" : "camera");
  const reticleEl = $("tuningReticle");
  const reticleLbl = $("reticleLabel");
  if (reticleEl) {
    reticleEl.classList.remove("searching");
    reticleEl.classList.add("locked");
  }
  if (reticleLbl) {
    reticleLbl.textContent = `${camera.name} (${camera.city || camera.country || (isTv ? "TV" : "Ao Vivo")})`;
  }

  const frame = $("cameraFrame");
  frame.innerHTML = "";

  if (!state.cameraPlayerInstance) {
    state.cameraPlayerInstance = new CameraPlayer(
      frame,
      (failedCam) => {
        showToast(`A transmissão de ${failedCam.name} não respondeu.`);
      },
      () => {
        updateAudioButtonUI();
      }
    );
  } else {
    state.cameraPlayerInstance.frame = frame;
    state.cameraPlayerInstance.onVolumeChange = () => {
      updateAudioButtonUI();
    };
  }
  state.cameraPlayerInstance.open(camera);

  $("cameraFavorite").textContent = state.favorites.cameras.some((item) => item.id === camera.id) ? "♥" : "♡";
  recordJourney("camera", camera);
  updateAudioButtonUI();

  // Se for canal de TV, abre a sidebar de TV (sempre preservando os canais de TV)
  // Se for webcam, abre a sidebar de câmeras
  if (isTv) {
    openTvDrawer();
  } else {
    openCameraSidebar();
  }
}

// 19. MINI LIVE PLAYER FLUTUANTE
function minimizeCamera(minimize) {
  if (!state.camera) return;
  if (minimize) {
    const frame = $("cameraFrame");
    const miniFrame = $("miniFrame");
    const iframe = frame.querySelector("iframe");
    const preview = iframe || frame.querySelector("img") || frame.querySelector("video");

    if (preview) {
      miniFrame.replaceChildren(iframe ? iframe : preview.cloneNode(true));
    }
    $("miniTitle").textContent = state.camera.name;
    $("miniPlace").textContent = state.camera.city || state.city.name;
    $("miniPlayer").classList.remove("hidden");
    $("cameraPanel").classList.add("hidden");
    $("worldStage").classList.remove("camera-active");
    document.body.classList.remove("camera-active");
    document.body.classList.remove("drawer-open");
    state.mini = true;
    setView(state.view);
    updateGlobePoints();
  } else {
    state.mini = false;
    $("miniPlayer").classList.add("hidden");
    if (state.camera) setCamera(state.camera);
  }
}

// 16. MODO LISTEN + WATCH
async function activateListenAndWatch() {
  let targetRadio = state.station;
  if (!targetRadio && state.stations.length) {
    targetRadio = state.stations.find((s) => s.isOnline) || state.stations[0];
  }
  if (targetRadio) {
    playStation(targetRadio);
  }

  if (state.cameras.length > 0) {
    setCamera(state.cameras[0]);
    showToast(`Ouvindo ${state.station?.name || 'rádio'} + Assistindo transmissão ao vivo`);
    return;
  }

  showToast("Buscando transmissões ao vivo da região...");
  const code = state.city.countryCode || getCountryCode(state.city.country);
  if (code) {
    try {
      const tvgData = await request(`/api/tvgarden/webcams?country=${encodeURIComponent(code)}`);
      if (tvgData?.webcams?.length) {
        state.cameras = tvgData.webcams;
        setCamera(state.cameras[0]);
        showToast(`Ouvindo rádio local + Assistindo webcam ao vivo (${code})`);
        return;
      }
    } catch {}
  }

  await loadCameras();
  if (state.cameras.length > 0) {
    setCamera(state.cameras[0]);
    showToast(`Ouvindo ${state.station?.name || 'rádio'} + Assistindo transmissão ao vivo`);
  } else {
    showToast("Nenhuma câmera pública encontrada nesta localidade no momento.");
  }
}

// 23. CÁLCULO DO PONTO SUBSOLAR ASTRONÔMICO (ONDE O SOL ILUMINA A TERRA AGORA)
function getSubsolarPoint(date = new Date()) {
  const now = date.getTime();
  const startOfYear = new Date(date.getUTCFullYear(), 0, 1).getTime();
  const dayOfYear = (now - startOfYear) / 86400000;
  // Declinação solar (-23.44° a +23.44°)
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  // Longitude subsolar (12:00 UTC = 0° lon; 1h = 15°)
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const sunLng = -((utcHours - 12) * 15);
  return { lat: declination, lng: sunLng };
}

// ILUMINAÇÃO DINÂMICA INTELIGENTE CONFORME O ZOOM (CLAREIA REGIÕES NOTURNAS EM ZOOM APROXIMADO)
function updateZoomIllumination() {
  if (!state.globe) return;
  const scene = state.globe.scene?.();
  if (!scene) return;
  const ambLight = scene.children.find((c) => c.type === "AmbientLight" || c.isAmbientLight);
  const dirLight = scene.children.find((c) => c.type === "DirectionalLight" || c.isDirectionalLight);
  if (!ambLight) return;

  const pov = state.globe.pointOfView?.();
  const alt = pov && typeof pov.altitude === "number" ? pov.altitude : 1.6;

  // Limiares de zoom:
  // alt >= 1.45: visão orbital cósmica com ciclo dia/noite espacial realista
  // alt <= 0.85: aproximação de cidade/região -> 100% claro e diurno para visualização dos detalhes do mapa
  const zoomFactor = Math.max(0, Math.min(1, (1.45 - alt) / (1.45 - 0.70)));

  // Luz ambiente: de 0.88 (espaço) até 4.20 (zoom detalhado nítido e iluminado)
  const baseIntensity = 0.88;
  const targetIntensity = 4.20;
  ambLight.intensity = baseIntensity + (targetIntensity - baseIntensity) * zoomFactor;

  // Interpola a cor de azul-escuro espacial (0x5a6e88) para branco puro solar (0xffffff)
  const r = (90 + (255 - 90) * zoomFactor) / 255;
  const g = (110 + (255 - 110) * zoomFactor) / 255;
  const b = (136 + (255 - 136) * zoomFactor) / 255;
  ambLight.color.setRGB(r, g, b);

  // Luz frontal de câmera para iluminar com clareza máxima qualquer região do planeta ao dar zoom, mesmo em áreas noturnas
  const camera = state.globe.camera?.();
  if (camera && dirLight) {
    if (!state.cameraZoomLight) {
      const czLight = dirLight.clone();
      czLight.color.setHex(0xffffff);
      czLight.intensity = 0;
      scene.add(czLight);
      scene.add(czLight.target);
      state.cameraZoomLight = czLight;
    }
    if (state.cameraZoomLight) {
      state.cameraZoomLight.position.copy(camera.position);
      state.cameraZoomLight.target.position.set(0, 0, 0);
      state.cameraZoomLight.target.updateMatrixWorld();
      state.cameraZoomLight.intensity = zoomFactor * 4.5;
    }
  }

  if (dirLight) {
    // Atenua sombras excessivamente duras em zoom aproximado
    dirLight.intensity = Math.max(1.8, 3.6 - (1.4 * zoomFactor));
  }
}

// 23. ILUMINAÇÃO SOLAR E CICLO DIA / NOITE NO GLOBO 3D
function setupSolarIllumination() {
  if (!state.globe) return;
  const scene = state.globe.scene();
  if (!scene) return;

  const updateLights = () => {
    const ambLight = scene.children.find((c) => c.type === "AmbientLight" || c.isAmbientLight);
    const dirLight = scene.children.find((c) => c.type === "DirectionalLight" || c.isDirectionalLight);

    if (dirLight) {
      const sun = getSubsolarPoint(new Date());
      const coords = state.globe.getCoords(sun.lat, sun.lng, 2.5);
      if (coords) {
        dirLight.position.set(coords.x, coords.y, coords.z);
        dirLight.intensity = 3.6;
        dirLight.color.setHex(0xfffaed);
      }
    }

    updateZoomIllumination();
  };

  updateLights();
  setTimeout(updateLights, 500);
  setInterval(updateLights, 300000); // Atualização solar suave a cada 5 minutos (sem micro-travamentos)

  // Aplica luzes urbanas noturnas no mapa emissivo uma única vez
  try {
    const mat = state.globe.globeMaterial();
    if (mat && mat.map && !mat.emissiveMap) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const tex = mat.map.clone();
        tex.image = img;
        tex.needsUpdate = true;
        mat.emissiveMap = tex;
        mat.emissive.setHex(0xaaaaaa);
        mat.emissiveIntensity = 0.85;
        mat.needsUpdate = true;
      };
      img.src = "./vendor/earth-night.jpg";
    }
  } catch (err) {
    console.warn("Luzes noturnas secundárias:", err.message);
  }
}

// 11. GLOBO COM PONTOS 2D PLANOS E QUANTIDADE COMPLETA (SEM REDUÇÃO)
let updateGlobeRafId = null;

function updateGlobePoints(immediate = false) {
  if (!state.globe) return;
  if (!immediate) {
    if (updateGlobeRafId) return;
    updateGlobeRafId = requestAnimationFrame(() => {
      updateGlobeRafId = null;
      renderGlobePointsDirect();
    });
    return;
  }
  if (updateGlobeRafId) {
    cancelAnimationFrame(updateGlobeRafId);
    updateGlobeRafId = null;
  }
  renderGlobePointsDirect();
}

function renderGlobePointsDirect() {
  if (!state.globe) return;

  const showRadio = state.kind === "all" || state.kind === "radio";
  const showCamera = state.kind === "all" || state.kind === "camera";
  const showTv = state.kind === "all" || state.kind === "tv";

  // 1. PONTOS 2D PLANOS EM PARTÍCULAS (NÃO 3D) — 100% DA QUANTIDADE TOTAL NO GLOBO
  const particleGroups = [];

  // RÁDIOS (Pontos Verdes #00e676 — Todas as 12.500+ cidades e lugares do Radio Garden)
  if (showRadio) {
    const radioList = state.radioGardenPlaces.length > 0 ? state.radioGardenPlaces : cities;
    if (radioList.length > 0) {
      particleGroups.push({
        id: "radio",
        color: "#00e676",
        size: 2.2,
        points: radioList
      });
    }
  }

  // CÂMERAS (Pontos Azuis/Ciano Neon — Todas as 4.000+ webcams geolocalizadas)
  if (showCamera) {
    const cams = state.globalWebcamPoints.length > 0 ? state.globalWebcamPoints : state.cameras;
    if (cams.length > 0) {
      particleGroups.push({
        id: "camera",
        color: state.kind === "camera" ? "#00e5ff" : "#00b0ff",
        size: state.kind === "camera" ? 3.4 : 2.7,
        points: cams
      });
    }
  }

  // TV AO VIVO (Pontos Vermelhos Neon #ff3366 — Todos os 6.768+ canais de TV geolocalizados)
  if (showTv) {
    const tvs = state.globalTvPoints.length > 0 ? state.globalTvPoints : state.tvChannels;
    if (tvs.length > 0) {
      particleGroups.push({
        id: "tv",
        color: "#ff3366",
        size: 2.8,
        points: tvs
      });
    }
  }

  // AEROPORTOS DO MUNDO (Pontos Azul-Céu / Ciano #38bdf8 — 9.943 aeroportos globais do ArcGIS)
  if (state.airportsVisible && state.airports && state.airports.length > 0) {
    particleGroups.push({
      id: "airports",
      color: "#38bdf8",
      size: 2.8,
      points: state.airports
    });
  }

  // 2. PONTO ATIVO SELECIONADO (Marcador 2D com tamanho fixo em tela - sempre pequenininho e nunca escala no zoom)
  const activePoints = [];
  if (state.kind === "none" && !state.activeAirport) {
    // Camadas desabilitadas: mantém globo 100% limpo sem marcadores
  } else if (state.activeAirport) {
    const apt = state.activeAirport;
    activePoints.push({
      lat: apt.lat,
      lng: apt.lon,
      color: "#38bdf8",
      label: `✈️ ${apt.name} (${apt.iata || apt.id})`,
      kind: "airport",
      payload: apt
    });
  } else if (state.kind === "camera" && state.camera && !state.camera.isTv) {
    const c = state.camera;
    const lat = c.lat != null ? c.lat : c.latitude;
    const lon = c.lon != null ? c.lon : c.longitude;
    if (lat != null && lon != null) {
      activePoints.push({
        lat,
        lng: lon,
        color: "#ffd54f",
        label: c.name,
        kind: "camera",
        payload: c
      });
    }
  } else if (state.kind === "tv" && state.camera && state.camera.isTv) {
    const c = state.camera;
    const lat = c.lat != null ? c.lat : c.latitude;
    const lon = c.lon != null ? c.lon : c.longitude;
    if (lat != null && lon != null) {
      activePoints.push({
        lat,
        lng: lon,
        color: "#ffd54f",
        label: c.name,
        kind: "tv",
        payload: c
      });
    }
  } else if (state.currentRadioGardenPlace) {
    const p = state.currentRadioGardenPlace;
    activePoints.push({
      lat: p.lat,
      lng: p.lon,
      color: "#ffd54f",
      label: p.title,
      kind: "radioGardenPlace",
      payload: p
    });
  } else if (state.city) {
    activePoints.push({
      lat: state.city.lat,
      lng: state.city.lon,
      color: "#ffd54f",
      label: `${state.city.name} · ${state.city.country}`,
      kind: "city",
      payload: state.city
    });
  }

  // Inclui o ponto ativo com destaque dourado radiante nas partículas 2D (tamanho fixo em tela: 4.6px)
  if (activePoints.length > 0) {
    particleGroups.push({
      id: "activeSelection",
      color: "#ffd54f",
      size: 4.6,
      points: activePoints.map((p) => ({ lat: p.lat, lon: p.lng }))
    });
  }

  // Atualiza as partículas 2D planas com todos os pontos e a seleção ativa
  if (typeof state.globe.particlesData === "function") {
    state.globe.particlesData(particleGroups);
  }

  // Atualiza o marcador HTML 2D de alta nitidez (fixo em tela, sempre pequenininho, nunca escala com o zoom)
  if (typeof state.globe.htmlElementsData === "function") {
    state.globe.htmlElementsData(activePoints);
  }

  // Desativa polígonos/prismas 3D volumétricos (evita polígono amarelo gigante no zoom)
  if (typeof state.globe.pointsData === "function") {
    state.globe.pointsData([]);
  }

  requestAnimationFrame(ensurePointsAlwaysVisible);
}

// Garante que marcadores (rádios verdes, câmeras azuis e tv vermelha) fiquem 100% visíveis e radiantes
function ensurePointsAlwaysVisible() {
  // Partículas 2D possuem material nativo emissivo e imune a sombras solares
}

let globeRotateResumeTimer = null;

// APLICAÇÃO DO MAPA DE SATÉLITE HÍBRIDO (MAPTILER HYBRID-V4) NO GLOBO 3D
function applyMapTilerGlobe(apiKey, style = "hybrid-v4") {
  if (!state.globe) return;
  const key = (apiKey || state.mapTilerKey || (typeof localStorage !== "undefined" ? localStorage.getItem("MAPTILER_API_KEY") : "") || DEFAULT_MAPTILER_KEY).trim();
  if (!key) return;

  state.mapTilerKey = key;
  state.mapTilerStyle = style || "hybrid-v4";

  try {
    // Configura o motor de tiles dinâmicos do MapTiler Hybrid-v4 (com zoom interativo)
    // Conforme a câmera se aproxima ou se afasta, o Three-Globe carrega tiles de maior resolução progressivamente
    state.globe
      .globeTileEngineUrl((x, y, l) => `https://api.maptiler.com/maps/${state.mapTilerStyle}/${l}/${x}/${y}.jpg?key=${key}`)
      .globeTileEngineMaxLevel(17);

    // Notifica a câmera para renderizar os tiles no ponto de vista atual imediatamente
    try {
      const pov = state.globe.pointOfView();
      if (pov && typeof pov.lat === "number") {
        state.globe.pointOfView(pov);
      }
    } catch {}

    const attr = $("mapAttribution");
    if (attr) {
      attr.textContent = "© MapTiler · © OpenStreetMap contributors · OpenFreeMap · MapLibre";
    }

    console.info(`[MapTiler] Mapa ${state.mapTilerStyle} ativado com sucesso no Globo 3D.`);
  } catch (err) {
    console.warn("[MapTiler] Não foi possível ativar globeTileEngineUrl:", err);
  }
}

// SINCRONIZAÇÃO VISUAL DO BOTÃO DE PAUSA/PLAY COM O ESTADO REAL DO GLOBO
function syncAutoRotateUI() {
  const btn = $("toggleAutoRotate");
  if (!btn) return;
  const isPaused = Boolean(state.autoRotatePaused);
  btn.classList.toggle("is-paused", isPaused);
  btn.innerHTML = isPaused ? "▶" : "⏸";
  btn.title = isPaused ? "Retomar rotação automática" : "Pausar rotação automática";
  btn.setAttribute("aria-label", btn.title);
}

// CONTROLE DE PAUSA E RETOMADA DA ROTAÇÃO AUTOMÁTICA DO GLOBO
function toggleAutoRotate(forceState) {
  const willPause = forceState !== undefined ? Boolean(forceState) : !state.autoRotatePaused;
  state.autoRotatePaused = willPause;

  const controls = state.globe?.controls?.();
  if (controls) {
    controls.autoRotate = !willPause;
  }

  syncAutoRotateUI();

  if (willPause) {
    clearTimeout(globeRotateResumeTimer);
    document.body.classList.remove("is-orbiting");
    showToast("Rotação automática pausada");
  } else {
    state.lastUserInteractionTime = performance.now();
    document.body.classList.add("is-orbiting");
    showToast("Rotação automática retomada");
  }
}

async function initGlobe() {
  if (state.globe) return;
  if (typeof window.Globe !== "function") {
    state.globeWaits = (state.globeWaits || 0) + 1;
    if (state.globeWaits < 30) return setTimeout(initGlobe, 200);
    $("globeFallback")?.classList.remove("hidden");
    return;
  }

  try {
    const host = $("globe");
    state.globe = new window.Globe(host)
      .globeImageUrl("./vendor/earth-day.jpg")
      .bumpImageUrl("./vendor/earth-topology.png")
      .backgroundColor("rgba(0,0,0,0)")
      .showAtmosphere(true)
      .atmosphereColor("#8ab4f8")
      .atmosphereAltitude(0.18)
      .showGraticules(false)
      // Otimização crucial: ignora raycasting de mouse nas 23.200 partículas, garantindo 60 FPS cravados
      .pointerEventsFilter((obj) => obj && obj.__globeObjType !== "particles")
      // Arcos tridimensionais esféricos de correntes atmosféricas de vento (Forma B - Windy Wind Globe)
      .arcsData([])
      .arcStartLat((d) => d.startLat)
      .arcStartLng((d) => d.startLng)
      .arcEndLat((d) => d.endLat)
      .arcEndLng((d) => d.endLng)
      .arcColor((d) => d.color || ['rgba(0,229,255,0.75)', 'rgba(100,255,218,0.25)'])
      .arcAltitude((d) => d.alt || 0.04)
      .arcStroke((d) => d.stroke || 0.9)
      .arcDashLength((d) => d.dashLength || 0.4)
      .arcDashGap((d) => d.dashGap || 0.15)
      .arcDashInitialGap((d) => d.initialGap || 0)
      .arcDashAnimateTime((d) => d.animateTime || 2500)
      // Partículas 2D planas de alta performance para todos os 23.200 pontos (NÃO 3D)
      .particlesData([])
      .particlesList((d) => d.points || [])
      .particleLat((p) => (p.lat != null ? p.lat : p.latitude))
      .particleLng((p) => (p.lon != null ? p.lon : (p.lng != null ? p.lng : p.longitude)))
      .particleAltitude(0.003)
      .particlesSize((d) => d.size || 2.4)
      .particlesSizeAttenuation(false) // Pontos 2D nítidos de tamanho constante em tela (não volumétricos)
      .particlesColor((d) => d.color || "#ffffff")
      // Marcador de seleção ativo 2D (Tamanho fixo em tela, sempre pequenininho, nunca escala com o zoom)
      .htmlElementsData([])
      .htmlLat("lat")
      .htmlLng("lng")
      .htmlAltitude(0.002)
      .htmlElement((point) => {
        const marker = document.createElement("div");
        marker.className = "globe-active-marker";
        marker.title = point.label || "";
        marker.innerHTML = `
          <span class="globe-marker-ping"></span>
          <span class="globe-marker-dot"></span>
        `;
        return marker;
      })
      // Desativa malha 3D volumétrica (evita que polígonos gigantes cubram o mapa ao aproximar a câmera)
      .pointsData([])
      .pointRadius(0)
      .pointAltitude(0)
      .pointResolution(8)
      .onGlobeClick(({ lat, lng }) => {
        if (lat == null || lng == null) return;
        if (state.airportsVisible) {
          const apt = findClosestAirport(lat, lng, 120);
          if (apt) {
            selectAirport(apt);
            return;
          }
        }
        if (state.kind === "none") return;
        if (state.kind === "camera") {
          const cam = findClosestWebcam(lat, lng, 450);
          if (cam) {
            const cLat = cam.lat != null ? cam.lat : cam.latitude;
            const cLng = cam.lon != null ? cam.lon : cam.longitude;
            state.globe.pointOfView({ lat: cLat, lng: cLng, altitude: 0.95 }, 1200);
            tuneToWebcam(cam, true);
            showToast(`📹 Câmera conectada: ${cam.name}`);
          }
        } else if (state.kind === "tv") {
          const tv = findClosestTv(lat, lng, 450);
          if (tv) {
            const tLat = tv.lat != null ? tv.lat : tv.latitude;
            const tLng = tv.lon != null ? tv.lon : tv.longitude;
            state.globe.pointOfView({ lat: tLat, lng: tLng, altitude: 0.95 }, 1200);
            tuneToTv(tv, false);
            openTvChannel(tv);
            showToast(`📺 Canal de TV: ${tv.name}`);
          }
        } else if (state.kind === "radio") {
          const place = findClosestRadioGardenPlace(lat, lng, 450);
          if (place) {
            state.globe.pointOfView({ lat: place.lat, lng: place.lon, altitude: 0.95 }, 1200);
            tuneToRadioGardenPlace(place, true);
            showToast(`📻 Sintonizando ${place.title}, ${place.country}`);
          }
        } else {
          // Modo Todos: para abrir câmeras e TV neste modo, o usuário clica diretamente no ponto colorido no globo
          const clickRadiusKm = 140; // Tolerância de clique do mouse sobre o ponto colorido
          const camHit = findClosestWebcam(lat, lng, clickRadiusKm);
          const tvHit = findClosestTv(lat, lng, clickRadiusKm);

          if (camHit || tvHit) {
            const distCam = camHit ? distanceKm(lat, lng, camHit.lat != null ? camHit.lat : camHit.latitude, camHit.lon != null ? camHit.lon : camHit.longitude) : Infinity;
            const distTv = tvHit ? distanceKm(lat, lng, tvHit.lat != null ? tvHit.lat : tvHit.latitude, tvHit.lon != null ? tvHit.lon : tvHit.longitude) : Infinity;

            if (distCam <= distTv && camHit) {
              const cLat = camHit.lat != null ? camHit.lat : camHit.latitude;
              const cLng = camHit.lon != null ? camHit.lon : camHit.longitude;
              state.globe.pointOfView({ lat: cLat, lng: cLng, altitude: 0.95 }, 1200);
              tuneToWebcam(camHit, true);
              showToast(`📹 Câmera conectada: ${camHit.name}`);
              return;
            } else if (tvHit) {
              const tLat = tvHit.lat != null ? tvHit.lat : tvHit.latitude;
              const tLng = tvHit.lon != null ? tvHit.lon : tvHit.longitude;
              state.globe.pointOfView({ lat: tLat, lng: tLng, altitude: 0.95 }, 1200);
              tuneToTv(tvHit, false);
              openTvChannel(tvHit);
              showToast(`📺 Canal de TV: ${tvHit.name}`);
              return;
            }
          }

          // Se não clicou diretamente em um ponto de câmera/TV, a sintonia busca sempre rádio da região mais próxima
          const place = findClosestRadioGardenPlace(lat, lng, 500);
          if (place) {
            state.globe.pointOfView({ lat: place.lat, lng: place.lon, altitude: 0.95 }, 1200);
            tuneToRadioGardenPlace(place, true);
            showToast(`📻 Sintonizando ${place.title}, ${place.country}`);
          } else {
            const nearestCity = [...cities].sort((a, b) => distanceKm(lat, lng, a.lat, a.lon) - distanceKm(lat, lng, b.lat, b.lon))[0];
            if (nearestCity) {
              state.globe.pointOfView({ lat: nearestCity.lat, lng: nearestCity.lon, altitude: 0.95 }, 1200);
              selectCity(nearestCity);
            }
          }
        }
      });
    window.__globe = state.globe;
    window.__state = state;
    window.__app = { setCamera, setCurrentStation, setKind, playStation, tuneToRadioGardenPlace, activateListenAndWatch };

    // Interceptor inteligente de pointOfView: garante que ao finalizar qualquer transição de câmera,
    // a rotação automática do planeta seja restaurada imediatamente sem nunca travar o globo
    const originalPointOfView = state.globe.pointOfView.bind(state.globe);
    state.globe.pointOfView = function (...args) {
      const res = originalPointOfView(...args);
      const duration = typeof args[1] === "number" ? args[1] : 0;
      if (duration > 0) {
        clearTimeout(globeRotateResumeTimer);
        globeRotateResumeTimer = setTimeout(() => {
          if (state.view === "globe" && !state.isDraggingGlobe) {
            const c = state.globe?.controls();
            if (c) {
              c.autoRotate = !state.autoRotatePaused;
              syncAutoRotateUI();
            }
          }
        }, duration + 100);
      }
      return res;
    };

    const controls = state.globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.65;
    controls.enableDamping = true;
    controls.dampingFactor = 0.10;
    controls.rotateSpeed = 0.9;
    controls.zoomSpeed = 1.0;
    // Permite zoom aproximado em alta definição até as ruas e cidades (raio da Terra = 100)
    controls.minDistance = 100.3;
    controls.maxDistance = 500;

    controls.addEventListener("change", () => {
      updateZoomIllumination();
    });

    // Aplica o mapa de satélite híbrido interativo MapTiler imediatamente
    applyMapTilerGlobe(state.mapTilerKey, state.mapTilerStyle);

    // Retícula e Sintonia ao Arrasto com feedback visual temático
    const reticle = $("tuningReticle");
    const reticleLabel = $("reticleLabel");

    const getSearchingMessage = () => {
      if (state.kind === "none") return "CAMADAS DESATIVADAS";
      if (state.kind === "camera") return "BUSCANDO CÂMERAS...";
      if (state.kind === "tv") return "SINTONIZANDO TV...";
      return "SINTONIZANDO RÁDIO...";
    };

    const resumeAutoRotate = (delay = 3200) => {
      state.isDraggingGlobe = false;
      state.lastUserInteractionTime = performance.now();
      clearTimeout(globeRotateResumeTimer);
      if (state.autoRotatePaused) {
        controls.autoRotate = false;
        document.body.classList.remove("is-orbiting");
        return;
      }
      globeRotateResumeTimer = setTimeout(() => {
        if (state.view === "globe" && !state.isDraggingGlobe && !state.camera && !document.body.classList.contains("drawer-open") && !state.autoRotatePaused) {
          controls.autoRotate = true;
          if (reticleLabel) reticleLabel.textContent = "GIRANDO O PLANETA";
          if (reticle) reticle.classList.remove("searching", "locked");
          document.body.classList.remove("is-tuning");
          document.body.classList.add("is-orbiting");
        }
      }, delay);
    };

    controls.addEventListener("start", () => {
      controls.autoRotate = false;
      clearTimeout(globeRotateResumeTimer);
      state.isDraggingGlobe = true;
      state.lastUserInteractionTime = performance.now();
      document.body.classList.remove("is-orbiting");
      document.body.classList.add("is-tuning");
      if (reticle) {
        reticle.classList.remove("locked");
        reticle.classList.add("searching");
        updateReticleTheme(state.kind);
      }
      if (reticleLabel) reticleLabel.textContent = getSearchingMessage();
    });

    controls.addEventListener("change", () => {
      state.lastUserInteractionTime = performance.now();
      updateZoomIllumination();
      if (state.isDraggingGlobe && reticleLabel) {
        const msg = getSearchingMessage();
        if (reticleLabel.textContent !== msg) reticleLabel.textContent = msg;
      }
    });

    controls.addEventListener("end", () => {
      resumeAutoRotate(3500);

      // Trava no destino mais próximo do centro da mira conforme a escolha atual
      const pov = state.globe.pointOfView();
      if (pov) {
        if (state.kind === "none") {
          if (reticleLabel) reticleLabel.textContent = "GIRANDO O PLANETA";
          reticle?.classList.remove("searching", "locked");
          return;
        }
        if (state.kind === "camera") {
          const closestCam = findClosestWebcam(pov.lat, pov.lng, 600);
          if (closestCam) {
            const cLat = closestCam.lat != null ? closestCam.lat : closestCam.latitude;
            const cLng = closestCam.lon != null ? closestCam.lon : closestCam.longitude;
            state.globe.pointOfView({ lat: cLat, lng: cLng, altitude: pov.altitude }, 600);
            tuneToWebcam(closestCam, true);
            showToast(`📹 Câmera conectada: ${closestCam.name}`);
          } else if (reticleLabel) {
            reticleLabel.textContent = "NENHUMA CÂMERA PRÓXIMA";
            reticle?.classList.remove("searching", "locked");
          }
        } else if (state.kind === "tv") {
          const closestTv = findClosestTv(pov.lat, pov.lng, 600);
          if (closestTv) {
            const tLat = closestTv.lat != null ? closestTv.lat : closestTv.latitude;
            const tLng = closestTv.lon != null ? closestTv.lon : closestTv.longitude;
            state.globe.pointOfView({ lat: tLat, lng: tLng, altitude: pov.altitude }, 600);
            tuneToTv(closestTv, false);
            showToast(`📺 Canal de TV: ${closestTv.name}`);
          } else if (reticleLabel) {
            reticleLabel.textContent = "NENHUM CANAL DE TV PRÓXIMO";
            reticle?.classList.remove("searching", "locked");
          }
        } else if (state.kind === "radio") {
          const closestPlace = findClosestRadioGardenPlace(pov.lat, pov.lng, 380);
          if (closestPlace) {
            state.globe.pointOfView({ lat: closestPlace.lat, lng: closestPlace.lon, altitude: pov.altitude }, 600);
            tuneToRadioGardenPlace(closestPlace, !audio.paused && state.station != null);
            showToast(`📻 Sintonizado em ${closestPlace.title}, ${closestPlace.country}`);
          } else if (reticleLabel) {
            reticleLabel.textContent = "GIRANDO O PLANETA";
            reticle?.classList.remove("searching", "locked");
          }
        } else {
          // Modo Todos: a sintonia automática busca SEMPRE rádios!
          // Para abrir câmeras e TV neste modo, o usuário clica diretamente no ponto colorido no globo.
          const closestPlace = findClosestRadioGardenPlace(pov.lat, pov.lng, 450);
          if (closestPlace) {
            state.globe.pointOfView({ lat: closestPlace.lat, lng: closestPlace.lon, altitude: pov.altitude }, 600);
            tuneToRadioGardenPlace(closestPlace, !audio.paused && state.station != null);
            showToast(`📻 Sintonizado em ${closestPlace.title}, ${closestPlace.country}`);
          } else {
            const nearestCity = [...cities].sort((a, b) => distanceKm(pov.lat, pov.lng, a.lat, a.lon) - distanceKm(pov.lat, pov.lng, b.lat, b.lon))[0];
            if (nearestCity && distanceKm(pov.lat, pov.lng, nearestCity.lat, nearestCity.lon) < 600) {
              state.globe.pointOfView({ lat: nearestCity.lat, lng: nearestCity.lon, altitude: pov.altitude }, 600);
              selectCity(nearestCity);
            } else if (reticleLabel) {
              reticleLabel.textContent = "GIRANDO O PLANETA";
              reticle?.classList.remove("searching", "locked");
            }
          }
        }
      }
    });

    // Proteções globais: se o usuário soltar o ponteiro fora do globo ou a janela perder o foco, retoma a rotação contínua
    window.addEventListener("pointerup", resumeAutoRotate, { passive: true });
    window.addEventListener("touchend", resumeAutoRotate, { passive: true });
    window.addEventListener("touchcancel", resumeAutoRotate, { passive: true });
    window.addEventListener("blur", resumeAutoRotate, { passive: true });

    state.globe.pointOfView({ lat: state.city.lat, lng: state.city.lon, altitude: 1.6 }, 0);
    state.globe.width(host.clientWidth || window.innerWidth * 0.58);
    state.globe.height(host.clientHeight || window.innerHeight * 0.7);

    new ResizeObserver(() => {
      if (!state.globe) return;
      state.globe.width(host.clientWidth);
      state.globe.height(host.clientHeight);
    }).observe(host);

    $("globeFallback")?.classList.add("hidden");
    updateGlobePoints();
    setupSolarIllumination();
    document.body.classList.add("is-orbiting");
    if (reticleLabel) reticleLabel.textContent = "GIRANDO O PLANETA";
  } catch (err) {
    console.error("Falha ao inicializar o globo 3D:", err);
    $("globeFallback")?.classList.remove("hidden");
  }
}

// MAPA 2D (MAPLIBRE GL)
function initializeMap() {
  if (state.map) return;
  const host = $("mapPanel");
  if (typeof window.maplibregl !== "object") {
    loadLibrary("map")
      .then(() => initializeMap())
      .catch(() => {});
    return;
  }

  try {
    const mapStyle = state.mapTilerKey
      ? `https://api.maptiler.com/maps/${state.mapTilerStyle || 'hybrid-v4'}/style.json?key=${state.mapTilerKey}`
      : "https://tiles.openfreemap.org/styles/dark";

    state.map = new window.maplibregl.Map({
      container: host,
      style: mapStyle,
      center: [state.city.lon, state.city.lat],
      zoom: 10,
      attributionControl: true,
      cooperativeGestures: true,
      pitch: 15
    });

    state.map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    state.map.on("load", renderMapMarkers);
    state.map.on("moveend", renderMapMarkers);
  } catch {
    state.map = null;
  }
}

function mapMarker(type, content, title) {
  const element = document.createElement("button");
  element.className = "map-point " + type;
  element.title = title;
  element.setAttribute("aria-label", title);
  if (type === "camera") {
    element.addEventListener("click", (e) => {
      e.stopPropagation();
      setCamera(content);
    });
  } else if (type === "station") {
    element.addEventListener("click", (e) => {
      e.stopPropagation();
      playStation(content);
    });
  }
  return element;
}

function renderMapMarkers() {
  if (!state.map || !state.map.loaded()) return;
  state.mapMarkers.forEach((m) => m.remove());
  state.mapMarkers = [];

  if (state.kind === "none") return;

  const bounds = state.map.getBounds();
  const inMapBounds = (lat, lon) => {
    if (lat == null || lon == null) return false;
    return (
      lat >= bounds.getSouth() &&
      lat <= bounds.getNorth() &&
      lon >= bounds.getWest() &&
      lon <= bounds.getEast()
    );
  };

  const centerMarker = mapMarker("selected", null, state.city.name);
  state.mapMarkers.push(
    new window.maplibregl.Marker({ element: centerMarker, anchor: "center" })
      .setLngLat([state.city.lon, state.city.lat])
      .addTo(state.map)
  );

  // Marcadores de outras cidades do Atlas
  cities.forEach((c) => {
    if (c.id === state.city.id) return;
    if (inMapBounds(c.lat, c.lon)) {
      const cityEl = document.createElement("button");
      cityEl.className = "map-point city";
      cityEl.title = `${c.name}, ${c.country}`;
      cityEl.addEventListener("click", (e) => {
        e.stopPropagation();
        selectCity(c);
      });
      state.mapMarkers.push(
        new window.maplibregl.Marker({ element: cityEl, anchor: "center" })
          .setLngLat([c.lon, c.lat])
          .addTo(state.map)
      );
    }
  });

  // Estações de Rádio (locais e mundiais dentro dos limites da tela)
  if (state.kind !== "camera") {
    const pool = state.globalStations.length > 0 ? state.globalStations : state.stations;
    let added = 0;
    for (const station of pool) {
      if (added >= 80) break;
      if (inMapBounds(station.latitude, station.longitude)) {
        state.mapMarkers.push(
          new window.maplibregl.Marker({
            element: mapMarker("station", station, station.name),
            anchor: "center"
          })
            .setLngLat([station.longitude, station.latitude])
            .addTo(state.map)
        );
        added++;
      }
    }
  }

  // Webcams (Câmeras locais da cidade + câmeras da Windy/TV Garden na área visível)
  if (state.kind !== "radio") {
    const allCams = [];
    const seenIds = new Set();
    const addCam = (cam) => {
      if (!cam) return;
      const cLat = cam.lat != null ? cam.lat : cam.latitude;
      const cLon = cam.lon != null ? cam.lon : cam.longitude;
      if (cLat == null || cLon == null) return;
      const cId = cam.id || `${cLat.toFixed(4)},${cLon.toFixed(4)}`;
      if (!seenIds.has(cId)) {
        seenIds.add(cId);
        allCams.push(cam);
      }
    };
    (state.cameras || []).forEach(addCam);
    (state.globalWebcamPoints || []).forEach(addCam);

    let addedCams = 0;
    for (const camera of allCams) {
      if (addedCams >= 120) break;
      const cLat = camera.lat != null ? camera.lat : camera.latitude;
      const cLon = camera.lon != null ? camera.lon : camera.longitude;
      if (inMapBounds(cLat, cLon)) {
        state.mapMarkers.push(
          new window.maplibregl.Marker({
            element: mapMarker("camera", camera, camera.name || "Câmera ao Vivo"),
            anchor: "center"
          })
            .setLngLat([cLon, cLat])
            .addTo(state.map)
        );
        addedCams++;
      }
    }
  }
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".view-toggle-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.view === view)
  );
  const cameraActiveMain = Boolean(state.camera) && !state.mini;
  $("mapPanel").classList.toggle("hidden", view !== "city" || cameraActiveMain);
  $("mapAttribution").classList.toggle("hidden", view !== "city" || cameraActiveMain);
  $("globe").classList.toggle("hidden", view === "city" || cameraActiveMain);
  $("globeFallback").classList.toggle(
    "hidden",
    view === "city" || cameraActiveMain || Boolean(state.globe)
  );
  $("selectedLabel")?.classList.toggle("hidden", view === "city" || cameraActiveMain);
  $("mapLegend").classList.toggle("hidden", cameraActiveMain);

  if (view === "city") {
    initializeMap();
    state.map?.flyTo({ center: [state.city.lon, state.city.lat], zoom: 10.5, duration: 800 });
  }
}

function setKind(kind) {
  // Se clicar no tipo que já está ativo, alterna para "none" (desabilita todas as camadas/marcadores)
  const targetKind = state.kind === kind ? "none" : kind;
  state.kind = targetKind;

  document.querySelectorAll("[data-kind]").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.kind === targetKind)
  );

  // Sincroniza tema visual do retículo/alvo central
  updateReticleTheme(targetKind);

  const reticle = $("tuningReticle");
  const reticleLabel = $("reticleLabel");
  if (reticle) {
    reticle.classList.remove("searching");
    reticle.classList.add("locked");
  }

  if (reticleLabel) {
    if (targetKind === "none") {
      reticleLabel.textContent = "CAMADAS DESATIVADAS";
    } else if (targetKind === "camera") {
      if (state.camera && !state.camera.isTv) {
        reticleLabel.textContent = `${state.camera.name} (${state.camera.country || 'Ao Vivo'})`;
      } else {
        const cam = findClosestWebcam(state.city.lat, state.city.lon, 600);
        if (cam) {
          reticleLabel.textContent = `${cam.name} (${cam.country || 'Ao Vivo'})`;
        } else {
          reticleLabel.textContent = `BUSCANDO CÂMERAS EM ${state.city.name.toUpperCase()}...`;
        }
      }
    } else if (targetKind === "tv") {
      if (state.camera && state.camera.isTv) {
        reticleLabel.textContent = `${state.camera.name} (${state.camera.country || 'TV'})`;
      } else {
        const tv = findClosestTv(state.city.lat, state.city.lon, 600);
        if (tv) {
          reticleLabel.textContent = `${tv.name} (${tv.country || 'TV'})`;
        } else {
          reticleLabel.textContent = `SINTONIZANDO TV EM ${state.city.name.toUpperCase()}...`;
        }
      }
    } else if (targetKind === "radio") {
      if (state.station) {
        reticleLabel.textContent = `${state.station.name} (${state.city.name})`;
      } else if (state.currentRadioGardenPlace) {
        reticleLabel.textContent = `${state.currentRadioGardenPlace.title}, ${state.currentRadioGardenPlace.country}`;
      } else {
        reticleLabel.textContent = `SINTONIZANDO RÁDIO EM ${state.city.name.toUpperCase()}...`;
      }
    } else {
      reticleLabel.textContent = `${state.city.name}, ${state.city.country || ''}`.trim();
    }
  }

  // Feedback imediato e claro ao usuário via toast
  if (targetKind === "none") {
    showToast("Todas as camadas foram desativadas");
  } else if (targetKind === "all") {
    showToast("Exibindo todas as camadas (Rádio, Câmeras e TV)");
  } else if (targetKind === "radio") {
    showToast("Filtrando: Apenas Rádios");
  } else if (targetKind === "camera") {
    showToast("Filtrando: Apenas Câmeras ao Vivo");
  } else if (targetKind === "tv") {
    showToast("Filtrando: Apenas Canais de TV");
  }

  updateGlobePoints();
  if (state.view === "city") renderMapMarkers();
}

// 24 & 25. HISTÓRICO E FAVORITOS
function recordJourney(type, item) {
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    cityId: state.city.id,
    city: state.city.name,
    country: state.city.country,
    station: type === "radio" ? item.name : state.station?.name || "",
    camera: type === "camera" ? item.name : state.camera?.name || "",
    type,
    at: new Date().toISOString()
  };

  const recent = state.recents[0];
  if (
    recent &&
    recent.cityId === entry.cityId &&
    recent.station === entry.station &&
    recent.camera === entry.camera &&
    Date.now() - Date.parse(recent.at) < 60_000
  ) {
    return;
  }

  state.recents.unshift(entry);
  state.recents = state.recents.slice(0, 40);
  writeStore("radio-atlas-journeys", state.recents);
}

function toggleFavorite(type, item) {
  if (!item) {
    return showToast(
      "Selecione uma " +
        (type === "stations" ? "rádio" : type === "cameras" ? "câmera" : "cidade") +
        " primeiro."
    );
  }
  const list = state.favorites[type];
  const index = list.findIndex((saved) => saved.id === item.id);
  if (index >= 0) {
    list.splice(index, 1);
    showToast("Removido dos favoritos.");
  } else {
    list.unshift(
      type === "places"
        ? {
            id: item.id,
            name: item.name,
            country: item.country,
            countryCode: item.countryCode,
            lat: item.lat,
            lon: item.lon,
            timezone: item.timezone
          }
        : item
    );
    showToast("Salvo nos favoritos!");
  }

  state.favorites[type] = list.slice(0, 150);
  writeStore("radio-atlas-favorites", state.favorites);

  if (type === "stations") setCurrentStation(state.station);
  if (type === "places") updateCityCopy();
  if (type === "cameras" && state.camera) {
    $("cameraFavorite").textContent = list.some((c) => c.id === item.id) ? "♥" : "♡";
  }
  if (state.page === "library") renderLibrary();
}

// NAVEGAÇÃO DE PÁGINAS (SPA)
function setPageClasses() {
  document.body.classList.remove("page-explore", "page-discover", "page-live", "page-tv", "page-library");
  document.body.classList.add(`page-${state.page}`);

  ["explore", "discover", "live", "tv", "library"].forEach((page) => {
    const view = $(page + "View");
    if (view) view.classList.toggle("hidden", state.page !== page);
  });

  document.querySelectorAll(".nav-item").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.page === state.page)
  );

  // Floating Mini-Player behavior
  if (state.camera && state.page !== "explore") {
    minimizeCamera(true);
  } else if (state.camera && state.page === "explore" && state.mini) {
    minimizeCamera(false);
  }

  if (state.page === "library") renderLibrary();
  if (state.page === "discover") renderDiscover();
  if (state.page === "live") initTvGarden();
  if (state.page === "tv") initTvView();
}

function setPage(page) {
  if (state.isTouring && page !== "live") toggleTour(false);
  state.page = page;
  setPageClasses();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 20. SEÇÃO DISCOVER (11 BLOCOS EDITORIAIS EXIGIDOS)
function renderDiscover() {
  const themes = [
    {
      eyebrow: "RIGHT NOW IN TOKYO",
      title: "Tóquio em Tempo Real",
      copy: "O cruzamento de Shibuya e as frequências da maior metrópole do planeta.",
      city: "tokyo"
    },
    {
      eyebrow: "MORNING IN EUROPE",
      title: "Manhã na Europa",
      copy: "Cafés, estações de trem e a cultura clássica de Paris e Berlim despertando.",
      city: "paris"
    },
    {
      eyebrow: "NIGHT RADIO",
      title: "Frequências Noturnas",
      copy: "Sons intimistas e rádio das madrugadas ao redor do mundo.",
      city: "london"
    },
    {
      eyebrow: "BEACHES LIVE",
      title: "Praias do Planeta",
      copy: "O calor de Copacabana e o balanço do mar em tempo real.",
      city: "rio"
    },
    {
      eyebrow: "AIRPORTS LIVE",
      title: "Asas do Mundo",
      copy: "Tráfego aéreo e chegadas internacionais nos maiores aeroportos globais.",
      city: "new-york"
    },
    {
      eyebrow: "RAINY CITIES",
      title: "Cidades Chuvosas",
      copy: "A melancolia poética das ruas molhadas e rádios acústicas de Amsterdã.",
      city: "amsterdam"
    },
    {
      eyebrow: "JAZZ AROUND THE WORLD",
      title: "Jazz Pelo Mundo",
      copy: "FIP Jazz de Paris, emissoras de Nova York e o melhor do jazz internacional.",
      city: "paris"
    },
    {
      eyebrow: "LATE NIGHT SEOUL",
      title: "Madrugada em Seul",
      copy: "Luzes de neon em Gangnam, tecnologia e ritmos urbanos da Coreia do Sul.",
      city: "seoul"
    },
    {
      eyebrow: "RIO RIGHT NOW",
      title: "Rio de Janeiro Agora",
      copy: "Bossa nova, praia, samba e a paisagem inconfundível da Guanabara.",
      city: "rio"
    },
    {
      eyebrow: "EUROPE BY RADIO",
      title: "Europa Pelo Rádio",
      copy: "Uma viagem sonora pelas capitais históricas do velho continente.",
      city: "lisbon"
    },
    {
      eyebrow: "RANDOM WINDOW",
      title: "Janela Aleatória",
      copy: "Entregue o destino ao acaso e descubra uma cidade desconhecida.",
      random: true
    }
  ];

  const grid = $("discoverGrid");
  if (!grid) return;

  grid.innerHTML = themes
    .map(
      (theme) => `
      <button class="editorial-tile" data-discover-city="${escapeHtml(theme.city || "")}" data-random="${Boolean(theme.random)}">
        <span class="tile-eyebrow">${escapeHtml(theme.eyebrow)}</span>
        <h2>${escapeHtml(theme.title)}</h2>
        <p>${escapeHtml(theme.copy)}</p>
        <span class="tile-arrow">↗</span>
      </button>`
    )
    .join("");

  grid.querySelectorAll("[data-discover-city]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (btn.dataset.random === "true") {
        surprise();
      } else {
        selectCity(btn.dataset.discoverCity);
        setPage("explore");
        setTimeout(() => activateListenAndWatch(), 800);
      }
    })
  );
}

// 22. LIVE AROUND THE WORLD (TOUR CINEMATOGRÁFICO CONTÍNUO)
function toggleTour(start) {
  if (start) {
    if (state.isTouring) return;
    state.isTouring = true;
    $("startTour").classList.add("hidden");
    $("stopTour").classList.remove("hidden");

    state.tourCountdown = 12;
    updateTourDisplay();

    // Loop de contagem regressiva e avanço
    state.tourIntervalTimer = setInterval(() => {
      state.tourCountdown--;
      if (state.tourCountdown <= 0) {
        state.tourCountdown = 12;
        advanceTourCity();
      }
      const num = $("tourProgressNumber");
      if (num) num.textContent = String(state.tourCountdown);
    }, 1000);

    showToast("Volta ao mundo iniciada! O planeta mudará a cada 12 segundos.");
    advanceTourCity();
  } else {
    state.isTouring = false;
    clearInterval(state.tourIntervalTimer);
    state.tourIntervalTimer = null;
    $("startTour").classList.remove("hidden");
    $("stopTour").classList.add("hidden");
    showToast("Volta ao mundo pausada.");
  }
}

function advanceTourCity() {
  state.tourIndex = (state.tourIndex + 1) % cities.length;
  const nextCity = cities[state.tourIndex];
  selectCity(nextCity.id);
  updateTourDisplay();

  setTimeout(() => {
    activateListenAndWatch();
  }, 1000);
}

function updateTourDisplay() {
  const city = cities[state.tourIndex] || state.city;
  const nowCity = $("tourNowCity");
  const nowDetail = $("tourNowDetail");
  if (nowCity) nowCity.textContent = `${city.name}, ${city.country}`;
  if (nowDetail) nowDetail.textContent = `Horário local: ${localTime(city)} · Atmosfera: ${getAtmosphere(city).label}`;
}

// 24 & 25. RENDERIZAÇÃO DA BIBLIOTECA (LIBRARY)
function renderLibrary() {
  const list = $("libraryList");
  if (!list) return;

  const tabs = {
    stations: state.favorites.stations,
    cameras: state.favorites.cameras,
    places: state.favorites.places,
    recent: state.recents
  };

  const items = tabs[state.libraryTab] || [];
  if (!items.length) {
    const copy =
      state.libraryTab === "recent"
        ? "Suas últimas viagens pelo mundo ficarão guardadas aqui."
        : "Nenhum item salvo nesta categoria ainda. Favorite rádios, câmeras ou cidades para acessá-las rapidamente.";
    list.innerHTML = `
      <div class="library-empty">
        <strong>Sua coleção está vazia</strong>
        ${escapeHtml(copy)}
      </div>`;
    return;
  }

  list.innerHTML = items
    .map((item) => {
      if (state.libraryTab === "recent") {
        const when = new Date(item.at).toLocaleDateString("pt-BR", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        });
        return `
          <article class="station-row">
            <span class="station-logo">🌍</span>
            <div class="station-row-main">
              <strong>${escapeHtml(item.city)} · ${escapeHtml(item.country)}</strong>
              <small>${escapeHtml([item.camera, item.station].filter(Boolean).join(" + ") || "Exploração")} · ${escapeHtml(when)}</small>
            </div>
            <button class="station-play" data-open-city="${escapeHtml(item.cityId)}" aria-label="Viajar para ${escapeHtml(item.city)}">
              ↗
            </button>
          </article>`;
      }

      const name = item.name || item.title || "Sem nome";
      const sub =
        state.libraryTab === "places"
          ? item.country
          : [item.city || item.state, item.country].filter(Boolean).join(" · ");

      return `
        <article class="station-row">
          ${stationLogo(item.favicon || item.thumbnail, name, "station-logo")}
          <div class="station-row-main">
            <strong>${escapeHtml(name)}</strong>
            <small>${escapeHtml(sub || "")}</small>
          </div>
          <button class="station-play" data-open-saved="${escapeHtml(item.id)}" aria-label="Abrir ${escapeHtml(name)}">
            ↗
          </button>
        </article>`;
    })
    .join("");

  list.querySelectorAll("[data-open-city]").forEach((btn) =>
    btn.addEventListener("click", () => {
      selectCity(btn.dataset.openCity);
      setPage("explore");
    })
  );

  list.querySelectorAll("[data-open-saved]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const station = state.favorites.stations.find((s) => s.id === btn.dataset.openSaved);
      const camera = state.favorites.cameras.find((c) => c.id === btn.dataset.openSaved);
      const place = state.favorites.places.find((p) => p.id === btn.dataset.openSaved);

      if (place) {
        selectCity(place.id);
        setPage("explore");
      } else if (station) {
        const cityMatch = cities.find((c) => c.countryCode === station.countryCode);
        if (cityMatch) selectCity(cityMatch.id);
        setPage("explore");
        playStation(station);
      } else if (camera) {
        const cityMatch = cities.find((c) => c.countryCode === camera.countryCode);
        if (cityMatch) selectCity(cityMatch.id);
        setPage("explore");
        setCamera(camera);
      }
    })
  );
}

// 23. MÓDULO TV GARDEN — WEBCAMS DO MUNDO AO VIVO (4.000+ CÂMERAS EM 95 PAÍSES)
async function initTvGarden() {
  if (state.tvgarden.initialized) return;
  state.tvgarden.initialized = true;

  try {
    const data = await request("/api/tvgarden/countries");
    if (data && Array.isArray(data.countries)) {
      state.tvgarden.countries = data.countries;
      renderTvGardenCountryBar();
      updateGlobePoints();
    }
  } catch (err) {
    console.warn("TV Garden: erro ao carregar metadados de países:", err.message);
  }

  // Input de busca com debounce
  const searchInput = $("tvgardenSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(state.tvgarden.searchTimer);
      const query = e.target.value.trim();
      state.tvgarden.search = query;
      state.tvgarden.searchTimer = setTimeout(() => {
        loadTvGardenWebcams(true);
      }, 350);
    });
  }

  // Botão carregar mais
  const loadMoreBtn = $("tvgardenLoadMore");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      state.tvgarden.offset += state.tvgarden.limit;
      loadTvGardenWebcams(false);
    });
  }

  // Carrega primeira página de webcams
  loadTvGardenWebcams(true);
}

function renderTvGardenCountryBar() {
  const container = $("tvgardenCountryFilters");
  const select = $("tvgardenCountrySelect");
  if (!container || !state.tvgarden.countries.length) return;

  // Países com maior densidade de câmeras para filtros rápidos
  const popularCodes = ["US", "JP", "IT", "NL", "ES", "GB", "CA", "MX", "BR", "DE", "FR", "AU"];
  const popular = state.tvgarden.countries.filter((c) => popularCodes.includes(c.code));

  let html = `
    <button class="tvgarden-pill active" data-country="ALL">
      <span>🌐</span>
      <span>Todas</span>
      <span class="pill-count">(${state.tvgarden.total})</span>
    </button>
  `;

  popular.forEach((c) => {
    const flag = COUNTRY_FLAGS[c.code] || "📍";
    html += `
      <button class="tvgarden-pill" data-country="${c.code}">
        <span>${flag}</span>
        <span>${escapeHtml(c.country)}</span>
        <span class="pill-count">(${c.count})</span>
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll("[data-country]").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".tvgarden-pill").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      state.tvgarden.currentCountry = btn.dataset.country;
      if (select) select.value = btn.dataset.country === "ALL" ? "" : btn.dataset.country;
      loadTvGardenWebcams(true);
    });
  });

  // Popula o select dropdown com todos os 95 países
  if (select) {
    select.innerHTML =
      '<option value="">Selecione um país (95 disponíveis)...</option>' +
      state.tvgarden.countries
        .map(
          (c) =>
            `<option value="${c.code}">${COUNTRY_FLAGS[c.code] || "📍"} ${escapeHtml(c.country)} (${c.count} câmeras)</option>`
        )
        .join("");

    select.addEventListener("change", (e) => {
      const code = e.target.value;
      if (!code) return;
      container.querySelectorAll(".tvgarden-pill").forEach((p) => {
        p.classList.toggle("active", p.dataset.country === code);
      });
      state.tvgarden.currentCountry = code;
      loadTvGardenWebcams(true);
    });
  }
}

async function loadTvGardenWebcams(reset = false) {
  if (state.tvgarden.loading) return;
  state.tvgarden.loading = true;

  if (reset) {
    state.tvgarden.offset = 0;
    state.tvgarden.webcams = [];
    const grid = $("tvgardenGrid");
    if (grid) {
      grid.innerHTML = '<div class="tvgarden-empty"><strong>Sintonizando câmeras do mundo...</strong>Carregando transmissões ao vivo autorizadas.</div>';
    }
  }

  const strip = $("tvgardenShowingCount");
  if (strip) strip.textContent = "Carregando câmeras ao vivo do TV Garden...";

  try {
    let endpoint = "";
    if (state.tvgarden.search) {
      endpoint = `/api/tvgarden/search?q=${encodeURIComponent(state.tvgarden.search)}`;
    } else if (state.tvgarden.currentCountry && state.tvgarden.currentCountry !== "ALL") {
      endpoint = `/api/tvgarden/webcams?country=${encodeURIComponent(state.tvgarden.currentCountry)}`;
    } else {
      endpoint = `/api/tvgarden/webcams?limit=${state.tvgarden.limit}&offset=${state.tvgarden.offset}`;
    }

    const data = await request(endpoint);
    let items = [];
    if (data.webcams) items = data.webcams;
    else if (Array.isArray(data)) items = data;

    if (reset) {
      state.tvgarden.webcams = items;
    } else {
      state.tvgarden.webcams = [...state.tvgarden.webcams, ...items];
    }

    renderTvGardenGrid();

    // Atualiza strip de contagem
    if (strip) {
      const shown = state.tvgarden.webcams.length;
      if (state.tvgarden.search) {
        strip.textContent = `Encontradas ${shown} transmissões para "${state.tvgarden.search}"`;
      } else if (state.tvgarden.currentCountry !== "ALL") {
        const cObj = state.tvgarden.countries.find((c) => c.code === state.tvgarden.currentCountry);
        const cName = cObj ? cObj.country : state.tvgarden.currentCountry;
        strip.textContent = `Exibindo ${shown} câmeras ao vivo em ${cName}`;
      } else {
        strip.textContent = `Exibindo ${shown} de ${state.tvgarden.total} transmissões em 95 países`;
      }
    }

    // Gerencia visibilidade do botão carregar mais
    const loadMoreBtn = $("tvgardenLoadMore");
    if (loadMoreBtn) {
      const isFiltered = Boolean(state.tvgarden.search) || state.tvgarden.currentCountry !== "ALL";
      loadMoreBtn.classList.toggle("hidden", isFiltered || items.length < state.tvgarden.limit);
    }
  } catch (err) {
    console.warn("TV Garden: erro ao buscar câmeras:", err.message);
    const grid = $("tvgardenGrid");
    if (grid && !state.tvgarden.webcams.length) {
      grid.innerHTML = '<div class="tvgarden-empty"><strong>Nenhuma transmissão encontrada</strong>Tente outro país ou termo de busca.</div>';
    }
  } finally {
    state.tvgarden.loading = false;
  }
}

function renderTvGardenGrid() {
  const grid = $("tvgardenGrid");
  if (!grid) return;

  if (!state.tvgarden.webcams.length) {
    grid.innerHTML = `
      <div class="tvgarden-empty">
        <strong>Nenhuma transmissão encontrada</strong>
        Não localizamos câmeras com esses critérios. Tente selecionar outro país ou limpar o campo de busca.
      </div>`;
    return;
  }

  grid.innerHTML = state.tvgarden.webcams
    .map((cam) => {
      const thumb = getWebcamThumbnail(cam);
      const flag = COUNTRY_FLAGS[cam.countryCode] || "📍";
      const isYoutube = cam.streamType === "youtube";
      const streamTag = isYoutube ? "YOUTUBE" : "HLS";
      const locationText = [cam.capital || cam.city, cam.country].filter(Boolean).join(" · ");

      return `
        <article class="tvgarden-card" data-webcam-id="${escapeHtml(cam.id)}">
          <div class="tvgarden-card-thumb">
            ${
              thumb
                ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(cam.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'tvgarden-card-thumb-fallback\\'>${escapeHtml(cam.name)}</div>'">`
                : `<div class="tvgarden-card-thumb-fallback">${escapeHtml(cam.name)}</div>`
            }
            <span class="tvgarden-card-badge"><i></i> AO VIVO</span>
            <span class="tvgarden-card-type">${streamTag}</span>
          </div>
          <div class="tvgarden-card-body">
            <h3 class="tvgarden-card-title" title="${escapeHtml(cam.name)}">${escapeHtml(cam.name)}</h3>
            <div class="tvgarden-card-location">
              <span class="country-flag">${flag}</span>
              <span>${escapeHtml(locationText)}</span>
            </div>
            <div class="tvgarden-card-actions">
              <button class="tvgarden-btn-watch" data-watch-cam="${escapeHtml(cam.id)}" title="Assistir transmissão agora">
                <span>▶</span>
                <span>Assistir</span>
              </button>
              <button class="tvgarden-btn-combo" data-combo-cam="${escapeHtml(cam.id)}" title="Ouvir rádio local e assistir vídeo simultaneamente">
                <span>⚡</span>
                <span>Ouvir + Ver</span>
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  grid.querySelectorAll("[data-watch-cam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cam = state.tvgarden.webcams.find((c) => c.id === btn.dataset.watchCam);
      if (cam) openTvGardenCamera(cam, false);
    });
  });

  grid.querySelectorAll("[data-combo-cam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cam = state.tvgarden.webcams.find((c) => c.id === btn.dataset.comboCam);
      if (cam) openTvGardenCamera(cam, true);
    });
  });
}

async function openTvGardenCamera(cam, autoListen = false) {
  setCamera(cam);
  showToast(`📹 Assistindo ${cam.name} (${cam.country || 'Ao Vivo'})`);

  if (autoListen) {
    showToast(`⚡ Sintonizando som local + transmitindo imagem ao vivo...`);
    const code = cam.countryCode;
    const placeMatch = state.radioGardenPlaces.find((p) => {
      const pCode = p.countryCode || getCountryCode(p.country);
      return pCode === code;
    });

    if (placeMatch) {
      tuneToRadioGardenPlace(placeMatch, true);
    } else {
      activateListenAndWatch();
    }
  }
}

async function openTvGardenCountryWebcams(country) {
  showToast(`📹 Explorando webcams de ${country.country}...`);
  try {
    const data = await request(`/api/tvgarden/webcams?country=${encodeURIComponent(country.code)}`);
    if (data?.webcams?.length) {
      state.cameras = data.webcams;
      state.drawerType = "cameras";
      $("drawerTitle").textContent = `Câmeras em ${country.country}`;
      $("drawerEyebrow").textContent = `TV GARDEN · ${data.webcams.length} TRANSMISSÕES`;
      $("drawerSummary").textContent = `${data.webcams.length} câmeras ao vivo encontradas em ${country.country}`;
      updateDrawerState(true);
      renderCameraList();
      setCamera(data.webcams[0]);
    } else {
      showToast(`Nenhuma webcam encontrada para ${country.country}.`);
    }
  } catch (err) {
    showToast(`Não foi possível carregar câmeras de ${country.country}.`);
  }
}

// ==========================================
// 24. MÓDULO TV GARDEN — CANAIS DE TV AO VIVO (6.700+ CANAIS EM 172 PAÍSES)
// ==========================================
function getTvChannelThumbnail(channel) {
  if (channel.streamType === "youtube" && (channel.embedUrl || channel.streamUrl)) {
    const url = channel.embedUrl || channel.streamUrl;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|live\/))([a-zA-Z0-9_-]{11})/);
    if (match) return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return "";
}

async function openTvChannel(channel, autoListen = false) {
  if (!channel) return;
  channel.isTv = true;
  channel.provider = "TV Garden TV";
  state.drawerType = "tv";
  setCamera(channel);
  showToast(`📺 Assistindo ao canal ${channel.name} (${channel.country || 'Ao Vivo'})`);

  if (autoListen) {
    showToast(`⚡ Sintonizando som local + transmitindo canal de TV...`);
    const code = channel.countryCode;
    const placeMatch = state.radioGardenPlaces.find((p) => {
      const pCode = p.countryCode || getCountryCode(p.country);
      return pCode === code;
    });

    if (placeMatch) {
      tuneToRadioGardenPlace(placeMatch, true);
    } else {
      activateListenAndWatch();
    }
  }
}

async function openTvCountryChannels(country) {
  showToast(`📺 Sintonizando canais de TV de ${country.country}...`);
  try {
    const data = await request(`/api/tvgarden/tv/channels?country=${encodeURIComponent(country.code)}`);
    if (data?.channels?.length) {
      state.tvChannels = data.channels.map((ch) => ({
        ...ch,
        isTv: true,
        provider: "TV Garden TV",
        country: ch.country || country.country,
        countryCode: ch.countryCode || country.code
      }));
      state.drawerType = "tv";
      openTvChannel(state.tvChannels[0]);
    } else {
      showToast(`Nenhum canal de TV encontrado para ${country.country}.`);
    }
  } catch (err) {
    showToast(`Não foi possível carregar canais de TV de ${country.country}.`);
  }
}

function openTvSidebarForCurrentCity() {
  const city = state.city;
  const countryName = city.country || "Região";

  state.drawerType = "tv";
  const drawer = $("stationDrawer");
  drawer.classList.add("camera-sidebar-glass");
  $("drawerTitle").textContent = `Canais de TV em ${countryName}`;
  $("drawerEyebrow").textContent = `TV GARDEN · CANAIS AO VIVO`;
  $("drawerSummary").textContent = `${state.tvChannels.length} emissoras de TV disponíveis nesta localidade`;
  $("loadMore").classList.add("hidden");
  updateDrawerState(true);

  if (state.tvChannels.length > 0) {
    renderTvDrawerList();
  } else {
    loadTvChannels().then(() => renderTvDrawerList());
  }
}

function renderTvDrawerList() {
  const list = $("stationList");
  if (!list) return;
  if (!state.tvChannels.length) {
    list.innerHTML = `<div class="station-empty">Nenhum canal de TV disponível para esta localidade. Escolha outro país ou explore a aba "Canais de TV".</div>`;
    return;
  }

  list.innerHTML = state.tvChannels
    .map((ch) => {
      const isCurrent = state.camera?.id === ch.id;
      const flag = COUNTRY_FLAGS[ch.countryCode] || "📺";
      const typeLabel = ch.streamType === "youtube" ? "YOUTUBE" : "HLS";
      return `
        <article class="station-card${isCurrent ? " playing" : ""}" data-tv-id="${escapeHtml(ch.id)}" style="cursor: pointer;">
          <div class="station-main">
            <div class="station-meta">
              <strong class="station-name">${escapeHtml(ch.name)}</strong>
              <span class="station-sub">${flag} ${escapeHtml(ch.country || '')} · <span style="color:#00e5ff;font-weight:700;">${typeLabel}</span></span>
            </div>
          </div>
          <button class="station-action-btn" data-open-tv="${escapeHtml(ch.id)}" title="Assistir ${escapeHtml(ch.name)}">
            ${isCurrent ? "▶ AO VIVO" : "ASSISTIR"}
          </button>
        </article>
      `;
    })
    .join("");

  list.querySelectorAll(".station-card").forEach((card) => {
    card.addEventListener("click", () => {
      const ch = state.tvChannels.find((item) => item.id === card.dataset.tvId);
      if (ch) {
        openTvChannel(ch);
        renderTvDrawerList();
      }
    });
  });
}

// INICIALIZAÇÃO DA SEÇÃO DEDICADA DE CANAIS DE TV (#tvView)
async function initTvView() {
  if (state.tv.initialized) return;
  state.tv.initialized = true;

  try {
    const data = await request("/api/tvgarden/tv/countries");
    if (data && Array.isArray(data.countries)) {
      state.tv.countries = data.countries;
      renderTvCountryBar();
      updateGlobePoints();
    }
  } catch (err) {
    console.warn("TV Garden: erro ao carregar metadados de TV:", err.message);
  }

  const searchInput = $("tvSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(state.tv.searchTimer);
      const query = e.target.value.trim();
      state.tv.search = query;
      state.tv.searchTimer = setTimeout(() => {
        loadTvChannelsCatalog(true);
      }, 350);
    });
  }

  const loadMoreBtn = $("tvLoadMore");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      state.tv.offset += state.tv.limit;
      loadTvChannelsCatalog(false);
    });
  }

  loadTvChannelsCatalog(true);
}

function renderTvCountryBar() {
  const container = $("tvCountryFilters");
  const select = $("tvCountrySelect");
  if (!container || !state.tv.countries.length) return;

  const popularCodes = ["BR", "US", "IN", "GB", "AR", "CL", "IT", "FR", "DE", "ES", "TR", "CA", "MX", "JP"];
  const popular = state.tv.countries.filter((c) => popularCodes.includes(c.code));

  let html = `
    <button class="tvgarden-pill active" data-tv-country="ALL">
      <span>🌐</span>
      <span>Todos</span>
      <span class="pill-count">(${state.tv.total})</span>
    </button>
  `;

  popular.forEach((c) => {
    const flag = COUNTRY_FLAGS[c.code] || "📺";
    html += `
      <button class="tvgarden-pill" data-tv-country="${c.code}">
        <span>${flag}</span>
        <span>${escapeHtml(c.country)}</span>
        <span class="pill-count">(${c.count})</span>
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll("[data-tv-country]").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".tvgarden-pill").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      state.tv.currentCountry = btn.dataset.tvCountry;
      if (select) select.value = btn.dataset.tvCountry === "ALL" ? "" : btn.dataset.tvCountry;
      loadTvChannelsCatalog(true);
    });
  });

  if (select) {
    select.innerHTML =
      '<option value="">Selecione um país (172 disponíveis)...</option>' +
      state.tv.countries
        .map(
          (c) =>
            `<option value="${c.code}">${COUNTRY_FLAGS[c.code] || "📺"} ${escapeHtml(c.country)} (${c.count} canais)</option>`
        )
        .join("");

    select.addEventListener("change", (e) => {
      const code = e.target.value;
      if (!code) return;
      container.querySelectorAll(".tvgarden-pill").forEach((p) => {
        p.classList.toggle("active", p.dataset.tvCountry === code);
      });
      state.tv.currentCountry = code;
      loadTvChannelsCatalog(true);
    });
  }
}

async function loadTvChannelsCatalog(reset = false) {
  if (state.tv.loading) return;
  state.tv.loading = true;

  if (reset) {
    state.tv.offset = 0;
    state.tv.channels = [];
    const grid = $("tvGrid");
    if (grid) {
      grid.innerHTML = '<div class="tvgarden-empty"><strong>Sintonizando canais de TV do mundo...</strong>Carregando redes de televisão ao vivo.</div>';
    }
  }

  const strip = $("tvShowingCount");
  if (strip) strip.textContent = "Carregando canais de TV do TV Garden...";

  try {
    let endpoint = "";
    if (state.tv.search) {
      endpoint = `/api/tvgarden/tv/search?q=${encodeURIComponent(state.tv.search)}`;
    } else if (state.tv.currentCountry && state.tv.currentCountry !== "ALL") {
      endpoint = `/api/tvgarden/tv/channels?country=${encodeURIComponent(state.tv.currentCountry)}`;
    } else {
      endpoint = `/api/tvgarden/tv/channels?limit=${state.tv.limit}&offset=${state.tv.offset}`;
    }

    const data = await request(endpoint);
    let items = [];
    if (data.channels) items = data.channels;
    else if (Array.isArray(data)) items = data;

    if (reset) {
      state.tv.channels = items;
    } else {
      state.tv.channels = [...state.tv.channels, ...items];
    }

    renderTvGrid();

    if (strip) {
      const currentCount = state.tv.channels.length;
      const countryLabel =
        state.tv.currentCountry && state.tv.currentCountry !== "ALL"
          ? `em ${state.tv.countries.find((c) => c.code === state.tv.currentCountry)?.country || state.tv.currentCountry}`
          : "no planeta";
      strip.textContent = `Exibindo ${currentCount} canais de televisão ao vivo ${countryLabel}`;
    }
  } catch (err) {
    console.warn("Erro ao buscar canais de TV:", err.message);
  } finally {
    state.tv.loading = false;
  }
}

function renderTvGrid() {
  const grid = $("tvGrid");
  if (!grid) return;

  if (!state.tv.channels.length) {
    grid.innerHTML = `
      <div class="tvgarden-empty">
        <strong>Nenhum canal de TV encontrado</strong>
        Não localizamos emissoras com esses termos. Selecione outro país ou limpe a busca.
      </div>`;
    return;
  }

  grid.innerHTML = state.tv.channels
    .map((ch) => {
      const thumb = getTvChannelThumbnail(ch);
      const flag = COUNTRY_FLAGS[ch.countryCode] || "📺";
      const isYoutube = ch.streamType === "youtube";
      const streamTag = isYoutube ? "YOUTUBE" : "HLS";
      const locationText = ch.country || "Global";

      return `
        <article class="tvgarden-card" data-channel-id="${escapeHtml(ch.id)}">
          <div class="tvgarden-card-thumb" style="background:#0a121e;">
            ${
              thumb
                ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(ch.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'tvgarden-card-thumb-fallback\\'>📺 ${escapeHtml(ch.name)}</div>'">`
                : `<div class="tvgarden-card-thumb-fallback" style="color:#00e5ff;font-size:16px;">📺 ${escapeHtml(ch.name)}</div>`
            }
            <span class="tvgarden-card-badge" style="background:rgba(0,229,255,0.2);color:#00e5ff;border-color:rgba(0,229,255,0.4);"><i style="background:#00e5ff;"></i> AO VIVO</span>
            <span class="tvgarden-card-type" style="background:rgba(0,0,0,0.7);color:#80d8ff;">${streamTag}</span>
          </div>
          <div class="tvgarden-card-body">
            <h3 class="tvgarden-card-title" title="${escapeHtml(ch.name)}">${escapeHtml(ch.name)}</h3>
            <div class="tvgarden-card-location">
              <span class="country-flag">${flag}</span>
              <span>${escapeHtml(locationText)}</span>
            </div>
            <div class="tvgarden-card-actions">
              <button class="tvgarden-btn-watch" data-watch-tv="${escapeHtml(ch.id)}" style="background:linear-gradient(135deg,rgba(0,229,255,0.25),rgba(0,176,255,0.35));border-color:rgba(0,229,255,0.6);color:#e0f7fa;" title="Assistir canal agora">
                <span>▶</span>
                <span>Assistir TV</span>
              </button>
              <button class="tvgarden-btn-combo" data-combo-tv="${escapeHtml(ch.id)}" title="Ouvir rádio local e assistir TV simultaneamente">
                <span>⚡</span>
                <span>Ouvir + TV</span>
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  grid.querySelectorAll("[data-watch-tv]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ch = state.tv.channels.find((c) => c.id === btn.dataset.watchTv);
      if (ch) openTvChannel(ch, false);
    });
  });

  grid.querySelectorAll("[data-combo-tv]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ch = state.tv.channels.find((c) => c.id === btn.dataset.comboTv);
      if (ch) openTvChannel(ch, true);
    });
  });
}

// 21. RANDOM TELEPORT ("SOMEWHERE NEW" / "SURPRISE ME")
function surprise() {
  if (state.radioGardenPlaces.length > 0) {
    const next = state.radioGardenPlaces[Math.floor(Math.random() * state.radioGardenPlaces.length)];
    if (state.globe) {
      state.globe.pointOfView({ lat: next.lat, lng: next.lon, altitude: 1.15 }, 1500);
    }
    tuneToRadioGardenPlace(next, true);
    setPage("explore");
    showToast(`✈️ Transportando para ${next.title}, ${next.country}...`);
    return;
  }
  const others = cities.filter((c) => c.id !== state.city.id);
  const next = others[Math.floor(Math.random() * others.length)];
  selectCity(next.id);
  setPage("explore");
  showToast(`Transportando para ${next.name}, ${next.country}...`);
}

// 9. COMMAND PALETTE (BUSCA GLOBAL ⌘K)
function setSearchOpen(open) {
  $("searchBackdrop").classList.toggle("hidden", !open);
  $("filterPopover").classList.add("hidden");
  if (open) {
    $("commandInput").value = "";
    state.searchItems = [];
    state.searchIndex = 0;
    state.searchStationResults = [];
    $("commandResults").innerHTML =
      '<div class="command-empty">Digite o nome de uma cidade, país, estação de rádio, webcam ou gênero musical.</div>';
    setTimeout(() => $("commandInput").focus(), 30);
  } else {
    $("openSearch").focus();
  }
}

function renderSearchResults(query, stations = [], fetchedCameras = [], fetchedTv = []) {
  const cityResults = cities
    .filter(
      (c) =>
        textMatch(c.name, query) ||
        textMatch(c.english, query) ||
        textMatch(c.country, query) ||
        textMatch(c.countryCode, query)
    )
    .slice(0, 6)
    .map((c) => ({ type: "city", city: c }));

  const radioResults = stations.slice(0, 8).map((s) => ({ type: "station", station: s }));
  state.searchStationResults = stations;

  const localCamResults = state.cameras
    .filter((c) => textMatch(c.name, query) || textMatch(c.city, query))
    .slice(0, 5);

  const allCams = [...localCamResults, ...fetchedCameras];
  const uniqueCams = [];
  const camIds = new Set();
  for (const c of allCams) {
    if (!camIds.has(c.id)) {
      camIds.add(c.id);
      uniqueCams.push(c);
    }
  }

  const cameraResults = uniqueCams.slice(0, 6).map((c) => ({ type: "camera", camera: c }));
  const tvResults = (fetchedTv || []).slice(0, 8).map((t) => ({ type: "tv", channel: t }));

  const results = cityResults.concat(tvResults, cameraResults, radioResults);
  state.searchItems = results;
  state.searchIndex = Math.min(state.searchIndex, Math.max(0, results.length - 1));

  if (!query.trim()) {
    $("commandResults").innerHTML =
      '<div class="command-empty">Digite o nome de uma cidade, país, rádio, canal de TV ou gênero.</div>';
    return;
  }
  if (!results.length) {
    $("commandResults").innerHTML =
      '<div class="command-empty">Nenhum resultado encontrado. Tente outro termo ou nome de emissora.</div>';
    return;
  }

  const groups = [
    ["CIDADES", cityResults],
    ["CANAIS DE TV AO VIVO (TV GARDEN)", tvResults],
    ["CÂMERAS AO VIVO (TV GARDEN & MUNDO)", cameraResults],
    ["RÁDIOS AO VIVO", radioResults]
  ].filter((g) => g[1].length);

  let idx = 0;
  $("commandResults").innerHTML = groups
    .map((group) => {
      const items = group[1]
        .map((item) => {
          const current = idx++;
          let title, detail, type, icon;
          if (item.type === "city") {
            title = item.city.name;
            detail = `${item.city.country} · ${item.city.countryCode}`;
            type = "CIDADE";
            icon = "🌍";
          } else if (item.type === "tv") {
            title = item.channel.name;
            detail = `${item.channel.country || 'Global'} · ${item.channel.streamType === 'youtube' ? 'YouTube' : 'HLS'}`;
            type = "CANAL TV";
            icon = "📺";
          } else if (item.type === "camera") {
            title = item.camera.name;
            detail = [item.camera.city || item.camera.capital, item.camera.country].filter(Boolean).join(" · ");
            type = "CÂMERA";
            icon = "📹";
          } else {
            title = item.station.name;
            detail = [item.station.country, item.station.genres?.[0]].filter(Boolean).join(" · ");
            type = "RÁDIO";
            icon = "📻";
          }

          return `
            <button class="command-result${current === state.searchIndex ? " active" : ""}" role="option" aria-selected="${current === state.searchIndex}" data-result-index="${current}">
              <span class="command-result-icon">${icon}</span>
              <span class="command-result-copy">
                <strong>${escapeHtml(title)}</strong>
                <small>${escapeHtml(detail)}</small>
              </span>
              <span class="command-result-type">${type}</span>
            </button>`;
        })
        .join("");

      return `<div class="command-group-label">${group[0]}</div>` + items;
    })
    .join("");

  $("commandResults")
    .querySelectorAll("[data-result-index]")
    .forEach((btn) =>
      btn.addEventListener("click", () => selectSearchResult(Number(btn.dataset.resultIndex)))
    );
}

async function searchWorld(query) {
  clearTimeout(state.searchTimer);
  renderSearchResults(query, [], [], []);
  if (query.trim().length < 2) return;

  state.searchTimer = setTimeout(async () => {
    try {
      const data = await request(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if ($("searchBackdrop").classList.contains("hidden") || $("commandInput").value.trim() !== query.trim())
        return;
      renderSearchResults(query, data.stations || [], data.cameras || [], data.tvChannels || []);
    } catch {
      if ($("commandInput").value.trim() === query.trim()) renderSearchResults(query, [], [], []);
    }
  }, 220);
}

function selectSearchResult(index) {
  const item = state.searchItems[index];
  if (!item) return;
  setSearchOpen(false);

  if (item.type === "city") {
    selectCity(item.city.id);
    setPage("explore");
  } else if (item.type === "tv") {
    const city = cities.find((c) => c.countryCode === item.channel.countryCode);
    if (city) selectCity(city.id);
    setPage("explore");
    openTvChannel(item.channel);
  } else if (item.type === "station") {
    const city = cities.find((c) => c.countryCode === item.station.countryCode);
    if (city) selectCity(city.id);
    setPage("explore");
    setCurrentStation(item.station);
    playStation(item.station);
    openStationDrawer();
  } else if (item.type === "camera") {
    const city = cities.find((c) => c.countryCode === item.camera.countryCode);
    if (city) selectCity(city.id);
    setPage("explore");
    setCamera(item.camera);
  }
}

// SINCRONIZAÇÃO E CONTROLE VETORIAL DE VOLUME E MUDO
function updateVolumeUI() {
  const isMuted = audio.muted || audio.volume === 0;
  const btn = $("muteButton");
  if (!btn) return;
  btn.classList.toggle("is-muted", isMuted);
  const muteLines = btn.querySelectorAll(".vol-mute-line");
  const wave1 = btn.querySelector(".vol-wave-1");
  const wave2 = btn.querySelector(".vol-wave-2");

  if (isMuted) {
    muteLines.forEach((l) => l.classList.remove("hidden"));
    wave1?.classList.add("hidden");
    wave2?.classList.add("hidden");
  } else if (audio.volume < 0.45) {
    muteLines.forEach((l) => l.classList.add("hidden"));
    wave1?.classList.remove("hidden");
    wave2?.classList.add("hidden");
  } else {
    muteLines.forEach((l) => l.classList.add("hidden"));
    wave1?.classList.remove("hidden");
    wave2?.classList.remove("hidden");
  }
}

function syncVolume() {
  audio.volume = Number($("volumeSlider").value);
  audio.muted = audio.volume === 0;
  updateVolumeUI();
}

// SISTEMA AVANÇADO DE TEMPORIZADOR DE DESLIGAMENTO AUTOMÁTICO (SLEEP TIMER)
function setSleepTimer(minutes) {
  if (state.sleepTimer) {
    clearTimeout(state.sleepTimer);
    state.sleepTimer = null;
  }
  if (state.sleepTimerInterval) {
    clearInterval(state.sleepTimerInterval);
    state.sleepTimerInterval = null;
  }

  const badge = $("sleepBadge");
  const btn = $("sleepButton");
  const cancelBtn = $("cancelSleepTimer");
  const popover = $("sleepTimerPopover");

  document.querySelectorAll(".sleep-opt").forEach((opt) => {
    opt.classList.toggle("active", Number(opt.dataset.minutes) === minutes);
  });

  if (!minutes || minutes <= 0) {
    state.sleepTimerEnd = null;
    badge?.classList.add("hidden");
    btn?.classList.remove("active");
    cancelBtn?.classList.add("hidden");
    popover?.classList.add("hidden");
    showToast("Temporizador de desligamento cancelado.");
    return;
  }

  const durationMs = minutes * 60 * 1000;
  state.sleepTimerEnd = Date.now() + durationMs;

  const updateBadge = () => {
    const remainMs = state.sleepTimerEnd - Date.now();
    if (remainMs <= 0) {
      clearInterval(state.sleepTimerInterval);
      state.sleepTimerInterval = null;
      state.sleepTimer = null;
      badge?.classList.add("hidden");
      btn?.classList.remove("active");
      cancelBtn?.classList.add("hidden");
      audio.pause();
      renderPlayState("paused");
      showToast("☾ Boa noite: a rádio foi desligada pelo temporizador.");
      return;
    }
    const remainMin = Math.ceil(remainMs / 60000);
    if (badge) {
      badge.textContent = remainMin >= 60 ? `${Math.floor(remainMin / 60)}h${remainMin % 60}m` : `${remainMin}m`;
      badge.classList.remove("hidden");
    }
  };

  btn?.classList.add("active");
  cancelBtn?.classList.remove("hidden");
  updateBadge();
  state.sleepTimerInterval = setInterval(updateBadge, 15000);

  state.sleepTimer = setTimeout(() => {
    clearInterval(state.sleepTimerInterval);
    state.sleepTimerInterval = null;
    state.sleepTimer = null;
    badge?.classList.add("hidden");
    btn?.classList.remove("active");
    cancelBtn?.classList.add("hidden");
    audio.pause();
    renderPlayState("paused");
    showToast("☾ Boa noite: a rádio foi desligada pelo temporizador.");
  }, durationMs);

  popover?.classList.add("hidden");
  const labelText = minutes >= 60 ? `${minutes / 60}h` : `${minutes} minutos`;
  showToast(`☾ Temporizador ativado: a rádio desligará em ${labelText}.`);
}

function stepStation(direction) {
  if (!state.stations.length) return openStationDrawer();
  let index = state.stations.findIndex((s) => s.id === state.station?.id);
  index = (index + direction + state.stations.length) % state.stations.length;
  playStation(state.stations[index]);
}

// INICIALIZAÇÃO DE EVENTOS
function setupEvents() {
  // 39. TELA DE ABERTURA
  const closeWelcome = () => {
    const welcome = $("welcome");
    if (!welcome || welcome.classList.contains("hidden")) return;
    welcome.classList.add("fade-out");
    setTimeout(() => welcome.classList.add("hidden"), 500);
    if (state.globe) {
      state.globe.pointOfView({ lat: state.city.lat, lng: state.city.lon, altitude: 1.6 }, 1400);
    }
  };
  $("enterAtlas")?.addEventListener("click", closeWelcome);
  $("welcome")?.addEventListener("click", (e) => {
    if (e.target.id === "welcome" || e.target.classList.contains("welcome-glow")) closeWelcome();
  });

  // Topbar Navegação
  document.querySelectorAll(".nav-item").forEach((btn) =>
    btn.addEventListener("click", () => setPage(btn.dataset.page))
  );

  // Filtro ALL / RADIO / CAMERAS
  document.querySelectorAll("[data-kind]").forEach((btn) =>
    btn.addEventListener("click", () => setKind(btn.dataset.kind))
  );

  // Alternância GLOBE / MAP
  document.querySelectorAll(".view-toggle-btn").forEach((btn) =>
    btn.addEventListener("click", () => setView(btn.dataset.view))
  );

  // Abas da Coleção
  document.querySelectorAll(".library-tab").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.libraryTab = btn.dataset.library;
      document.querySelectorAll(".library-tab").forEach((tab) =>
        tab.classList.toggle("active", tab === btn)
      );
      renderLibrary();
    })
  );

  // Busca e Command Palette
  $("openSearch").addEventListener("click", () => setSearchOpen(true));
  $("commandInput").addEventListener("input", (e) => searchWorld(e.target.value));
  $("searchBackdrop").addEventListener("click", (e) => {
    if (e.target === $("searchBackdrop")) setSearchOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setSearchOpen(true);
      return;
    }
    if (!$("searchBackdrop").classList.contains("hidden")) {
      if (e.key === "Escape") {
        setSearchOpen(false);
        return;
      }
      if (e.key === "ArrowDown" && state.searchItems.length) {
        e.preventDefault();
        state.searchIndex = (state.searchIndex + 1) % state.searchItems.length;
        renderSearchResults($("commandInput").value, state.searchStationResults);
      }
      if (e.key === "ArrowUp" && state.searchItems.length) {
        e.preventDefault();
        state.searchIndex =
          (state.searchIndex + state.searchItems.length - 1) % state.searchItems.length;
        renderSearchResults($("commandInput").value, state.searchStationResults);
      }
      if (e.key === "Enter" && state.searchItems.length) {
        e.preventDefault();
        selectSearchResult(state.searchIndex);
      }
    }
  });

  // Filtro Popover
  $("filterButton").addEventListener("click", () => $("filterPopover").classList.toggle("hidden"));
  document.addEventListener("click", (e) => {
    if (
      !$("filterPopover").classList.contains("hidden") &&
      !e.target.closest("#filterPopover") &&
      !e.target.closest("#filterButton")
    ) {
      $("filterPopover").classList.add("hidden");
    }
  });

  // Botões Centrais do Hero
  $("findStation")?.addEventListener("click", openStationDrawer);
  $("findCamera")?.addEventListener("click", async () => {
    await loadCameras();
    updateDrawerState(true);
    renderCameraList();
  });
  $("findTv")?.addEventListener("click", () => openTvSidebarForCurrentCity());
  $("listenWatchMain")?.addEventListener("click", activateListenAndWatch);
  $("listenWatch")?.addEventListener("click", activateListenAndWatch);
  $("surpriseButton")?.addEventListener("click", surprise);
  $("featuredStation")?.addEventListener("click", () => {
    if (state.station) playStation(state.station);
    else openStationDrawer();
  });

  // Recursos Windy API: Previsão do Tempo, Forma A (Radar Fullscreen) e Forma B (Ventos 3D Globo)
  $("localAtmosphere")?.addEventListener("click", () => toggleWeatherCard());
  $("closeWeatherCard")?.addEventListener("click", () => toggleWeatherCard(false));

  // Camada de Aeroportos do Mundo (ArcGIS)
  $("btnAirports")?.addEventListener("click", () => toggleAirports());

  // Radar e Mapa de Ventos Windy em Tela Cheia
  $("btnWindMap")?.addEventListener("click", () => toggleWindyMap());
  $("weatherOpenMapBtn")?.addEventListener("click", () => {
    toggleWeatherCard(false);
    toggleWindyMap(true);
  });
  $("toggleWindyMap")?.addEventListener("click", () => toggleWindyMap());
  $("closeWindyMapBtn")?.addEventListener("click", () => toggleWindyMap(false));
  document.querySelectorAll("[data-windy-layer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleWindyMap(true, btn.dataset.windyLayer);
    });
  });

  // Fechar e alternar barra inferior de previsão horária 7D (Botão Articulado Inferior Esquerdo)
  $("btnToggleWindyDetail")?.addEventListener("click", () => {
    state.windyDetailOpen = !state.windyDetailOpen;
    updateWindyMap();
    showToast(state.windyDetailOpen ? "📊 Tabela de previsão horária 7D aberta" : "📊 Tabela de previsão horária 7D recolhida");
  });



  // Drawer
  $("closeDrawer")?.addEventListener("click", closeStationDrawer);
  $("loadMore")?.addEventListener("click", () => loadStations(true));

  // Câmera & Mini-Player
  $("cameraAudioBtn")?.addEventListener("click", () => {
    if (state.cameraPlayerInstance) {
      const isMuted = state.cameraPlayerInstance.toggleMute();
      updateAudioButtonUI();
      showToast(isMuted ? "🔇 Áudio desativado (Mudo)" : "🔊 Áudio ativado");
    }
  });
  $("changeCamera")?.addEventListener("click", () => {
    if (state.camera?.isTv || state.camera?.provider === "TV Garden TV" || state.drawerType === "tv") {
      openTvDrawer();
    } else {
      openCameraSidebar();
    }
  });
  $("minimizeCamera")?.addEventListener("click", () => minimizeCamera(true));
  $("expandMini")?.addEventListener("click", () => minimizeCamera(false));
  $("closeMini")?.addEventListener("click", () => setCamera(null));
  $("closeCameraView")?.addEventListener("click", () => setCamera(null));
  $("fullscreenCamera")?.addEventListener("click", () => {
    const frame = $("cameraFrame");
    if (!document.fullscreenElement) {
      frame?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });
  $("backToGlobe")?.addEventListener("click", () => setCamera(null));

  // Destinos e Controles do Globo
  $("railNext")?.addEventListener("click", () =>
    $("destinationRail")?.scrollBy({ left: 320, behavior: "smooth" })
  );
  $("zoomIn").addEventListener("click", () => {
    if (state.view === "city" && state.map) {
      state.map.zoomIn({ duration: 300 });
    } else if (state.globe) {
      const view = state.globe.pointOfView();
      state.globe.pointOfView({ lat: view.lat, lng: view.lng, altitude: Math.max(0.005, view.altitude * 0.70) }, 300);
    }
  });
  $("zoomOut").addEventListener("click", () => {
    if (state.view === "city" && state.map) {
      state.map.zoomOut({ duration: 300 });
    } else if (state.globe) {
      const view = state.globe.pointOfView();
      state.globe.pointOfView({ lat: view.lat, lng: view.lng, altitude: Math.min(3.5, view.altitude * 1.35) }, 300);
    }
  });
  $("resetGlobe").addEventListener("click", () => {
    if (state.view === "city" && state.map) {
      state.map.flyTo({ center: [state.city.lon, state.city.lat], zoom: 10.5, duration: 700 });
    } else {
      // Sincroniza os dois botões: restaura a rotação do globo e atualiza o botão para ⏸ (pausar)
      state.autoRotatePaused = false;
      const c = state.globe?.controls?.();
      if (c) c.autoRotate = true;
      document.body.classList.add("is-orbiting");
      syncAutoRotateUI();

      state.globe?.pointOfView({ lat: state.city.lat, lng: state.city.lon, altitude: 1.6 }, 700);
      showToast("Globo reorientado e rotação retomada");
    }
  });
  $("toggleAutoRotate")?.addEventListener("click", () => {
    toggleAutoRotate();
  });

  // Geolocalização
  $("locateMe").addEventListener("click", () => {
    if (!navigator.geolocation) return showToast("Geolocalização não suportada neste navegador.");
    showToast("Detectando localização...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const nearest = cities.reduce(
          (best, c) =>
            distanceKm(latitude, longitude, c.lat, c.lon) < distanceKm(latitude, longitude, best.lat, best.lon)
              ? c
              : best,
          cities[0]
        );
        selectCity(nearest.id);
        showToast(`Destino mais próximo: ${nearest.name}`);
      },
      () => showToast("Não foi possível acessar a localização. Você segue navegando pelo mapa.")
    );
  });

  // Player de Áudio
  $("playPause").addEventListener("click", () => {
    if (!state.station) return openStationDrawer();
    if (audio.paused) playStation(state.station);
    else audio.pause();
  });
  $("previousStation").addEventListener("click", () => stepStation(-1));
  $("nextStation").addEventListener("click", () => stepStation(1));
  $("volumeSlider").addEventListener("input", syncVolume);
  $("muteButton").addEventListener("click", () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      const prev = Number($("volumeSlider").value);
      audio.volume = prev > 0.05 ? prev : 0.75;
      $("volumeSlider").value = audio.volume;
    } else {
      audio.muted = true;
    }
    updateVolumeUI();
  });

  // Fechar barra inferior de reprodução de rádio (Requisito usuário)
  $("closeRadioPlayer")?.addEventListener("click", () => {
    audio.pause();
    audio.src = "";
    state.station = null;
    renderPlayState("paused");
    $("radioPlayer")?.classList.add("hidden");
    document.body.classList.remove("has-active-player");
    updateGlobePoints();
    showToast("Player de rádio recolhido.");
  });

  // Favoritos
  $("favoriteStation").addEventListener("click", () => toggleFavorite("stations", state.station));
  $("favoritePlace").addEventListener("click", () => toggleFavorite("places", state.city));
  $("cameraFavorite").addEventListener("click", () => toggleFavorite("cameras", state.camera));

  // Temporizador de Desligamento Automático (Sleep Timer) com Múltiplas Opções
  $("sleepButton")?.addEventListener("click", (e) => {
    e.stopPropagation();
    $("sleepTimerPopover")?.classList.toggle("hidden");
  });

  $("closeSleepPopover")?.addEventListener("click", (e) => {
    e.stopPropagation();
    $("sleepTimerPopover")?.classList.add("hidden");
  });

  document.querySelectorAll(".sleep-opt").forEach((opt) => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      const mins = Number(opt.dataset.minutes);
      setSleepTimer(mins);
    });
  });

  // Fecha o menu de tempo ao clicar fora
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".sleep-wrapper")) {
      $("sleepTimerPopover")?.classList.add("hidden");
    }
  });

  // Compartilhamento
  $("shareButton").addEventListener("click", async () => {
    const title = state.station?.name || "Global Syncro";
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${title} · Global Syncro`, url });
      else {
        await navigator.clipboard.writeText(url);
        showToast("Link copiado para a área de transferência!");
      }
    } catch {
      showToast("Não foi possível compartilhar.");
    }
  });

  // Volta ao Mundo
  $("startTour")?.addEventListener("click", () => toggleTour(true));
  $("stopTour")?.addEventListener("click", () => toggleTour(false));
  $("nextTourCity")?.addEventListener("click", () => advanceTourCity());

  updateVolumeUI();
}

// ESTRELAS DINÂMICAS EM MOVIMENTO CÓSMICO (Requisito do usuário)
function initDynamicStarfield() {
  const canvas = $("dynamicStarfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
  let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

  const resizeHandler = () => {
    width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
    height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
  };
  window.addEventListener("resize", resizeHandler);

  // Gera 220 estrelas cósmicas com cintilação suave e profundidade de campo
  const stars = [];
  const starColors = ["#ffffff", "#e8e1ef", "#8ab4f8", "#ffd54f", "#e8aec8", "#b3e5fc"];
  for (let i = 0; i < 220; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random() * 0.8 + 0.2, // profundidade de campo
      radius: Math.random() * 1.4 + 0.4,
      alpha: Math.random() * 0.7 + 0.3,
      alphaSpeed: (Math.random() * 0.015 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
      color: starColors[Math.floor(Math.random() * starColors.length)]
    });
  }

  let lastLng = null;
  let lastLat = null;

  function renderFrame() {
    ctx.clearRect(0, 0, width, height);

    // Watchdog de 60 FPS e Auto-Rotação Contínua Garantida da Terra:
    // Se o usuário não está arrastando o globo há mais de 800ms e a rotação não está pausada, assegura que esteja ativa
    if (state.view === "globe" && !state.isDraggingGlobe && state.globe && !state.autoRotatePaused) {
      const controls = state.globe.controls?.();
      if (controls && !controls.autoRotate && performance.now() - state.lastUserInteractionTime > 800) {
        controls.autoRotate = true;
      }
    }

    // Atualiza a iluminação adaptativa conforme o zoom da câmera (clareia o mapa no zoom)
    updateZoomIllumination();

    // O céu se move estritamente na DIREÇÃO CONTRÁRIA ao movimento do globo (Requisito do usuário)
    let globeDeltaX = 0;
    let globeDeltaY = 0;
    if (state.globe) {
      const pov = state.globe.pointOfView();
      if (pov) {
        if (lastLng !== null) {
          let dl = pov.lng - lastLng;
          if (dl > 180) dl -= 360;
          if (dl < -180) dl += 360;
          // Invertido: o céu e as estrelas viajam no sentido oposto à rotação da Terra
          globeDeltaX = dl * 3.6;
        }
        if (lastLat !== null) {
          const dlat = pov.lat - lastLat;
          // Invertido: no sentido contrário à inclinação do globo
          globeDeltaY = -dlat * 2.4;
        }
        lastLng = pov.lng;
        lastLat = pov.lat;
      }
    }

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      // Deslocamento contínuo das estrelas atrelado estritamente à rotação do planeta Terra
      // Sem drift artificial: o céu acompanha fisicamente e em sentido oposto a rotação do planeta a 60 FPS
      s.x += globeDeltaX * s.z;
      s.y += globeDeltaY * s.z;

      if (s.x < 0) s.x += width;
      else if (s.x > width) s.x -= width;
      if (s.y < 0) s.y += height;
      else if (s.y > height) s.y -= height;

      // Cintilação suave
      s.alpha += s.alphaSpeed;
      if (s.alpha > 0.95 || s.alpha < 0.2) {
        s.alphaSpeed = -s.alphaSpeed;
      }

      // Renderização ultra-leve e fluida a 60 FPS (sem shadowBlur ou saves repetitivos)
      const currentAlpha = Math.max(0.12, Math.min(1, s.alpha));
      ctx.globalAlpha = currentAlpha;
      ctx.fillStyle = s.color;

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * s.z, 0, Math.PI * 2);
      ctx.fill();

      // Halo estelar cósmico suave para as estrelas mais brilhantes (custo zero de GPU)
      if (s.radius > 1.25) {
        ctx.globalAlpha = currentAlpha * 0.22;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * s.z * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    requestAnimationFrame(renderFrame);
  }

  requestAnimationFrame(renderFrame);
}

// INICIALIZAÇÃO ESCALONADA E ULTRA-RÁPIDA
async function start() {
  renderDestinations();
  renderDiscover();
  updateCityCopy();
  setupEvents();
  syncVolume();
  setPageClasses();

  setInterval(updateCityCopy, 30_000);
  initGlobe();
  initDynamicStarfield();

  // Sempre tenta iniciar na localização do usuário com fallback garantido para São Paulo
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let bestCity = cities[1]; // São Paulo como fallback padrão
        let minDist = Infinity;
        for (const c of cities) {
          const dist = Math.hypot(c.lat - latitude, c.lon - longitude);
          if (dist < minDist) {
            minDist = dist;
            bestCity = c;
          }
        }
        selectCity(bestCity);
      },
      () => {
        // Fallback: São Paulo, Brasil
        selectCity(cities[1]);
      },
      { timeout: 6000, maximumAge: 300000 }
    );
  }

  // Carga prioritária da cidade selecionada (imediata, leve e instantânea)
  loadStations(false);
  loadCameras();
  loadTvChannels();
  loadWeather();

  // Carregamento progressivo e escalonado dos catálogos mundiais pesados
  // Permite que a aplicação abra instantaneamente leve, sem travamentos na thread principal
  setTimeout(() => {
    loadRadioGardenPlaces();
  }, 120);

  setTimeout(() => {
    loadGlobalWebcamPoints();
  }, 380);

  setTimeout(() => {
    loadGlobalTvPoints();
  }, 700);

  setTimeout(() => {
    loadGlobalStations();
    initTvGarden();
    initTvView();
  }, 1100);

  request("/api/config")
    .then((config) => {
      state.cameraConfig = config;
      const key = (config.mapTilerKey || (typeof localStorage !== "undefined" ? localStorage.getItem("MAPTILER_API_KEY") : "") || DEFAULT_MAPTILER_KEY).trim();
      const style = (config.mapTilerStyle || "hybrid-v4").trim();
      state.mapTilerKey = key;
      state.mapTilerStyle = style;
      applyMapTilerGlobe(key, style);
      if (!config.windyConfigured) {
        $("cameraProvider").textContent = "TRANSMISSÕES AO VIVO";
      }
    })
    .catch(() => {
      applyMapTilerGlobe(DEFAULT_MAPTILER_KEY, "hybrid-v4");
    });

  setTimeout(() => {
    loadAirports();
  }, 1500);

  window.state = state;
  window.toggleAirports = toggleAirports;
  window.selectAirport = selectAirport;
  window.applyMapTilerGlobe = applyMapTilerGlobe;
  window.setMapTilerKey = (key, style = "hybrid-v4") => {
    if (key) {
      localStorage.setItem("MAPTILER_API_KEY", key);
      applyMapTilerGlobe(key, style);
      showToast("Chave MapTiler Hybrid-v4 aplicada!");
    }
  };

  // Exibe a tela de abertura se for a primeira vez
  const hasVisited = sessionStorage.getItem("radio-atlas-entered");
  if (!hasVisited) {
    $("welcome")?.classList.remove("hidden");
    sessionStorage.setItem("radio-atlas-entered", "true");
  }
}

start();
