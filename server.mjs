import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cities } from './shared/cities.js';
import { coordinate, inBounds, clusterPoints, distanceKm } from './shared/geo.js';
import { nearbyStations, countryStations, globalStations, searchStations, radioBrowser, stationHealth } from './lib/providers/radio-browser.mjs';
import { cameras, cameraDetail, cameraSources } from './lib/providers/cameras.mjs';
import { windyForecastProvider } from './lib/providers/windy-forecast.mjs';
import { getRadioGardenPlaces, findNearestPlace, getRadioGardenStations, resolveStreamUrl, searchRadioGarden } from './lib/providers/radio-garden.mjs';
import { getTvGardenWebcams, getAllTvGardenWebcams, getTvGardenCountries, searchTvGardenWebcams, getTvGardenChannels, getTvGardenTvCountries, getAllTvGardenChannels, searchTvGardenChannels, getTvGardenWebcamPoints, getTvGardenTvPoints } from './lib/providers/tv-garden.mjs';

const ROOT = resolve(fileURLToPath(new URL('.',import.meta.url)));
try {
  for (const line of (await readFile(resolve(ROOT,'.env'),'utf8')).split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
    if (match) {
      const rawKey = match[1].trim();
      const val = match[2].trim().replace(/^['"]|['"]$/g,'');
      if (!(rawKey in process.env)) process.env[rawKey] = val;
      const normalizedKey = rawKey.toUpperCase().replace(/[\s-]+/g, '_');
      if (!(normalizedKey in process.env)) process.env[normalizedKey] = val;
    }
  }
} catch (error) { if (error.code !== 'ENOENT') console.warn('Não foi possível ler .env:',error.message); }

// Normalização das chaves Windy
if (!process.env.WINDY_API_KEY && (process.env.WINDY_API_KEY_WEBCAMS || process.env.WINDY_API_KEY_Webcams)) {
  process.env.WINDY_API_KEY = process.env.WINDY_API_KEY_WEBCAMS || process.env.WINDY_API_KEY_Webcams;
}

// Normalização da chave MapTiler
if (!process.env.MAPTILER_API_KEY && (process.env.MAPTILER_KEY || process.env.MapTiler_API_Key)) {
  process.env.MAPTILER_API_KEY = process.env.MAPTILER_KEY || process.env.MapTiler_API_Key;
}

const publicFiles = new Map(['index.html','styles.css','app.js','shared/cities.js','shared/geo.js','shared/stations-global.json','client/runtime.js','client/camera-player.js'].map(file=>['/'+file,file]));
for (const file of ['maplibre-gl.mjs','maplibre-gl-shared.mjs','maplibre-gl-worker.mjs','maplibre-gl.css']) publicFiles.set('/vendor/'+file,'node_modules/maplibre-gl/dist/'+file);
publicFiles.set('/vendor/globe.gl.min.js','node_modules/globe.gl/dist/globe.gl.min.js');
publicFiles.set('/vendor/hls.min.js','node_modules/hls.js/dist/hls.min.js');
publicFiles.set('/vendor/earth-day.jpg','vendor/earth-day.jpg');
publicFiles.set('/vendor/earth-night.jpg','vendor/earth-night.jpg');
publicFiles.set('/vendor/earth-topology.png','vendor/earth-topology.png');
publicFiles.set('/data/radio-garden-places.json','data/radio-garden-places.json');
publicFiles.set('/data/tvgarden-webcams.json','data/tvgarden-webcams.json');
publicFiles.set('/data/tvgarden-tv.json','data/tvgarden-tv.json');
publicFiles.set('/data/tvgarden-country-coords.json','data/tvgarden-country-coords.json');
publicFiles.set('/data/live-flights-seed.json','data/live-flights-seed.json');
publicFiles.set('/shared/airports.json','shared/airports.json');
let cachedAirports = null;
let cachedLiveFlights = { time: 0, states: [] };
let liveFlightFetchPromise = null;
let seedLiveFlightsData = null;

async function getSeedLiveFlights() {
  if (!seedLiveFlightsData) {
    try {
      const content = await readFile(resolve(ROOT, 'data/live-flights-seed.json'), 'utf8');
      seedLiveFlightsData = JSON.parse(content);
    } catch (err) {
      console.warn('Não foi possível ler data/live-flights-seed.json:', err.message);
    }
  }
  return seedLiveFlightsData;
}

function projectSeedFlights(seed) {
  if (!seed || !Array.isArray(seed.states) || seed.states.length === 0) return [];
  const baseTime = seed.time || Date.now();
  const elapsedSec = Math.max(0, (Date.now() - baseTime) / 1000) % 7200;

  return seed.states.map(s => {
    const lat0 = s[6];
    const lon0 = s[5];
    const spd = s[9] || 220;
    const track = s[10] || 0;

    const distM = spd * elapsedSec;
    const rad = track * (Math.PI / 180);

    const dLat = (distM * Math.cos(rad)) / 111320;
    let lat = lat0 + dLat;
    lat = Math.max(-85, Math.min(85, lat));

    const cosLat = Math.cos(lat * (Math.PI / 180)) || 1;
    const dLon = (distM * Math.sin(rad)) / (111320 * Math.abs(cosLat));
    let lon = lon0 + dLon;
    lon = ((lon + 180) % 360 + 360) % 360 - 180;

    const clone = [...s];
    clone[5] = Math.round(lon * 1000) / 1000;
    clone[6] = Math.round(lat * 1000) / 1000;
    return clone;
  });
}

async function fetchLiveFlights() {
  const now = Date.now();
  if (now - cachedLiveFlights.time < 12000 && cachedLiveFlights.states.length > 0) {
    return cachedLiveFlights.states;
  }
  if (liveFlightFetchPromise) return liveFlightFetchPromise;

  liveFlightFetchPromise = (async () => {
    try {
      const resp = await fetch('https://opensky-network.org/api/states/all', {
        headers: { 'User-Agent': 'Orbita-GlobalSyncro/1.0' },
        signal: AbortSignal.timeout(5000)
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.states)) {
          const valid = data.states.filter(s => s[5] != null && s[6] != null && !s[8]);
          if (valid.length > 0) {
            cachedLiveFlights = { time: Date.now(), states: valid };
            return valid;
          }
        }
      }
    } catch {
      // Falha externa ou timeout tratada via fallback abaixo
    } finally {
      liveFlightFetchPromise = null;
    }

    // Se temos cache anterior com voos, mantém
    if (cachedLiveFlights.states.length > 0) {
      return cachedLiveFlights.states;
    }

    // Fallback garantido: carrega o snapshot de voos reais com Dead Reckoning temporal
    const seed = await getSeedLiveFlights();
    if (seed && Array.isArray(seed.states)) {
      const projected = projectSeedFlights(seed);
      cachedLiveFlights = { time: Date.now(), states: projected };
      return projected;
    }

    return [];
  })();

  return liveFlightFetchPromise;
}

const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const requests = new Map();
function json(res,status,body,headers={}) {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}); res.end(JSON.stringify(body));
}
function number(params,key,fallback,min,max) {
  const raw=params.get(key); if (raw===null||raw==='') return fallback;
  const value=Number(raw); if (!Number.isFinite(value)||value<min||value>max) throw Object.assign(new Error('Parâmetro inválido: '+key),{status:400});
  return value;
}
function country(params) {
  const value=(params.get('country')||'').toUpperCase();
  if (value&&!/^[A-Z]{2}$/.test(value)) throw Object.assign(new Error('Informe um código de país válido.'),{status:400});
  return value;
}
function rateAllowed(req) {
  const ip = (req.headers && req.headers['x-forwarded-for'])
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : (req.socket && req.socket.remoteAddress) || 'local';
  const now = Date.now();
  for (const [key,value] of requests) if (now-value.start>60000) requests.delete(key);
  const bucket=requests.get(ip)||{start:now,count:0}; bucket.count++; requests.set(ip,bucket);
  return bucket.count<=180;
}

