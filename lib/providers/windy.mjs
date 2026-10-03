import { cache } from '../cache.mjs';
import { coordinate, deduplicate } from '../../shared/geo.js';

const include = 'categories,images,location,player,urls';

function getWebcamsKey() {
  return process.env.WINDY_API_KEY_WEBCAMS ||
         process.env.WINDY_API_KEY_Webcams ||
         process.env.WINDY_API_KEY ||
         '';
}

export function normalizeCamera(item) {
  const location = item.location || {};
  const player = item.player || {};
  const live = player.live;
  
  // Se houver live stream oficial, prioriza. Se não, usa timelapse do dia (day) ou lifetime da Windy.
  const liveUrl = typeof live === 'string' ? live : (live?.available ? live.embed : '');
  const dayUrl = player.day || player.lifetime || player.month || '';
  const embedUrl = liveUrl || dayUrl || '';
  
  const image = item.images?.current || item.images?.daylight || {};
  const thumbnail = image.preview || image.thumbnail || image.icon || '';
  
  const categoriesList = item.categories || [];
  const primaryCategory = categoriesList[0]?.name || 'Webcam';
  const categoryDesc = categoriesList.map(x => x.name).join(' · ');

  return {
    id: String(item.webcamId || item.id || ''),
    provider: 'Windy Webcams',
    providerId: 'windy',
    name: item.title || 'Webcam Windy',
    description: categoryDesc || 'Câmera meteorológica e paisagem',
    country: location.country || '',
    countryCode: location.country_code || '',
    state: location.region || '',
    city: location.city || '',
    latitude: coordinate(location.latitude, -90, 90),
    longitude: coordinate(location.longitude, -180, 180),
    category: primaryCategory,
    categories: categoriesList.map(x => x.id),
    thumbnail,
    streamType: embedUrl ? 'iframe' : (thumbnail ? 'image-refresh' : 'external'),
    streamUrl: '',
    embedUrl: embedUrl || '',
    sourceUrl: item.urls?.detail || '',
    attribution: 'Webcam por Windy.com',
    isLive: item.status === 'active' && Boolean(liveUrl),
    isTimelapse: Boolean(!liveUrl && dayUrl),
    status: item.status === 'inactive' ? 'UNAVAILABLE' : (liveUrl ? 'LIVE' : (dayUrl ? 'TIMELAPSE' : 'UNKNOWN')),
    lastCheckedAt: item.lastUpdatedOn || null,
    expiresAt: new Date(Date.now() + 240000).toISOString(),
    clusterSize: Number(item.clusterSize) || 1,
    failureCount: 0
  };
}

async function windy(path) {
  const key = getWebcamsKey();
  if (!key) throw new Error('Chave da API Windy Webcams não configurada.');
  
  const response = await fetch('https://api.windy.com/webcams/api/v3' + path, {
    headers: {
      'x-windy-api-key': key,
      'accept': 'application/json'
    },
    signal: AbortSignal.timeout(12000)
  });
  
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'A chave da Windy Webcams não autorizou esta consulta.'
        : response.status === 429
        ? 'A Windy atingiu o limite de consultas. Tente novamente em instantes.'
        : 'Windy temporariamente indisponível (' + response.status + ').'
    );
  }
  return response.json();
}

export const windyProvider = {
  id: 'windy',
  name: 'Windy Webcams',
  configured: () => Boolean(getWebcamsKey()),
  
  async search({ lat, lon, radius = 100, country, category, offset = 0 }) {
    const params = new URLSearchParams({ include, lang: 'pt', limit: '50', offset: String(offset) });
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      params.set('nearby', [lat, lon, Math.min(250, radius)].join(','));
    }
    if (country) params.set('countries', country);
    if (category) params.set('categories', category);
    
    const data = await cache.get('windy:list:' + params, 180000, () => windy('/webcams?' + params));
    return deduplicate((data.webcams || []).map(normalizeCamera), 'id');
  },
  
  async viewport(box) {
    const span = box.east >= box.west ? box.east - box.west : 360 - box.west + box.east;
    const z = Math.max(4, Math.min(18, Math.floor(box.zoom) - 2));
    if (span > 45 / 2 ** (z - 4) || box.north - box.south > 22.5 / 2 ** (z - 4)) {
      return this.search({ country: box.country });
    }
    const params = new URLSearchParams({
      include,
      lang: 'pt',
      northLat: String(box.north),
      southLat: String(box.south),
      eastLon: String(box.east),
      westLon: String(box.west),
      zoom: String(z)
    });
    const data = await cache.get('windy:viewport:' + params, 180000, () => windy('/map/clusters?' + params));
    return (Array.isArray(data) ? data : []).map(normalizeCamera);
  },
  
  async detail(id) {
    return cache.get('windy:detail:' + id, 120000, async () => {
      const result = await windy('/webcams/' + encodeURIComponent(id) + '?' + new URLSearchParams({ include, lang: 'pt' }));
      return normalizeCamera(result);
    });
  }
};
