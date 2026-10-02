import { cache } from '../cache.mjs';
import { coordinate, deduplicate } from '../../shared/geo.js';

const include = 'categories,images,location,player,urls';
export function normalizeCamera(item) {
  const location = item.location || {}, live = item.player?.live;
  const embedUrl = typeof live==='string'?live:(live?.available?live.embed:'');
  const image = item.images?.current || {};
  return {id:String(item.webcamId||item.id||''),provider:'Windy Webcams',providerId:'windy',name:item.title||'Webcam',
    description:(item.categories||[]).map(x=>x.name).join(' · '),country:location.country||'',countryCode:location.country_code||'',state:location.region||'',city:location.city||'',
    latitude:coordinate(location.latitude,-90,90),longitude:coordinate(location.longitude,-180,180),category:item.categories?.[0]?.name||'Webcam',
    categories:(item.categories||[]).map(x=>x.id),thumbnail:image.preview||image.thumbnail||image.icon||'',
    streamType:embedUrl?'iframe':'external',streamUrl:'',embedUrl:embedUrl||'',sourceUrl:item.urls?.detail||'',
    attribution:'Webcams por Windy.com',isLive:item.status==='active'&&Boolean(embedUrl),status:item.status==='inactive'?'UNAVAILABLE':(embedUrl?'LIVE':'UNKNOWN'),
    lastCheckedAt:item.lastUpdatedOn||null,expiresAt:new Date(Date.now()+240000).toISOString(),clusterSize:Number(item.clusterSize)||1,failureCount:0};
}
async function windy(path) {
  const response = await fetch('https://api.windy.com/webcams/api/v3'+path,{headers:{'x-windy-api-key':process.env.WINDY_API_KEY,accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error(response.status===401||response.status===403?'A chave da Windy não autorizou esta consulta.':response.status===429?'A Windy atingiu o limite de consultas. Tente novamente em instantes.':'Windy temporariamente indisponível ('+response.status+').');
  return response.json();
}
export const windyProvider = {
  id:'windy',name:'Windy Webcams',configured:()=>Boolean(process.env.WINDY_API_KEY),
  async search({lat,lon,radius=100,country,category,offset=0}) {
    const params = new URLSearchParams({include,lang:'pt',limit:'50',offset:String(offset)});
    if (Number.isFinite(lat)&&Number.isFinite(lon)) params.set('nearby',[lat,lon,Math.min(250,radius)].join(','));
    if (country) params.set('countries',country);
    if (category) params.set('categories',category);
    const data = await cache.get('windy:list:'+params,180000,()=>windy('/webcams?'+params));
    return deduplicate((data.webcams||[]).map(normalizeCamera),'embedUrl');
  },
  async viewport(box) {
    // Windy permits a bounded tile-sized box; use the nearby endpoint for wider views.
    const span = box.east >= box.west ? box.east-box.west : 360-box.west+box.east;
    const z = Math.max(4,Math.min(18,Math.floor(box.zoom)-2));
    if (span>45/2**(z-4) || box.north-box.south>22.5/2**(z-4)) return this.search({country:box.country});
    const params = new URLSearchParams({include,lang:'pt',northLat:String(box.north),southLat:String(box.south),eastLon:String(box.east),westLon:String(box.west),zoom:String(z)});
    const data = await cache.get('windy:viewport:'+params,180000,()=>windy('/map/clusters?'+params));
    return (Array.isArray(data)?data:[]).map(normalizeCamera);
  },
  async detail(id) {
    return cache.get('windy:detail:'+id,120000,async()=>normalizeCamera(await windy('/webcams/'+encodeURIComponent(id)+'?'+new URLSearchParams({include,lang:'pt'}))));
  }
};
