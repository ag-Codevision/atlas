import { loadLibrary } from './runtime.js';
const safeUrl=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}};

export class CameraPlayer {
  constructor(frame, onError, onVolumeChange) {
    this.frame = frame;
    this.onError = onError;
    this.onVolumeChange = onVolumeChange;
    this.version = 0;
    this.isIframeMuted = false;
  }
  close() {
    this.version++; clearInterval(this.refreshTimer); this.hls?.destroy(); this.hls=null;
    const video=this.frame.querySelector('video'); if(video){video.pause();video.removeAttribute('src');video.load();}
    this.frame.replaceChildren();
  }
  async open(camera) {
    this.close(); const version=this.version; const type=camera.streamType;
    const stream=safeUrl(camera.streamUrl),embed=safeUrl(camera.embedUrl);
    // Normaliza URL de embed (garantindo autoplay com áudio ativado por padrão no YouTube e iframes)
    if (['iframe','youtube'].includes(type) && (embed || stream)) {
      let finalEmbed = embed || stream;
      // Extração de ID do YouTube se necessário
      const ytMatch = finalEmbed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|live\/))([a-zA-Z0-9_-]{11})/);
      if (ytMatch) {
        finalEmbed = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&mute=0&playsinline=1&enablejsapi=1&rel=0`;
      } else {
        try {
          const u = new URL(finalEmbed);
          if (!u.searchParams.has('autoplay')) u.searchParams.set('autoplay', '1');
          u.searchParams.set('mute', '0');
          finalEmbed = u.href;
        } catch {}
      }

      this.isIframeMuted = false;
      const iframe = document.createElement('iframe');
      iframe.src = finalEmbed;
      iframe.title = camera.name + ' · ' + camera.provider;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.setAttribute('autoplay', 'true');
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      this.frame.append(iframe);
      this.onVolumeChange?.(false);
      return;
    }
    if (type === 'hls' && stream) {
      const video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.muted = false; // Áudio ATIVADO por padrão
      video.volume = 1;
      video.autoplay = true;
      this.frame.append(video);
      video.addEventListener('error', () => this.fail(camera));
      video.addEventListener('volumechange', () => {
        this.onVolumeChange?.(video.muted);
      });

      const tryPlay = () => {
        const p = video.play();
        if (p && typeof p.catch === 'function') {
          p.catch((err) => {
            // Se o navegador barrar o autoplay com som (política restrita sem clique anterior),
            // aplica fallback silencioso suave sem travar o vídeo
            console.warn('Autoplay com som restrito pela política do navegador; aplicando fallback silenciado:', err);
            video.muted = true;
            video.play().catch(() => {});
            this.onVolumeChange?.(true);
          });
        }
      };

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = stream;
        tryPlay();
      } else {
        try {
          const Hls = await loadLibrary('hls');
          if (version !== this.version) return;
          if (!Hls.isSupported()) return this.fail(camera);
          this.hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          this.hls.attachMedia(video);
          this.hls.loadSource(stream);
          this.hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
          this.hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) this.fail(camera); });
        } catch {
          this.fail(camera);
        }
      }
      return;
    }
    if(['mjpeg','image-refresh'].includes(type)&&stream) {
      const image=document.createElement('img');image.alt=camera.name;image.src=stream;image.onerror=()=>this.fail(camera);this.frame.append(image);
      // Refresh only provider-approved image feeds; tokenized thumbnails are refreshed via metadata instead.
      if(type==='image-refresh')this.refreshTimer=setInterval(()=>{if(version===this.version)image.src=stream;},Math.max(30000,camera.refreshInterval||60000));
      return;
    }
    const thumbnail=safeUrl(camera.thumbnail);
    if(thumbnail){const image=document.createElement('img');image.alt='Última imagem de '+camera.name;image.src=thumbnail;this.frame.append(image);}
    this.message('Confira esta câmera na fonte original. O provedor não oferece reprodução ao vivo aqui.');
  }
  message(text) {const note=document.createElement('div');note.className='camera-unavailable';note.textContent=text;this.frame.append(note);}
  fail(camera) {this.close();this.message('Esta transmissão não abriu no momento.');this.onError?.(camera);}
  get video() {return this.frame.querySelector('video');}
  toggleMute() {
    const v = this.video;
    if (v) {
      v.muted = !v.muted;
      if (!v.muted && v.volume === 0) v.volume = 1;
      this.onVolumeChange?.(v.muted);
      return v.muted;
    }
    const iframe = this.frame.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      this.isIframeMuted = !Boolean(this.isIframeMuted);
      const cmd = this.isIframeMuted ? 'mute' : 'unMute';
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd }), '*');
      this.onVolumeChange?.(this.isIframeMuted);
      return this.isIframeMuted;
    }
    return false;
  }
  isMuted() {
    const v = this.video;
    if (v) return v.muted;
    return Boolean(this.isIframeMuted);
  }
  async pictureInPicture() {if(this.video&&document.pictureInPictureEnabled)await this.video.requestPictureInPicture();}
}
