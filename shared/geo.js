export function coordinate(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}
export function distanceKm(a, b, c, d) {
  const rad = value => value * Math.PI / 180;
  const n = Math.sin(rad(c-a)/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1,n)), Math.sqrt(Math.max(0,1-n)));
}
export function inBounds(item, box) {
  const {latitude:lat,longitude:lon} = item;
  return lat != null && lon != null && lat >= box.south && lat <= box.north &&
    (box.west <= box.east ? lon >= box.west && lon <= box.east : lon >= box.west || lon <= box.east);
}
export function deduplicate(items, urlField = 'streamUrl') {
  const ids = new Set(), urls = new Set(), result = [];
  for (const item of items) {
    const id = (item.provider || '') + ':' + item.id;
    const url = item[urlField] || item.embedUrl || item.sourceUrl || '';
    if (!item.id || ids.has(id) || (url && urls.has(url))) continue;
    ids.add(id); if (url) urls.add(url); result.push(item);
  }
  return result;
}
// Web Mercator screen grid. Cluster payload stays bounded, regardless of catalog size.
export function clusterPoints(items, zoom = 3, pixels = 70) {
  const cells = new Map(), scale = 256 * 2 ** Math.max(0, Math.min(18, zoom));
  for (const item of items) {
    if (item.latitude == null || item.longitude == null) continue;
    const sin = Math.sin(Math.max(-85,Math.min(85,item.latitude)) * Math.PI / 180);
    const x = (item.longitude + 180) / 360;
    const y = .5 - Math.log((1+sin)/(1-sin)) / (4*Math.PI);
    const key = Math.floor(x*scale/pixels) + ':' + Math.floor(y*scale/pixels);
    const cell = cells.get(key) || {id:'cluster:'+key,latitude:0,longitude:0,count:0,radioCount:0,cameraCount:0,items:[]};
    const weight = Math.max(1, item.clusterSize || 1);
    cell.latitude += item.latitude * weight; cell.longitude += item.longitude * weight; cell.count += weight;
    cell[item.kind === 'camera' ? 'cameraCount' : 'radioCount'] += weight;
    cell.items.push(item); cells.set(key,cell);
  }
  return [...cells.values()].map(cell => cell.count === 1 ? cell.items[0] : {
    id:cell.id,kind:'cluster',latitude:cell.latitude/cell.count,longitude:cell.longitude/cell.count,
    count:cell.count,radioCount:cell.radioCount,cameraCount:cell.cameraCount
  });
}
