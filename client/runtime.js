const libraries = new Map();
export const motionDuration = value => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : value;
export function loadLibrary(name) {
  if (libraries.has(name)) return libraries.get(name);
  const promise = name === 'map' ? import('../vendor/maplibre-gl.mjs').then(lib=>{
    lib.setWorkerUrl(new URL('../vendor/maplibre-gl-worker.mjs',import.meta.url).href);
    window.maplibregl=lib; return lib;
  }) : new Promise((resolve,reject)=>{
    const global = name==='globe'?'Globe':'Hls';
    if (window[global]) return resolve(window[global]);
    const script=document.createElement('script'); script.src=name==='globe'?'./vendor/globe.gl.min.js':'./vendor/hls.min.js';
    script.async=true; script.onload=()=>resolve(window[global]); script.onerror=()=>{script.remove();reject(new Error('Não foi possível carregar '+name));};
    document.head.append(script);
  });
  libraries.set(name,promise); promise.catch(()=>libraries.delete(name)); return promise;
}