let cachedTvGardenWebcamsList = null;
async function getCachedTvGardenWebcams() {
  if (!cachedTvGardenWebcamsList) {
    try {
      const data = JSON.parse(await readFile(resolve(ROOT, 'data/tvgarden-webcams.json'), 'utf8'));
      cachedTvGardenWebcamsList = data.webcams || [];
    } catch {
      cachedTvGardenWebcamsList = [];
    }
  }
  return cachedTvGardenWebcamsList;
}

function decodeWeatherCode(code) {
  if (code == null) return 'Tempo local';
  const map = {
    0: 'Céu limpo', 1: 'Predominantemente limpo', 2: 'Parcialmente nublado', 3: 'Nublado',
    45: 'Nevoeiro', 48: 'Nevoeiro denso',
    51: 'Garoa leve', 53: 'Garoa moderada', 55: 'Garoa densa',
    61: 'Chuva fraca', 63: 'Chuva moderada', 65: 'Chuva forte',
    71: 'Neve fraca', 73: 'Neve moderada', 75: 'Neve intensa',
    80: 'Pancadas de chuva leves', 81: 'Pancadas de chuva', 82: 'Chuva torrencial',
    95: 'Trovoada', 96: 'Trovoada com granizo', 99: 'Trovoada severa com granizo'
  };
  return map[code] || 'Tempo local';
}

const airportKeywords = /(aeroporto|aer[oó]dromo|pista|avia[cç][aã]o|base a[eé]rea|terminal|aeron[aá]utic|voo|iata|icao|airport)/i;

