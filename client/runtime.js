const libraries = new Map();
export const motionDuration = value => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : value;
export function loadLibrary(name) {
  if (libraries.has(name)) return libraries.get(name);
  const promise = new Promise((resolve, reject) => {
    if (name === 'map') return resolve(null);
    const global = name === 'globe' ? 'Globe' : 'Hls';
    if (window[global]) return resolve(window[global]);
    const script = document.createElement('script');
    script.src = name === 'globe' ? './vendor/globe.gl.min.js' : './vendor/hls.min.js';
    script.async = true;
    script.onload = () => resolve(window[global]);
    script.onerror = () => {
      script.remove();
      reject(new Error('Não foi possível carregar ' + name));
    };
    document.head.append(script);
  });
  libraries.set(name, promise);
  promise.catch(() => libraries.delete(name));
  return promise;
}
