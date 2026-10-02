import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distanceKm } from '../../shared/geo.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const PLACES_CACHE_PATH = resolve(ROOT, 'data/radio-garden-places.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://radio.garden/',
  'Origin': 'https://radio.garden'
};

let cachedPlaces = null;

/**
 * Retorna todos os 12.500+ lugares/cidades catalogados pelo Radio Garden.
 * Carrega a partir do cache local em disco (1.7MB) ou faz o download inicial se necessário.
 */
export async function getRadioGardenPlaces() {
  if (cachedPlaces && cachedPlaces.length > 0) return cachedPlaces;

  try {
    const raw = await readFile(PLACES_CACHE_PATH, 'utf8');
    const list = JSON.parse(raw);
    if (Array.isArray(list) && list.length > 0) {
      cachedPlaces = list.map(item => ({
        id: item.id,
        title: item.title,
        country: item.country,
        countryCode: item.countryCode || '',
        lat: item.geo[1],
        lon: item.geo[0],
        size: item.size || 1,
        url: item.url
      }));
      return cachedPlaces;
    }
  } catch {
    // Se o arquivo ainda não existir, baixa da API oficial do Radio Garden
  }

  try {
    const res = await fetch('https://radio.garden/api/ara/content/places', { headers: HEADERS });
    if (!res.ok) throw new Error(`Radio Garden places respondeu com status ${res.status}`);
    const json = await res.json();
    const rawList = json.data?.list || [];
    
    // Salva em disco para inicialização offline instantânea
    await writeFile(PLACES_CACHE_PATH, JSON.stringify(rawList)).catch(() => {});

    cachedPlaces = rawList.map(item => ({
      id: item.id,
      title: item.title,
      country: item.country,
      countryCode: item.countryCode || '',
      lat: item.geo[1],
      lon: item.geo[0],
      size: item.size || 1,
      url: item.url
    }));
    return cachedPlaces;
  } catch (error) {
    console.error('Falha ao obter places do Radio Garden:', error.message);
    return [];
  }
}

/**
 * Encontra o local mais próximo de uma coordenada (lat, lon) no Radio Garden.
 */
export async function findNearestPlace(lat, lon, maxDistanceKm = 120) {
  const places = await getRadioGardenPlaces();
  let nearest = null;
  let minDistance = Infinity;

  for (const place of places) {
    const dist = distanceKm(lat, lon, place.lat, place.lon);
    if (dist < minDistance && dist <= maxDistanceKm) {
      minDistance = dist;
      nearest = { ...place, distanceKm: Math.round(dist) };
    }
  }

  return nearest;
}

/**
 * Busca todas as estações de rádio de uma cidade/place específico no Radio Garden.
 * @param {string} placeId ID do lugar no Radio Garden (ex: 'IgQ9XxkV' para Viena, 'BMplqTGe' para SP)
 */
export async function getRadioGardenStations(placeId) {
  if (!placeId) throw new Error('ID do lugar não informado.');

  const url = `https://radio.garden/api/ara/content/page/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Não foi possível obter estações de ${placeId}: status ${res.status}`);
  
  const json = await res.json();
  const pageData = json.data || {};
  const content = pageData.content || [];

  const stations = [];
  for (const section of content) {
    if (section.itemsType === 'channel' && Array.isArray(section.items)) {
      for (const item of section.items) {
        const page = item.page;
        if (!page || !page.url) continue;

        // Extrai o ID do canal da URL: /listen/slug/channelId
        const match = page.url.match(/\/listen\/[^/]+\/([a-zA-Z0-9_-]+)/);
        const channelId = match ? match[1] : null;
        if (!channelId) continue;

        stations.push({
          id: channelId,
          name: page.title || 'Estação sem nome',
          country: pageData.subtitle || pageData.country || '',
          city: pageData.title || '',
          placeId: pageData.map || placeId,
          streamUrl: `/api/radiogarden/stream/${channelId}`,
          directListenUrl: `https://radio.garden/api/ara/content/listen/${channelId}/channel.mp3`,
          radioGardenUrl: `https://radio.garden${page.url}`,
          isOnline: true,
          provider: 'Radio Garden',
          utcOffset: pageData.utcOffset
        });
      }
    }
  }

  return {
    place: {
      id: placeId,
      title: pageData.title,
      country: pageData.subtitle,
      utcOffset: pageData.utcOffset,
      count: pageData.count || stations.length
    },
    stations
  };
}

/**
 * Resolve o redirecionamento HTTP 302 do stream da rádio para obter a URL direta de streaming.
 */
export async function resolveStreamUrl(channelId) {
  if (!channelId) throw new Error('Channel ID obrigatório');

  const url = `https://radio.garden/api/ara/content/listen/${encodeURIComponent(channelId)}/channel.mp3`;
  const res = await fetch(url, { headers: HEADERS, redirect: 'manual' });
  
  const location = res.headers.get('location');
  if (location) return location;

  if (res.ok) return url;
  throw new Error(`Falha ao resolver stream do Radio Garden para canal ${channelId}: status ${res.status}`);
}

/**
 * Busca por estações e cidades diretamente no catálogo do Radio Garden.
 */
export async function searchRadioGarden(query) {
  if (!query || query.trim().length < 2) return { places: [], channels: [] };

  const url = `https://radio.garden/api/search?q=${encodeURIComponent(query.trim())}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return { places: [], channels: [] };

  const json = await res.json();
  const hits = json.hits?.hits || [];

  const places = [];
  const channels = [];

  for (const hit of hits) {
    const src = hit._source;
    if (!src || !src.page) continue;

    if (src.type === 'place') {
      places.push({
        id: src.page.map || src.page.url?.split('/').pop(),
        title: src.page.title,
        country: src.page.subtitle,
        countryCode: src.code || '',
        count: src.page.count || 1,
        url: src.page.url
      });
    } else if (src.type === 'channel') {
      const match = (src.page.url || '').match(/\/listen\/[^/]+\/([a-zA-Z0-9_-]+)/);
      const channelId = match ? match[1] : null;
      if (channelId) {
        channels.push({
          id: channelId,
          name: src.page.title,
          city: src.page.place?.title || '',
          placeId: src.page.place?.id || '',
          countryCode: src.code || '',
          streamUrl: `/api/radiogarden/stream/${channelId}`,
          provider: 'Radio Garden'
        });
      }
    }
  }

  return { places, channels };
}