function buildAirportPtDescription(apt) {
  const porteMap = {
    large: 'de grande porte (internacional)',
    medium: 'de médio porte',
    small: 'regional / de pequeno porte',
    heliport: 'heliponto',
    seaplane: 'hidrobase aquática',
    closed: 'desativado'
  };
  const porte = porteMap[(apt.type || '').toLowerCase()] || 'comercial e regional';
  const elevM = apt.elev != null ? Math.round(apt.elev * 0.3048) : null;
  const elevTxt = elevM != null ? ` a ${elevM} metros (${apt.elev} pés) de altitude` : '';
  const loc = [apt.city, apt.country].filter(Boolean).join(', ');
  const codes = [];
  if (apt.iata) codes.push(`IATA: ${apt.iata}`);
  if (apt.id && apt.id.length === 4 && !/^\d/.test(apt.id)) codes.push(`ICAO: ${apt.id}`);
  const codeTxt = codes.length > 0 ? ` (${codes.join(', ')})` : '';
  return `O ${apt.name}${codeTxt} é um aeródromo ${porte} localizado em ${loc || 'sua região geográfica'}${elevTxt}. Possui coordenadas geográficas em ${apt.lat.toFixed(3)}° e ${apt.lon.toFixed(3)}°, atendendo operações de navegação aérea, transporte de passageiros e aviação geral.`;
}

async function fetchWikiAirport(apt) {
  if (!apt) return null;
  const cleanName = (apt.name || '')
    .replace(/international\s*airport/i, '')
    .replace(/airport/i, '')
    .replace(/aeroporto\s*internacional/i, '')
    .replace(/aeroporto/i, '')
    .trim();

  const queries = [
    apt.city ? `Aeroporto de ${apt.city}` : null,
    cleanName ? `Aeroporto ${cleanName}` : null,
    apt.iata ? `Aeroporto ${apt.iata}` : null,
    apt.name
  ].filter(Boolean);

  let wikiHit = null;

  for (const q of queries) {
    try {
      const sUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&utf8=&format=json`;
      const sRes = await fetch(sUrl, {
        headers: { 'User-Agent': 'GlobalSyncro/1.0 (contact@globalsyncro.app)' },
        signal: AbortSignal.timeout(3500)
      });
      if (!sRes.ok) continue;
      const sJson = await sRes.json();
      const hits = sJson.query?.search || [];
      const match = hits.find((h) => {
        const text = (h.title + ' ' + h.snippet).toLowerCase();
        const mentionsTarget = (apt.city && text.includes(apt.city.toLowerCase())) ||
                               (cleanName && text.includes(cleanName.toLowerCase())) ||
                               (apt.iata && text.includes(apt.iata.toLowerCase()));
        const isDisambig = text.includes('pode referir-se a') || text.includes('desambiguação');
        if (isDisambig) return false;

        // Se o aeroporto for brasileiro, não deve aceitar artigo de nação estrangeira homônima (ex: Podgoritza / país Montenegro)
        if (apt.country === 'BR') {
          const isForeignCountry = text.includes('capital de montenegro') || text.includes('podgorica') || text.includes('podgoritza') || text.includes('bálcãs') || text.includes('república de montenegro');
          if (isForeignCountry) return false;
        }

        return airportKeywords.test(text) && mentionsTarget;
      });

      if (match) {
        const sumUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(match.title)}`;
        const sumRes = await fetch(sumUrl, {
          headers: { 'User-Agent': 'GlobalSyncro/1.0 (contact@globalsyncro.app)' },
          signal: AbortSignal.timeout(3500)
        });
        if (sumRes.ok) {
          const sum = await sumRes.json();
          const sumText = (sum.title + ' ' + (sum.extract || '')).toLowerCase();
          const mentionsTarget = (apt.city && sumText.includes(apt.city.toLowerCase())) ||
                                 (cleanName && sumText.includes(cleanName.toLowerCase())) ||
                                 (apt.iata && sumText.includes(apt.iata.toLowerCase()));

          if (apt.country === 'BR') {
            const isForeignCountry = sumText.includes('capital de montenegro') || sumText.includes('podgorica') || sumText.includes('podgoritza') || sumText.includes('bálcãs') || sumText.includes('república de montenegro');
            if (isForeignCountry) continue;
          }

          if (sum.extract && airportKeywords.test(sum.extract) && mentionsTarget && sum.type !== 'disambiguation') {
            const photo = sum.originalimage?.source || sum.thumbnail?.source || null;
            wikiHit = {
              title: sum.title,
              description: sum.description || '',
              extract: sum.extract,
              photo: photo && !photo.endsWith('.svg') ? photo : null,
              url: sum.content_urls?.desktop?.page || null
            };
            break;
          }
        }
      }
    } catch {}
  }

  // Se não achou foto na pt.wikipedia, tenta buscar apenas FOTO na en.wikipedia para aeroportos internacionais
  let photo = wikiHit?.photo || null;
  if (!photo && (cleanName || apt.iata)) {
    try {
      const eq = cleanName ? `${cleanName} airport` : `${apt.iata} international airport`;
      const eUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(eq)}&utf8=&format=json`;
      const eRes = await fetch(eUrl, {
        headers: { 'User-Agent': 'GlobalSyncro/1.0 (contact@globalsyncro.app)' },
        signal: AbortSignal.timeout(3000)
      });
      if (eRes.ok) {
        const eData = await eRes.json();
        const eHits = eData.query?.search || [];
        const eMatch = eHits.find(h => {
          const t = (h.title + ' ' + h.snippet).toLowerCase();
          return airportKeywords.test(t) && (t.includes(cleanName.toLowerCase()) || (apt.city && t.includes(apt.city.toLowerCase())));
        });
        if (eMatch) {
          const eSumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(eMatch.title)}`;
          const eSumRes = await fetch(eSumUrl, {
            headers: { 'User-Agent': 'GlobalSyncro/1.0 (contact@globalsyncro.app)' },
            signal: AbortSignal.timeout(3000)
          });
          if (eSumRes.ok) {
            const eSum = await eSumRes.json();
            const ePhoto = eSum.originalimage?.source || eSum.thumbnail?.source || null;
            if (ePhoto && !ePhoto.endsWith('.svg')) photo = ePhoto;
          }
        }
      }
    } catch {}
  }

  return {
    title: wikiHit?.title || apt.name,
    description: wikiHit?.description || '',
    extract: wikiHit?.extract || buildAirportPtDescription(apt),
    photo: photo || null,
    url: wikiHit?.url || null
  };
}

