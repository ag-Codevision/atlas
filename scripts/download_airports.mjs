import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.join(__dirname, "..", "shared", "airports.json");

async function fetchAllAirports() {
  console.log("Iniciando download dos aeroportos do ArcGIS...");
  const baseUrl = "https://services.arcgis.com/LQBWfNRGL1xivDEV/arcgis/rest/services/airports/FeatureServer/0/query";
  
  // Condição: todos os Large e Medium Airports, ou qualquer aeroporto com código IATA
  const where = "Type IN ('Large Airport', 'Medium Airport') OR (IATA_Code IS NOT NULL AND IATA_Code <> '')";
  const fields = "ObjectId,Identifier,Name,IATA_Code,Type,Municipality,ISO_Country,Latitude,Longitude,Elevation__ft_";
  
  let offset = 0;
  const pageSize = 1000;
  let allFeatures = [];
  let hasMore = true;

  while (hasMore) {
    const url = `${baseUrl}?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(fields)}&resultOffset=${offset}&resultRecordCount=${pageSize}&returnGeometry=false&f=json`;
    console.log(`Buscando registros a partir de ${offset}...`);
    
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    const features = data.features || [];
    
    if (features.length === 0) {
      hasMore = false;
      break;
    }

    allFeatures = allFeatures.concat(features);
    console.log(`Baixados ${features.length} registros (Total acumulado: ${allFeatures.length})`);
    
    if (data.exceededTransferLimit || features.length === pageSize) {
      offset += features.length;
    } else {
      hasMore = false;
    }
  }

  console.log(`Total de aeroportos coletados: ${allFeatures.length}`);

  // Formata os aeroportos em estrutura enxuta e otimizada
  const airports = allFeatures.map(f => {
    const a = f.attributes;
    return {
      id: a.Identifier || `apt-${a.ObjectId}`,
      name: (a.Name || "").trim(),
      iata: (a.IATA_Code || "").trim(),
      type: a.Type === "Large Airport" ? "large" : (a.Type === "Medium Airport" ? "medium" : "small"),
      typeLabel: a.Type || "Airport",
      lat: Number(Number(a.Latitude).toFixed(4)),
      lon: Number(Number(a.Longitude).toFixed(4)),
      city: (a.Municipality || "").trim(),
      country: (a.ISO_Country || "").trim(),
      elev: a.Elevation__ft_ != null ? Math.round(Number(a.Elevation__ft_)) : null
    };
  }).filter(a => !isNaN(a.lat) && !isNaN(a.lon) && a.lat !== 0 && a.lon !== 0);

  fs.writeFileSync(outputFile, JSON.stringify(airports));
  const stats = fs.statSync(outputFile);
  console.log(`Sucesso! Salvo em ${outputFile} (${(stats.size / 1024).toFixed(1)} KB, ${airports.length} aeroportos válidos).`);
}

fetchAllAirports().catch(err => {
  console.error("Erro ao baixar aeroportos:", err);
  process.exit(1);
});
