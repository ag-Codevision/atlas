# Radio Atlas — Global Live Radio & Webcam Experience

Plataforma visual, geográfica e cinematográfica para explorar o planeta Terra através de:
- Estações de rádio locais ao vivo (via Radio Browser API em tempo real);
- Webcams e câmeras públicas ao vivo (transmissões oficiais, embeds autorizados e Windy Webcams v3);
- Cidades globais, coordenadas, horário solar e ambientação atmosférica (Dia, Pôr do Sol e Noite);
- Modo exclusivo **LISTEN + WATCH**: sintonize o rádio local enquanto assiste à câmera ao vivo da mesma cidade;
- Mini-player flutuante (Picture-in-Picture in-app);
- Volta ao Mundo contínua (Screensaver Global cinematográfico);
- Command Palette global (`⌘ K` ou `Ctrl + K`) com busca instantânea;
- Diário de Viagens e Minha Coleção com histórico persistido localmente.

---

## 🚀 Como Iniciar

Requisito: **Node.js 20+**

1. Clone ou acerte o diretório do projeto:
   ```bash
   cd "f:\_Meus Projetos 2025\Órbita"
   ```

2. Configure as variáveis de ambiente (opcional):
   Copie `.env.example` para `.env` se desejar adicionar sua chave da Windy Webcams API v3:
   ```env
   WINDY_API_KEY=sua_chave_aqui
   PORT=4173
   HOST=127.0.0.1
   ```
   > **Nota:** A aplicação já vem configurada com câmeras públicas e transmissões oficiais verificadas para as principais cidades mundiais (Tóquio, Nova York, Paris, Rio de Janeiro, Londres, Lisboa, Seul, Roma, etc.), funcionando perfeitamente mesmo sem a chave da Windy!

3. Inicie o servidor:
   ```bash
   npm start
   ```
   Ou para desenvolvimento com recarregamento automático:
   ```bash
   npm run dev
   ```

4. Acesse no navegador:
   👉 **http://127.0.0.1:4173**

---

## 🌍 Arquitetura & Providers

### Rádios
- **Radio Browser API**: Catálogo global com milhares de estações reais. Consultas paginadas por país e coordenadas com ordenação por popularidade e qualidade (HTTPS, bitrate, codecs, status de verificação).
- **Player de Áudio Persistente**: Fixado no rodapé com suporte a stream HLS e áudio nativo, equalizador gráfico, sleep timer (temporizador de sono de 30min), controle de volume e atalhos.

### Câmeras & Webcams
- **Camada Unificada de Provedores (`lib/providers/cameras.mjs`)**:
  - **Public Live Streams**: Transmissões e embeds oficiais de pontos turísticos globais.
  - **Câmeras do Mundo**: Catálogo de orlas, praias, capitais e aeroportos com metadados e link oficial da fonte.
  - **Windy Webcams API v3**: Suporte completo a busca geográfica, clustering e proximidade quando a chave de API estiver configurada no `.env`.
- **Camera Player Adaptativo**: Suporta YouTube embeds autorizados, HLS via `hls.js`, MJPEG, image-refresh e links para fontes oficiais quando a incorporação direta for restrita.

---

## 🎮 Principais Funcionalidades

1. **Globo 3D & Mapa 2D**:
   - Alternância contínua entre visualização em Globo 3D (`globe.gl` com atmosfera, topologia e estrelas) e Mapa 2D (`MapLibre GL` escuro).
2. **Modo LISTEN + WATCH**:
   - Experiência simultânea: a câmera fica em destaque widescreen e a rádio toca como trilha sonora ao vivo da cidade.
3. **Floating Mini-Player**:
   - Ao navegar para outras telas (Descobrir, Coleção ou pelo globo), a transmissão de vídeo minimiza automaticamente para o canto inferior direito sem interrupção.
4. **Volta ao Mundo (Screensaver Global)**:
   - Modo autônomo que percorre o planeta de cidade em cidade a cada 12 segundos, sincronizando rádio e câmera ao vivo.
5. **Command Palette (`⌘ K` ou `Ctrl + K`)**:
   - Busca em tempo real de cidades, frequências de rádio, webcams e gêneros musicais com navegação por teclado.
6. **Curadoria Editorial "Descobrir"**:
   - 11 temas imersivos: *Right Now in Tokyo*, *Morning in Europe*, *Beaches Live*, *Night Radio*, *Airports Live*, *Rainy Cities*, *Jazz Around the World*, *Late Night Seoul*, *Rio Right Now*, *Europe by Radio* e *Random Window*.
7. **Minha Coleção**:
   - Salve suas estações, câmeras e cidades preferidas e consulte o histórico das últimas jornadas.
