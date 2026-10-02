import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { cache } from '../cache.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const LOCAL_WEBCAMS_PATH = resolve(ROOT, 'data/tvgarden-webcams.json');
const LOCAL_TV_PATH = resolve(ROOT, 'data/tvgarden-tv.json');
const LOCAL_COORDS_PATH = resolve(ROOT, 'data/tvgarden-country-coords.json');
const TV_GARDEN_ROOT = 'https://tvgarden.world/api/';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json'
};

let cachedCatalog = null;
let cachedTvCatalog = null;
let cachedCoords = null;

async function loadCoords() {
  if (cachedCoords) return cachedCoords;
  try {
    const raw = await readFile(LOCAL_COORDS_PATH, 'utf8');
    cachedCoords = JSON.parse(raw);
    return cachedCoords;
  } catch {
    return {};
  }
}

async function loadCatalog() {
  if (cachedCatalog) return cachedCatalog;
  try {
    const raw = await readFile(LOCAL_WEBCAMS_PATH, 'utf8');
    cachedCatalog = JSON.parse(raw);
    return cachedCatalog;
  } catch (err) {
    console.warn('Arquivo data/tvgarden-webcams.json não encontrado localmente:', err.message);
    return { countries: [], webcams: [] };
  }
}

async function loadTvCatalog() {
  if (cachedTvCatalog) return cachedTvCatalog;
  try {
    const raw = await readFile(LOCAL_TV_PATH, 'utf8');
    cachedTvCatalog = JSON.parse(raw);
    return cachedTvCatalog;
  } catch (err) {
    console.warn('Arquivo data/tvgarden-tv.json não encontrado localmente:', err.message);
    return { countries: [], channels: [] };
  }
}

function parseCompressedBuffer(buf) {
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const text = zlib.gunzipSync(buf).toString('utf8');
    return JSON.parse(text);
  }
  return JSON.parse(buf.toString('utf8'));
}

/**
 * Retorna os países com contagem de webcams e coordenadas geográficas no TV Garden
 */
export async function getTvGardenCountries() {
  const [cat, coords] = await Promise.all([loadCatalog(), loadCoords()]);
  if (cat.countries?.length) {
    return cat.countries.map(c => {
      const geo = coords[c.code] || {};
      return {
        ...c,
        lat: geo.lat ?? null,
        lon: geo.lon ?? null
      };
    });
  }

  // Fallback: busca via API oficial
  return cache.get('tvgarden:countries_metadata', 86400000, async () => {
    try {
      const res = await fetch(`${TV_GARDEN_ROOT}webcams/countries_metadata.json`, { headers: HEADERS });
      if (!res.ok) return [];
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = parseCompressedBuffer(buf);
      return Object.entries(meta)
        .filter(([_, d]) => d.channelCount > 0 || d.hasChannels)
        .map(([code, d]) => {
          const cCode = code.toUpperCase();
          const geo = coords[cCode] || {};
          return {
            code: cCode,
            country: d.country,
            capital: d.capital,
            timeZone: d.timeZone,
            count: d.channelCount || 0,
            lat: geo.lat ?? null,
            lon: geo.lon ?? null
          };
        })
        .sort((a, b) => b.count - a.count);
    } catch {
      return [];
    }
  });
}

/**
 * Retorna os países com contagem de canais de TV ao vivo e coordenadas geográficas no TV Garden
 */
export async function getTvGardenTvCountries() {
  const [tvCat, coords] = await Promise.all([loadTvCatalog(), loadCoords()]);
  if (tvCat.countries?.length) {
    return tvCat.countries.map(c => {
      const geo = coords[c.code] || {};
      return {
        ...c,
        lat: geo.lat ?? null,
        lon: geo.lon ?? null
      };
    });
  }

  // Fallback: busca via API oficial
  return cache.get('tvgarden:tv_countries_metadata', 86400000, async () => {
    try {
      const res = await fetch(`${TV_GARDEN_ROOT}tv/countries_metadata.json`, { headers: HEADERS });
      if (!res.ok) return [];
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = parseCompressedBuffer(buf);
      return Object.entries(meta)
        .filter(([_, d]) => d.channelCount > 0 || d.hasChannels)
        .map(([code, d]) => {
          const cCode = code.toUpperCase();
          const geo = coords[cCode] || {};
          return {
            code: cCode,
            country: d.country,
            capital: d.capital,
            timeZone: d.timeZone,
            count: d.channelCount || 0,
            lat: geo.lat ?? null,
            lon: geo.lon ?? null
          };
        })
        .sort((a, b) => b.count - a.count);
    } catch {
      return [];
    }
  });
}

/**
 * Retorna todas as webcams do TV Garden de um determinado país
 * @param {string} countryCode Código do país em 2 letras (ex: 'br', 'us', 'jp')
 */
export async function getTvGardenWebcams(countryCode) {
  if (!countryCode) return [];
  const code = countryCode.trim().toUpperCase();

  // 1. Tenta carregar do catálogo consolidado em disco
  const cat = await loadCatalog();
  if (cat.webcams?.length) {
    const match = cat.webcams.filter(w => w.countryCode === code);
    if (match.length > 0) return match;
  }

  // 2. Fallback: busca diretamente no endpoint do TV Garden
  return cache.get(`tvgarden:webcams:${code.toLowerCase()}`, 3600000, async () => {
    try {
      const url = `${TV_GARDEN_ROOT}webcams/countries/${code.toLowerCase()}.json`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) return [];

      const buf = Buffer.from(await res.arrayBuffer());
      const rawList = parseCompressedBuffer(buf);
      if (!Array.isArray(rawList)) return [];

      return rawList.map((item, idx) => {
        const youtubeEmbed = item.youtube_urls?.[0] || item.sources?.youtube?.[0] || '';
        const hlsStream = item.stream_urls?.[0] || item.sources?.streams?.[0] || '';

        return {
          id: item.nanoid || `tvg-${code.toLowerCase()}-${idx}`,
          name: item.name || 'Câmera ao vivo',
          country: code,
          countryCode: code,
          streamType: youtubeEmbed ? 'youtube' : 'hls',
          embedUrl: youtubeEmbed,
          streamUrl: hlsStream,
          sourceUrl: 'https://tvgarden.world/webcams',
          provider: 'TV Garden',
          isLive: true
        };
      }).filter(c => c.embedUrl || c.streamUrl);
    } catch {
      return [];
    }
  });
}

