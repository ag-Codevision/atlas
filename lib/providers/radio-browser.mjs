import { cache } from '../cache.mjs';
import { coordinate, distanceKm, deduplicate } from '../../shared/geo.js';

const mirrors = ['de1','nl1','at1'].map(name => 'https://' + name + '.api.radio-browser.info');
let preferred = 0;
export async function radioBrowser(path) {
  let lastError;
  for (let attempt = 0; attempt < mirrors.length; attempt++) {
    const index = (preferred + attempt) % mirrors.length;
    try {
      const response = await fetch(mirrors[index] + path, {
        headers:{accept:'application/json','user-agent':'RadioAtlas/1.1 (geographic radio explorer)'}, signal:AbortSignal.timeout(7000)
      });
      if (!response.ok) throw new Error('Radio Browser respondeu com ' + response.status);
      const data = await response.json(); preferred = index; return data;
    } catch (error) { lastError = error; }
  }
  throw new Error('O catálogo de rádios está temporariamente indisponível.', {cause:lastError});
}
export function normalizeStation(item) {
  return {
    id:item.stationuuid,name:String(item.name || 'Estação sem nome').trim(),country:item.country || '',countryCode:item.countrycode || '',
    state:item.state || '',city:'',latitude:coordinate(item.geo_lat,-90,90),longitude:coordinate(item.geo_long,-180,180),
    language:item.language || '',genres:String(item.tags || '').split(',').map(x=>x.trim()).filter(Boolean).slice(0,5),
    bitrate:Number(item.bitrate)||0,codec:item.codec||'',hls:Number(item.hls)===1,favicon:item.favicon||'',
    streamUrl:item.url_resolved||item.url||'',homepage:item.homepage||'',isOnline:Number(item.lastcheckok)===1,
    status:Number(item.lastcheckok)===1?'LIVE':'UNAVAILABLE',lastCheckedAt:item.lastchecktime_iso8601||'',
    votes:Number(item.votes)||0,clicks:Number(item.clickcount)||0,provider:'Radio Browser',failureCount:0
  };
}
function quality(a,b) {
  return Number(b.isOnline)-Number(a.isOnline) || Number(b.streamUrl.startsWith('https:'))-Number(a.streamUrl.startsWith('https:')) ||
    Number(Boolean(b.favicon))-Number(Boolean(a.favicon)) || b.clicks-a.clicks;
}
export async function countryStations(country) {
  return cache.get('country:'+country,300000,async()=>{
    // A bounded country sample, queried in pages on the server; never the entire global catalog.
    const pages = await Promise.all([0,200].map(offset=>radioBrowser('/json/stations/search?'+new URLSearchParams({countrycode:country,hidebroken:'true',has_geo_info:'true',limit:'200',offset:String(offset),order:'clickcount',reverse:'true'}))));
    return deduplicate(pages.flat().map(normalizeStation).filter(x=>x.streamUrl)).sort(quality);
  });
}
export async function globalStations(limit = 1200) {
  return cache.get('global-stations:'+limit, 1800000, async()=>{
    const pages = await Promise.all([
      radioBrowser('/json/stations/search?'+new URLSearchParams({hidebroken:'true',has_geo_info:'true',limit:String(Math.floor(limit/2)),offset:'0',order:'clickcount',reverse:'true'})),
      radioBrowser('/json/stations/search?'+new URLSearchParams({hidebroken:'true',has_geo_info:'true',limit:String(Math.floor(limit/2)),offset:'0',order:'votes',reverse:'true'}))
    ]);
    const merged = deduplicate(pages.flat().map(normalizeStation).filter(x=>x.streamUrl && x.latitude!=null && x.longitude!=null));
    return merged.sort(quality);
  });
}
export async function nearbyStations({country,lat,lon,radius=100,offset=0,limit=30}) {
  const countryItems = await countryStations(country);
  const positioned = Number.isFinite(lat) && Number.isFinite(lon);
  const nearby = positioned ? countryItems.filter(item=>distanceKm(lat,lon,item.latitude,item.longitude)<=radius) : countryItems;
  const scope = nearby.length ? (positioned?'nearby':'country') : 'country';
  const selected = [...(nearby.length ? nearby : countryItems)];
  if (scope==='nearby') selected.sort((a,b)=>distanceKm(lat,lon,a.latitude,a.longitude)-distanceKm(lat,lon,b.latitude,b.longitude)||quality(a,b));
  return {stations:selected.slice(offset,offset+limit),scope,totalMatched:selected.length,nearbyCount:nearby.length,
    hasMore:offset+limit<selected.length,nextOffset:Math.min(offset+limit,selected.length),sampled:countryItems.length,provider:'Radio Browser'};
}
export async function searchStations(query) {
  const settled = await Promise.allSettled(['name','tag'].map(field=>cache.get('search:'+field+':'+query.toLowerCase(),300000,()=>
    radioBrowser('/json/stations/search?'+new URLSearchParams({[field]:query,limit:'16',hidebroken:'true',order:'clickcount',reverse:'true'})))));
  if (settled.every(x=>x.status==='rejected')) throw settled[0].reason;
  return deduplicate(settled.flatMap(x=>x.status==='fulfilled'?x.value:[]).map(normalizeStation).filter(x=>x.streamUrl)).sort(quality).slice(0,24);
}
export async function stationHealth(id) {
  return cache.get('health:'+id,60000,async()=>{
    const rows = await radioBrowser('/json/checks/'+encodeURIComponent(id)+'?limit=1');
    const check = rows?.[0];
    return {id,status:check?(Number(check.ok)===1?'LIVE':'UNAVAILABLE'):'UNKNOWN',lastCheckedAt:check?.timestamp_iso8601||null,
      failureCount:check && !Number(check.ok)?1:0,source:'Radio Browser',scope:'provider-check'};
  });
}