async function findAirportWebcams(lat, lon, iata, name, maxKm = 65) {
  try {
    const allWebcams = await getCachedTvGardenWebcams();
    const matches = [];
    const airportRegex = /(?:airport|aeroporto|airfield|runway|airstrip|aviation|aerodrom)/i;
    const iataRegex = iata && iata.length >= 3 ? new RegExp(`\\b${iata}\\b`, 'i') : null;

    const nameWords = (name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/[\s\/\-_,]+/)
      .filter(w => w.length >= 4 && !['aeroporto', 'airport', 'internacional', 'international', 'nacional', 'national'].includes(w));

    for (const c of allWebcams) {
      const cLat = c.latitude != null ? c.latitude : c.lat;
      const cLon = c.longitude != null ? c.longitude : c.lon;
      if (cLat == null || cLon == null) continue;
      const dist = distanceKm(lat, lon, cLat, cLon);
      if (dist <= maxKm) {
        const title = c.name || c.title || '';
        const normTitle = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const hasExactNameMatch = (iataRegex && iataRegex.test(title)) || (nameWords.length > 0 && nameWords.some(w => normTitle.includes(w)));
        const isGenericAirportCam = airportRegex.test(title);

        let priority = 0;
        if (hasExactNameMatch) {
          priority = 3; // Correspondência exata do aeroporto
        } else if (isGenericAirportCam && dist <= 30) {
          priority = 2; // Câmera de aeródromo muito próxima
        } else if (isGenericAirportCam) {
          priority = 1;
        }

        matches.push({
          id: c.id,
          name: title,
          city: c.city || '',
          country: c.country || '',
          countryCode: c.countryCode || '',
          streamType: c.streamType || 'youtube',
          embedUrl: c.embedUrl || '',
          streamUrl: c.streamUrl || '',
          distanceKm: Math.round(dist * 10) / 10,
          isDirectAirportCam: Boolean(hasExactNameMatch || (isGenericAirportCam && dist <= 25)),
          priority
        });
      }
    }

    matches.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.distanceKm - b.distanceKm;
    });

    return matches.slice(0, 4);
  } catch {
    return [];
  }
}