/**
 * Retorna catálogo global de webcams do TV Garden com paginação
 */
export async function getAllTvGardenWebcams(limit = 100, offset = 0) {
  const cat = await loadCatalog();
  const all = cat.webcams || [];
  return {
    total: all.length,
    offset,
    limit,
    webcams: all.slice(offset, offset + limit)
  };
}

/**
 * Busca textual rápida no catálogo de webcams do TV Garden
 */
export async function searchTvGardenWebcams(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cat = await loadCatalog();
  const all = cat.webcams || [];

  return all.filter(c => {
    const nameMatch = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q);
    const countryMatch = (c.country || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q);
    const codeMatch = (c.countryCode || '').toLowerCase() === q;
    return nameMatch || countryMatch || codeMatch;
  }).slice(0, 30);
}

/**
 * Busca canais de TV ao vivo de um país do TV Garden
 * @param {string} countryCode Código do país em 2 letras (ex: 'br', 'us', 'jp')
 */
export async function getTvGardenChannels(countryCode) {
  if (!countryCode) return [];
  const code = countryCode.trim().toUpperCase();

  // 1. Tenta carregar do catálogo consolidado de TV em disco
  const tvCat = await loadTvCatalog();
  if (tvCat.channels?.length) {
    const match = tvCat.channels.filter(ch => ch.countryCode === code);
    if (match.length > 0) return match;
  }

  // 2. Fallback: busca diretamente no endpoint do TV Garden
  return cache.get(`tvgarden:tv:${code.toLowerCase()}`, 3600000, async () => {
    try {
      const url = `${TV_GARDEN_ROOT}tv/countries/${code.toLowerCase()}.json`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) return [];

      const buf = Buffer.from(await res.arrayBuffer());
      const rawList = parseCompressedBuffer(buf);
      if (!Array.isArray(rawList)) return [];

      return rawList.map((item, idx) => {
        const yt = item.youtube_urls?.[0] || '';
        const st = item.stream_urls?.[0] || '';
        return {
          id: item.nanoid || `tv-${code.toLowerCase()}-${idx}`,
          name: item.name || 'Canal de TV',
          country: code,
          countryCode: code,
          streamType: yt ? 'youtube' : 'hls',
          streamUrl: st,
          embedUrl: yt,
          languages: item.languages || [],
          isGeoBlocked: Boolean(item.isGeoBlocked),
          sourceUrl: 'https://tvgarden.world/tv',
          provider: 'TV Garden TV',
          isLive: true
        };
      }).filter(ch => ch.streamUrl || ch.embedUrl);
    } catch {
      return [];
    }
  });
}

/**
 * Retorna catálogo global de canais de TV com paginação
 */
export async function getAllTvGardenChannels(limit = 100, offset = 0, countryCode = '') {
  const tvCat = await loadTvCatalog();
  let all = tvCat.channels || [];
  if (countryCode) {
    const code = countryCode.trim().toUpperCase();
    all = all.filter(c => c.countryCode === code);
  }
  return {
    total: all.length,
    offset,
    limit,
    channels: all.slice(offset, offset + limit)
  };
}

/**
 * Busca textual rápida no catálogo de canais de TV do TV Garden
 */
export async function searchTvGardenChannels(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tvCat = await loadTvCatalog();
  const all = tvCat.channels || [];

  return all.filter(c => {
    const nameMatch = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q);
    const countryMatch = (c.country || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q);
    const codeMatch = (c.countryCode || '').toLowerCase() === q;
    return nameMatch || countryMatch || codeMatch;
  }).slice(0, 30);
}

/**
 * Retorna todas as webcams com coordenadas geográficas reais para renderização direta no globo 3D
 */
export async function getTvGardenWebcamPoints() {
  const cat = await loadCatalog();
  return (cat.webcams || [])
    .filter(w => w.latitude != null && w.longitude != null)
    .map(w => ({
      id: w.id,
      name: w.name,
      city: w.city || '',
      country: w.country || '',
      countryCode: w.countryCode || '',
      lat: w.latitude,
      lon: w.longitude,
      streamType: w.streamType,
      embedUrl: w.embedUrl || '',
      streamUrl: w.streamUrl || '',
      provider: w.provider || 'TV Garden'
    }));
}

/**
 * Retorna todos os canais de TV com coordenadas geográficas reais para renderização direta no globo 3D
 */
export async function getTvGardenTvPoints() {
  const cat = await loadTvCatalog();
  return (cat.channels || [])
    .filter(c => c.latitude != null && c.longitude != null)
    .map(c => ({
      id: c.id,
      name: c.name,
      city: c.city || '',
      country: c.country || '',
      countryCode: c.countryCode || '',
      lat: c.latitude,
      lon: c.longitude,
      streamType: c.streamType,
      embedUrl: c.embedUrl || '',
      streamUrl: c.streamUrl || '',
      provider: 'TV Garden TV',
      isTv: true
    }));
}
