import { cache } from '../cache.mjs';

function getPointKey() {
  return process.env.WINDY_API_KEY_POINT_FORECAST ||
         process.env.WINDY_API_KEY_POINT ||
         process.env.WINDY_API_KEY_Point_Forecast ||
         process.env['WINDY_API_KEY_Point Forecast'] ||
         '';
}

function determineCondition({ tempC, precip, windSpeedKm, rh, hour }) {
  const isNight = hour < 6 || hour >= 19;
  
  if (precip > 5) return { condition: 'Chuva Forte', icon: '⛈️', type: 'rain' };
  if (precip > 0.5) return { condition: 'Chuva', icon: '🌧️', type: 'rain' };
  if (precip > 0.05) return { condition: 'Garoa', icon: '🌦️', type: 'rain' };
  
  if (windSpeedKm > 45) return { condition: 'Ventania', icon: '💨', type: 'wind' };
  
  if (tempC <= 0) return { condition: 'Neve / Congelante', icon: '❄️', type: 'cold' };
  if (tempC < 10) return { condition: 'Frio Intenso', icon: '🧣', type: 'cold' };
  
  if (rh > 85) return { condition: 'Neblina / Umidade Alta', icon: '🌫️', type: 'cloud' };
  if (rh > 65) return { condition: isNight ? 'Parcialmente Nublado' : 'Parcialmente Ensolarado', icon: isNight ? '☁️' : '⛅', type: 'cloud' };
  
  return {
    condition: isNight ? 'Céu Limpo' : 'Ensolarado',
    icon: isNight ? '🌙' : '☀️',
    type: isNight ? 'night' : 'day'
  };
}

export const windyForecastProvider = {
  id: 'windy-point',
  name: 'Windy Point Forecast',
  configured: () => Boolean(getPointKey()),

  async getWeather(lat, lon) {
    const key = getPointKey();
    if (!key) {
      throw new Error('Chave da API Windy Point Forecast não configurada.');
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error('Coordenadas geográficas inválidas para consulta de clima.');
    }

    const cacheKey = `windy:point:${lat.toFixed(2)},${lon.toFixed(2)}`;
    // Cache de 30 minutos para poupar chamadas da API
    return cache.get(cacheKey, 1800000, async () => {
      const response = await fetch('https://api.windy.com/api/point-forecast/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          lat,
          lon,
          model: 'gfs',
          parameters: ['temp', 'wind', 'rh', 'precip', 'windGust', 'pressure'],
          levels: ['surface'],
          key
        }),
        signal: AbortSignal.timeout(12000)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Falha na API Windy Point Forecast (${response.status}): ${errorText || response.statusText}`);
      }

      const data = await response.json();
      const timestamps = data.ts || [];
      if (!timestamps.length) {
        throw new Error('Previsão não retornou dados para estas coordenadas.');
      }

      const temps = data['temp-surface'] || [];
      const windsU = data['wind_u-surface'] || [];
      const windsV = data['wind_v-surface'] || [];
      const rhs = data['rh-surface'] || [];
      const precips = data['past3hprecip-surface'] || data['precip-surface'] || [];
      const gusts = data['gust-surface'] || [];
      const pressures = data['pressure-surface'] || [];

      // Passo atual (mais recente da previsão)
      const currentTempK = temps[0] ?? 293.15;
      const currentTempC = Math.round(currentTempK - 273.15);
      const curU = windsU[0] ?? 0;
      const curV = windsV[0] ?? 0;
      const curWindKm = Math.round(Math.hypot(curU, curV) * 3.6);
      const curGustKm = Math.round((gusts[0] ?? 0) * 3.6);
      const curWindDeg = Math.round((Math.atan2(-curU, -curV) * 180 / Math.PI + 360) % 360);
      const curRh = Math.round(rhs[0] ?? 50);
      const curPrecip = Math.round(((precips[0] ?? 0) * 10)) / 10;
      const curPressure = Math.round((pressures[0] ?? 101325) / 100);

      const localDate = new Date(timestamps[0]);
      const hour = localDate.getUTCHours(); // base horário aproximado

      const { condition, icon, type } = determineCondition({
        tempC: currentTempC,
        precip: curPrecip,
        windSpeedKm: curWindKm,
        rh: curRh,
        hour
      });

      // Próximas horas (até 8 intervalos = 24h)
      const hourly = [];
      const stepCount = Math.min(timestamps.length, 8);
      for (let i = 0; i < stepCount; i++) {
        const stepTempC = Math.round((temps[i] ?? 293.15) - 273.15);
        const stepU = windsU[i] ?? 0;
        const stepV = windsV[i] ?? 0;
        const stepWindKm = Math.round(Math.hypot(stepU, stepV) * 3.6);
        const stepPrecip = Math.round(((precips[i] ?? 0) * 10)) / 10;
        const stepRh = Math.round(rhs[i] ?? 50);
        const stepDate = new Date(timestamps[i]);
        const stepHour = stepDate.getUTCHours();
        const stepCond = determineCondition({
          tempC: stepTempC,
          precip: stepPrecip,
          windSpeedKm: stepWindKm,
          rh: stepRh,
          hour: stepHour
        });

        hourly.push({
          time: stepDate.toISOString(),
          timestamp: timestamps[i],
          temperature: stepTempC,
          windSpeed: stepWindKm,
          precipitation: stepPrecip,
          humidity: stepRh,
          condition: stepCond.condition,
          icon: stepCond.icon,
          type: stepCond.type
        });
      }

      return {
        lat,
        lon,
        temperature: currentTempC,
        windSpeed: curWindKm,
        windGust: curGustKm,
        windDirection: curWindDeg,
        humidity: curRh,
        precipitation: curPrecip,
        pressure: curPressure,
        condition,
        icon,
        type,
        hourly,
        model: 'GFS / Windy Forecast',
        attribution: 'Dados meteorológicos por Windy.com',
        fetchedAt: new Date().toISOString()
      };
    });
  }
};
