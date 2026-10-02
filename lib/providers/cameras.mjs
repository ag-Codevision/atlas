import { windyProvider } from './windy.mjs';
import { publicWebcamsProvider } from './public-webcams.mjs';
import { deduplicate } from '../../shared/geo.js';

// Adapters unificados para consulta e normalização de câmeras
export const cameraProviders = [publicWebcamsProvider, windyProvider];

export const cameraSources = [
  { name: 'Câmeras do Mundo', url: 'https://camerasdomundo.com/', description: 'Catálogo de praias, cidades, aeroportos e pontos turísticos.' },
  { name: 'Windy Webcams', url: 'https://www.windy.com/webcams', description: 'Rede global de imagens e webcams meteorológicas com API v3.' },
  { name: 'Transmissões Públicas Oficiais', url: 'https://www.youtube.com', description: 'Transmissões abertas oficiais de cidades ao redor do mundo.' },
  { name: 'National Park Service', url: 'https://www.nps.gov/subjects/watchingwildlife/webcams.htm', description: 'Câmeras oficiais da vida selvagem e parques naturais.' }
];

export async function cameras(method, query) {
  const enabled = cameraProviders.filter(p => p.configured());
  const results = await Promise.allSettled(enabled.map(p => p[method](query)));
  
  const allCameras = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const errors = results.flatMap((r, i) => r.status === 'rejected' ? [{ provider: enabled[i].name, message: r.reason?.message || 'Falha na consulta' }] : []);
  
  const windyActive = windyProvider.configured();

  return {
    configured: enabled.length > 0,
    windyConfigured: windyActive,
    cameras: deduplicate(allCameras, 'embedUrl'),
    sources: cameraSources,
    errors,
    attribution: windyActive ? 'Câmeras por Windy.com e Transmissões Oficiais' : 'Transmissões Públicas Oficiais & Câmeras do Mundo',
    fetchedAt: new Date().toISOString()
  };
}

export async function cameraDetail(provider, id) {
  const adapter = cameraProviders.find(p => (p.id === provider || provider === 'auto') && p.configured());
  if (!adapter) throw new Error('O provedor desta câmera ainda não está configurado.');
  return adapter.detail(id);
}