async function fetchAirportWeather(lat, lon) {
  try {
    const windy = await windyForecastProvider.getWeather(lat, lon);
    if (windy && windy.current) {
      const windKmh = windy.current.windSpeed || 0;
      const windKnots = Math.round(windKmh / 1.852);
      return {
        provider: 'Windy',
        temp: windy.current.temp,
        condition: windy.current.condition || 'Tempo local',
        windKmh: Math.round(windKmh),
        windKnots,
        windDirection: windy.current.windDirection || 0,
        humidity: windy.current.humidity,
        pressure: windy.current.pressure || 1013
      };
    }
  } catch {}

  try {
    const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code`;
    const res = await fetch(omUrl, { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      const cur = data.current || {};
      const windKmh = cur.wind_speed_10m || 0;
      const windKnots = Math.round(windKmh / 1.852);
      return {
        provider: 'Open-Meteo',
        temp: cur.temperature_2m != null ? Math.round(cur.temperature_2m) : null,
        condition: decodeWeatherCode(cur.weather_code),
        windKmh: Math.round(windKmh),
        windKnots,
        windDirection: cur.wind_direction_10m || 0,
        humidity: cur.relative_humidity_2m,
        pressure: cur.surface_pressure ? Math.round(cur.surface_pressure) : 1013
      };
    }
  } catch {}
  return null;
}
const textMatch=(a,b)=>String(a||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(String(b||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
export async function api(req,res,url) {
  if (!rateAllowed(req)) return json(res,429,{error:'Muitas consultas. Aguarde um instante.'},{'retry-after':'60'});
  const params=url.searchParams,path=url.pathname;
  if (path==='/api/health') return json(res,200,{app:'Global Syncro',status:'ok',version:'1.2.0'});
  if (path==='/api/config') {
    const webcamsKey = process.env.WINDY_API_KEY_WEBCAMS || process.env.WINDY_API_KEY_Webcams || process.env.WINDY_API_KEY || '';
    const mapKey = process.env.WINDY_API_KEY_MAP_FORECAST || process.env.WINDY_API_KEY_MAP || process.env.WINDY_API_KEY_Map_Forecast || process.env['WINDY_API_KEY_Map Forecast'] || '';
    const pointKey = process.env.WINDY_API_KEY_POINT_FORECAST || process.env.WINDY_API_KEY_POINT || process.env.WINDY_API_KEY_Point_Forecast || process.env['WINDY_API_KEY_Point Forecast'] || '';
    const defaultMapTilerKey = 'fVnSiLiMILfAw3T6c5YJ';
    const mapTilerKey = (process.env.MAPTILER_API_KEY || process.env.MAPTILER_KEY || process.env.MapTiler_API_Key || defaultMapTilerKey).trim();
    const mapTilerStyle = (process.env.MAPTILER_STYLE || 'hybrid-v4').trim();
    return json(res,200,{
      windyConfigured: Boolean(webcamsKey),
      windyWebcamsConfigured: Boolean(webcamsKey),
      windyPointConfigured: Boolean(pointKey),
      windyMapConfigured: Boolean(mapKey),
      windyMapKey: mapKey,
      mapTilerKey,
      mapTilerConfigured: Boolean(mapTilerKey),
      mapTilerStyle,
      cameraSources,
      radioProvider:'Radio Browser',
      cameraProvider:'Windy Webcams'
    });
  }
  if (path==='/api/weather') {
    const lat = coordinate(params.get('lat'), -90, 90);
    const lon = coordinate(params.get('lon'), -180, 180);
    if (lat === null || lon === null) return json(res, 400, { error: 'Coordenadas inválidas para previsão do tempo.' });
    try {
      const weather = await windyForecastProvider.getWeather(lat, lon);
      return json(res, 200, weather);
    } catch (err) {
      return json(res, 500, { error: 'Falha ao obter previsão: ' + err.message });
    }
  }
  if (path==='/api/stations/global') {
    try {
      const stations = await globalStations(Math.floor(number(params,'limit',1000,50,2000)));
      if (stations && stations.length > 0) return json(res,200,{stations});
    } catch (err) {
      console.warn('Radio Browser offline, carregando snapshot local:', err.message);
    }
    try {
      const snap = JSON.parse(await readFile(resolve(ROOT,'shared/stations-global.json'),'utf8'));
      return json(res,200,snap);
    } catch {
      return json(res,200,{stations:[]});
    }
  }
  if (path==='/api/stations') {
    const code=country(params); if (!code) return json(res,400,{error:'Informe o país da cidade.'});
    const lat=coordinate(params.get('lat'),-90,90),lon=coordinate(params.get('lon'),-180,180);
    return json(res,200,await nearbyStations({country:code,lat,lon,radius:number(params,'radius',100,1,500),offset:Math.floor(number(params,'offset',0,0,10000)),limit:Math.floor(number(params,'limit',30,1,100))}));
  }
  if (path==='/api/search') {
    const query=(params.get('q')||'').trim().slice(0,90);
    if (query.length<2) return json(res,200,{stations:[],cameras:[],cities:[]});
    const cityResults=cities.filter(city=>[city.name,city.english,city.country,city.countryCode].some(value=>textMatch(value,query)));
    const place=cityResults[0]||cities.find(city=>city.id===params.get('city'));
    const category={praia:'beach',praias:'beach',beach:'beach',aeroporto:'airport',airport:'airport',natureza:'landscape'}[query.toLowerCase()];
    const results=await Promise.allSettled([
      searchStations(query),
      place?cameras('search',{lat:place.lat,lon:place.lon,country:place.countryCode,category}):Promise.resolve({cameras:[]}),
      searchRadioGarden(query),
      place?.countryCode ? getTvGardenWebcams(place.countryCode) : Promise.resolve([]),
      searchTvGardenChannels(query)
    ]);
    const rbStations = results[0].status==='fulfilled'?results[0].value:[];
    const camResults = results[1].status==='fulfilled'?results[1].value.cameras.filter(cam=>cityResults.length||category||textMatch(cam.name,query)||textMatch(cam.city,query)).slice(0,12):[];
    const rgResults = results[2].status==='fulfilled'?results[2].value:{places:[],channels:[]};
    const tvgCams = results[3].status==='fulfilled'?results[3].value:[];
    const tvChannels = results[4].status==='fulfilled'?results[4].value:[];

    // Combina rádios do Radio Garden com Radio Browser
    const allStations = [...rgResults.channels, ...rbStations];
    // Combina webcams do TV Garden com Câmeras do Mundo / Windy
    const allCameras = [...camResults, ...tvgCams.slice(0, 8)];

    return json(res,200,{
      cities: cityResults,
      radioGardenPlaces: rgResults.places,
      stations: allStations,
      cameras: allCameras,
      tvChannels: tvChannels.slice(0, 16),
      errors: results.flatMap(result=>result.status==='rejected'?[result.reason.message]:[])
    });
  }
  if (path==='/api/radiogarden/places') {
    const places = await getRadioGardenPlaces();
    return json(res, 200, { places, count: places.length });
  }
  if (path==='/api/radiogarden/nearest') {
    const lat = coordinate(params.get('lat'), -90, 90);
    const lon = coordinate(params.get('lon'), -180, 180);
    if (lat === null || lon === null) return json(res, 400, { error: 'Coordenadas inválidas.' });
    const maxDist = number(params, 'maxDistanceKm', 300, 10, 5000);
    const nearest = await findNearestPlace(lat, lon, maxDist);
    return json(res, 200, { place: nearest });
  }
  if (path==='/api/radiogarden/place') {
    const placeId = params.get('id') || params.get('placeId') || '';
    if (!placeId) return json(res, 400, { error: 'Informe o ID do lugar.' });
    try {
      const data = await getRadioGardenStations(placeId);
      return json(res, 200, data);
    } catch (err) {
      return json(res, 500, { error: 'Falha ao buscar estações no Radio Garden: ' + err.message });
    }
  }
  if (path.startsWith('/api/radiogarden/stream/')) {
    const channelId = path.split('/').pop();
    if (!channelId) return json(res, 400, { error: 'Channel ID inválido.' });
    try {
      const streamUrl = await resolveStreamUrl(channelId);
      if (params.get('proxy') === '1') {
        const audioRes = await fetch(streamUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const headers = {
          'Content-Type': audioRes.headers.get('content-type') || 'audio/mpeg',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        };
        res.writeHead(audioRes.status || 200, headers);
        const { Readable } = await import('node:stream');
        Readable.fromWeb(audioRes.body).pipe(res);
        return;
      }
      res.writeHead(302, {
        'Location': streamUrl,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      return res.end();
    } catch (err) {
      return json(res, 502, { error: 'Falha ao resolver stream do canal: ' + err.message });
    }
  }
  if (path==='/api/radiogarden/search') {
    const q = (params.get('q') || '').trim();
    return json(res, 200, await searchRadioGarden(q));
  }
  if (path==='/api/tvgarden/countries') {
    try {
      const countries = await getTvGardenCountries();
      return json(res, 200, { countries, count: countries.length });
    } catch (err) {
      return json(res, 500, { error: 'Falha ao obter países do TV Garden: ' + err.message });
    }
  }
  if (path==='/api/tvgarden/webcams') {
    const code = country(params);
    if (code) {
      try {
        const webcams = await getTvGardenWebcams(code);
        return json(res, 200, { webcams, country: code, count: webcams.length });
      } catch (err) {
        return json(res, 500, { error: 'Falha ao obter webcams do TV Garden: ' + err.message });
      }
    }
    const limit = Math.floor(number(params, 'limit', 60, 1, 1000));
    const offset = Math.floor(number(params, 'offset', 0, 0, 10000));
    try {
      const data = await getAllTvGardenWebcams(limit, offset);
      return json(res, 200, data);
    } catch (err) {
      return json(res, 500, { error: 'Falha ao listar webcams do TV Garden: ' + err.message });
    }
  }
  if (path==='/api/tvgarden/webcams/points') {
    try {
      const points = await getTvGardenWebcamPoints();
      return json(res, 200, { points, count: points.length });
    } catch (err) {
      return json(res, 500, { error: 'Falha ao obter pontos de webcams: ' + err.message });
    }
  }
  if (path==='/api/tvgarden/tv/points') {
    try {
      const points = await getTvGardenTvPoints();
      return json(res, 200, { points, count: points.length });
    } catch (err) {
      return json(res, 500, { error: 'Falha ao obter pontos de TV: ' + err.message });
    }
  }
  if (path==='/api/tvgarden/search') {
    const q = (params.get('q') || '').trim();
    try {
      const webcams = await searchTvGardenWebcams(q);
      return json(res, 200, { webcams, count: webcams.length });
    } catch (err) {
      return json(res, 500, { error: 'Falha na busca de webcams: ' + err.message });
    }
  }
  if (path==='/api/tvgarden/tv/countries') {
    try {
      const countries = await getTvGardenTvCountries();
      return json(res, 200, { countries, count: countries.length });
    } catch (err) {
      return json(res, 500, { error: 'Falha ao obter países de TV: ' + err.message });
    }
  }
  if (path==='/api/tvgarden/tv/channels' || path==='/api/tvgarden/channels') {
    const code = country(params);
    if (code) {
      try {
        const channels = await getTvGardenChannels(code);
        return json(res, 200, { channels, country: code, count: channels.length });
      } catch (err) {
        return json(res, 500, { error: 'Falha ao obter canais de TV: ' + err.message });
      }
    }
    const limit = Math.floor(number(params, 'limit', 60, 1, 1000));
    const offset = Math.floor(number(params, 'offset', 0, 0, 10000));
    try {
      const data = await getAllTvGardenChannels(limit, offset);
      return json(res, 200, data);
    } catch (err) {
      return json(res, 500, { error: 'Falha ao listar canais de TV: ' + err.message });
    }
  }
  if (path==='/api/tvgarden/tv/search') {
    const q = (params.get('q') || '').trim();
    try {
      const channels = await searchTvGardenChannels(q);
      return json(res, 200, { channels, count: channels.length });
    } catch (err) {
      return json(res, 500, { error: 'Falha na busca de canais de TV: ' + err.message });
    }
  }
  if (path==='/api/stations/click'||path==='/api/stations/health') {
    const id=params.get('id')||''; if (!/^[a-f0-9-]{36}$/i.test(id)) return json(res,400,{error:'Estação inválida.'});
    if (path.endsWith('health')) return json(res,200,await stationHealth(id));
    await radioBrowser('/json/url/'+encodeURIComponent(id)); return json(res,200,{ok:true});
  }
  if (path==='/api/airports') {
    try {
      if (!cachedAirports) {
        cachedAirports = JSON.parse(await readFile(resolve(ROOT, 'shared/airports.json'), 'utf8'));
      }
      const q = (params.get('q') || '').trim().toLowerCase();
      if (q) {
        const filtered = cachedAirports.filter(a =>
          (a.iata && a.iata.toLowerCase().includes(q)) ||
          (a.name && a.name.toLowerCase().includes(q)) ||
          (a.city && a.city.toLowerCase().includes(q)) ||
          (a.country && a.country.toLowerCase().includes(q))
        );
        return json(res, 200, { airports: filtered.slice(0, 100), count: filtered.length });
      }
      return json(res, 200, { airports: cachedAirports, count: cachedAirports.length });
    } catch (err) {
      return json(res, 500, { error: 'Falha ao carregar aeroportos: ' + err.message });
    }
  }
  if (path === '/api/airport/detail') {
    const id = (params.get('id') || '').trim();
    const iata = (params.get('iata') || '').trim().toUpperCase();
    const name = (params.get('name') || '').trim();
    const lat = coordinate(params.get('lat'), -90, 90);
    const lon = coordinate(params.get('lon'), -180, 180);

    if (lat === null || lon === null) return json(res, 400, { error: 'Coordenadas inválidas para o aeroporto.' });

    if (!cachedAirports) {
      try {
        cachedAirports = JSON.parse(await readFile(resolve(ROOT, 'shared/airports.json'), 'utf8'));
      } catch {
        cachedAirports = [];
      }
    }

    const found = cachedAirports.find(a => (id && a.id === id) || (iata && a.iata === iata)) || {};
    const apt = {
      id: id || found.id || iata,
      name: name || found.name || 'Aeroporto',
      iata: iata || found.iata || '',
      type: found.type || params.get('type') || 'small',
      typeLabel: found.typeLabel || params.get('typeLabel') || 'Aeroporto',
      lat,
      lon,
      city: found.city || params.get('city') || '',
      country: found.country || params.get('country') || '',
      elev: found.elev != null ? found.elev : (number(params, 'elev', null, -500, 30000))
    };

    const elevM = apt.elev != null ? Math.round(apt.elev * 0.3048) : null;

    try {
      const [wiki, webcams, weather] = await Promise.all([
        fetchWikiAirport(apt),
        findAirportWebcams(lat, lon, apt.iata, apt.name, 65),
        fetchAirportWeather(lat, lon)
      ]);

      return json(res, 200, {
        airport: {
          ...apt,
          elevM,
          airnavUrl: `https://pt.airnavradar.com/airport/${apt.id || apt.iata || ''}`,
          airnavRadarUrl: `https://pt.airnavradar.com/@${lat},${lon},z11`,
          flightradarUrl: `https://www.flightradar24.com/airport/${(apt.iata || apt.id || '').toLowerCase()}`,
          flightawareUrl: `https://flightaware.com/live/airport/${apt.id || apt.iata}`,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
        },
        wiki,
        webcams,
        weather
      });
    } catch (err) {
      return json(res, 500, { error: 'Falha ao obter detalhes do aeroporto: ' + err.message });
    }
  }
  if (path==='/api/flights/live') {
    try {
      const states = await fetchLiveFlights();
      const limit = Math.min(Math.max(Number(params.get('limit')) || 650, 50), 2500);

      const north = params.get('north') ? Number(params.get('north')) : null;
      const south = params.get('south') ? Number(params.get('south')) : null;
      const east = params.get('east') ? Number(params.get('east')) : null;
      const west = params.get('west') ? Number(params.get('west')) : null;

      let filtered = states;
      if (north != null && south != null && east != null && west != null) {
        filtered = states.filter(s => {
          const lat = s[6], lon = s[5];
          const latOk = lat >= south && lat <= north;
          const lonOk = west <= east ? (lon >= west && lon <= east) : (lon >= west || lon <= east);
          return latOk && lonOk;
        });
      }

      let resultStates = filtered;
      if (resultStates.length > limit) {
        const step = resultStates.length / limit;
        resultStates = Array.from({ length: limit }, (_, i) => resultStates[Math.floor(i * step)]);
      }

      const flights = resultStates.map(s => ({
        icao: s[0],
        callsign: (s[1] || '').trim(),
        country: s[2] || '',
        lng: Math.round(s[5] * 1000) / 1000,
        lat: Math.round(s[6] * 1000) / 1000,
        alt: Math.round(s[7] || 0),
        altFt: Math.round((s[7] || 0) * 3.28084),
        speed: Math.round((s[9] || 0) * 3.6),
        speedKnots: Math.round((s[9] || 0) * 1.94384),
        track: Math.round(s[10] || 0),
        type: 'flight'
      }));

      return json(res, 200, {
        time: cachedLiveFlights.time || Date.now(),
        count: flights.length,
        totalInAir: states.length,
        flights
      }, {
        'cache-control': 'public, max-age=10, s-maxage=12, stale-while-revalidate=30'
      });
    } catch (err) {
      return json(res, 500, { error: 'Falha ao buscar voos em tempo real: ' + err.message });
    }
  }
  if (path==='/api/cities') return json(res,200,{cities});
  if (path==='/api/camera') {
    const id=params.get('id')||'',provider=params.get('provider')||'auto';
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return json(res,400,{error:'Câmera inválida.'});
    return json(res,200,{camera:await cameraDetail(provider,id)});
  }
  if (path==='/api/cameras') {
    const lat=coordinate(params.get('lat'),-90,90),lon=coordinate(params.get('lon'),-180,180),code=country(params);
    if ((lat===null||lon===null)&&!code) return json(res,400,{error:'Informe coordenadas válidas ou um país.'});
    const category=(params.get('category')||'').replace(/[^a-z-]/g,'').slice(0,30);
    return json(res,200,await cameras('search',{lat,lon,country:code,category,radius:number(params,'radius',100,1,250),offset:Math.floor(number(params,'offset',0,0,10000))}));
  }
  if (path==='/api/viewport'||path==='/api/camera-clusters') {
    const box={north:number(params,'north',number(params,'northLat',NaN,-90,90),-90,90),south:number(params,'south',number(params,'southLat',NaN,-90,90),-90,90),east:number(params,'east',number(params,'eastLon',NaN,-180,180),-180,180),west:number(params,'west',number(params,'westLon',NaN,-180,180),-180,180),zoom:number(params,'zoom',4,0,18),country:country(params)};
    if (![box.north,box.south,box.east,box.west].every(Number.isFinite)||box.north<=box.south) return json(res,400,{error:'A área visível não é válida.'});
    if (!box.country) {
      const lat=(box.north+box.south)/2,lon=box.west<=box.east?(box.east+box.west)/2:((box.east+box.west+360)/2+540)%360-180;
      box.country=[...cities].sort((a,b)=>distanceKm(lat,lon,a.lat,a.lon)-distanceKm(lat,lon,b.lat,b.lon))[0].countryCode;
    }
    const kind=params.get('kind')||'all';
    const result=await Promise.allSettled([kind==='camera'?[]:countryStations(box.country),kind==='radio'?{cameras:[]}:cameras('viewport',box)]);
    const radio=result[0].status==='fulfilled'?result[0].value:[],cam=result[1].status==='fulfilled'?result[1].value:{cameras:[]};
    const items=[...radio.map(item=>({...item,kind:'station'})),...cam.cameras.map(item=>({...item,kind:'camera'}))].filter(item=>inBounds(item,box));
    return json(res,200,{points:clusterPoints(items,box.zoom).slice(0,200),country:box.country,coverage:'country-sample',configured:cam.configured,cameras:cam.cameras,
      errors:[...result.flatMap(r=>r.status==='rejected'?[r.reason.message]:[]),...(cam.errors||[]).map(e=>e.message)]});
  }
  return json(res,404,{error:'Rota não encontrada.'});
}
export function createApp() {
  return createServer(async(req,res)=>{
    res.setHeader('x-content-type-options','nosniff'); res.setHeader('referrer-policy','strict-origin-when-cross-origin');
    try {
      const url=new URL(req.url||'/','http://localhost');
      if (!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'Método não permitido.'},{allow:'GET, HEAD'});
      if (url.pathname.startsWith('/api/')) return await api(req,res,url);
      const pathname=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
      const file=publicFiles.get(pathname); if (!file) return json(res,404,{error:'Arquivo não encontrado.'});
      const content=await readFile(resolve(ROOT,file));
      res.writeHead(200,{'content-type':(mime[extname(file)]||'application/octet-stream')+'; charset=utf-8','cache-control':'no-cache'});
      res.end(req.method==='HEAD'?undefined:content);
    } catch(error) {
      if (res.headersSent) return res.end();
      const status=error.status||(error instanceof URIError?400:error.code==='ENOENT'?404:502);
      json(res,status,{error:status===404?'Arquivo não encontrado.':error.message||'Não foi possível concluir a consulta.'});
    }
  });
}
if (process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
  createApp().listen(port,host,()=>console.log('Global Syncro: http://'+host+':'+port));
}

