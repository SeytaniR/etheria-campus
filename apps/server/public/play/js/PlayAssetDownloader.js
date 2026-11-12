/**
 * @file apps/server/public/play/js/PlayAssetDownloader.js
 * @module @etheria/server
 * @description Gerenciador Cliente de Download e Cache Local (CacheStorage API).
 *   - Baixa e armazena no dispositivo do jogador todos os assets curados (mapas, sprites, ícones, VFX).
 *   - Elimina requisições lentas para o GitHub, erros de CORS e telas pretas por falha de carregamento.
 *   - Fornece barra visual de progresso de download no Lobby e no Menu do Jogo.
 */

class PlayAssetDownloader {
  static CACHE_NAME = 'etheria-campus-assets-v1';

  static attach(app) {
    app.assetDownloader = new PlayAssetDownloader(app);
  }

  constructor(app) {
    this.app = app;
    this.isDownloading = false;
    this.totalAssets = 0;
    this.downloadedCount = 0;
    this.failedCount = 0;
    this.isSupported = typeof window !== 'undefined' && 'caches' in window;
    this.cachedUrls = new Set();

    this.init();
  }

  async init() {
    this.injectUi();
    if (this.isSupported) {
      await this.refreshCachedStatus();
    }
  }

  async refreshCachedStatus() {
    if (!this.isSupported) return;
    try {
      const cache = await caches.open(PlayAssetDownloader.CACHE_NAME);
      const keys = await cache.keys();
      this.cachedUrls = new Set(keys.map((k) => new URL(k.url).pathname));
      this.updateStatusBadge();
    } catch {
      // Ignora erro se Cache Storage estiver desabilitado pelo navegador
    }
  }

  updateStatusBadge() {
    const badge = document.getElementById('assetDownloaderBadge');
    const bar = document.getElementById('assetDownloadProgressContainer');
    if (!badge) return;

    if (this.isDownloading) {
      badge.textContent = `⏳ Baixando... (${this.downloadedCount}/${this.totalAssets})`;
      badge.className = 'status-pill status-amber';
      if (bar) bar.style.display = 'block';
    } else if (this.cachedUrls.size > 0) {
      badge.textContent = `💾 ${this.cachedUrls.size} arquivos salvos no dispositivo`;
      badge.className = 'status-pill status-ready';
      if (bar) bar.style.display = 'none';
    } else {
      badge.textContent = `📥 Arquivos em cache remoto (toque para baixar)`;
      badge.className = 'status-pill status-local';
      if (bar) bar.style.display = 'none';
    }
  }

  async startFullDownload() {
    if (this.isDownloading) return;
    if (!this.isSupported) {
      alert('Seu navegador não suporta CacheStorage local. Os arquivos serão baixados sob demanda.');
      return;
    }

    this.isDownloading = true;
    this.downloadedCount = 0;
    this.failedCount = 0;
    this.updateStatusBadge();

    const fillBar = document.getElementById('assetDownloadProgressBarFill');
    const label = document.getElementById('assetDownloadProgressLabel');

    try {
      const manifest = await this.app.api('/api/play/assets-manifest');
      const list = Array.isArray(manifest?.assets) ? manifest.assets : [];
      this.totalAssets = list.length;

      const cache = await caches.open(PlayAssetDownloader.CACHE_NAME);
      const concurrency = 4;

      for (let i = 0; i < list.length; i += concurrency) {
        const chunk = list.slice(i, i + concurrency);
        await Promise.all(
          chunk.map(async (url) => {
            try {
              const matched = await cache.match(url);
              if (!matched) {
                const res = await fetch(url, { cache: 'reload' });
                if (res.ok) {
                  await cache.put(url, res.clone());
                  this.cachedUrls.add(new URL(url, window.location.origin).pathname);
                } else {
                  this.failedCount++;
                }
              } else {
                this.cachedUrls.add(new URL(url, window.location.origin).pathname);
              }
            } catch {
              this.failedCount++;
            } finally {
              this.downloadedCount++;
              const pct = Math.round((this.downloadedCount / Math.max(1, this.totalAssets)) * 100);
              if (fillBar) fillBar.style.width = `${pct}%`;
              if (label) {
                label.textContent = `Baixando arquivos essenciais do jogo: ${this.downloadedCount}/${this.totalAssets} (${pct}%)`;
              }
            }
          })
        );
      }

      this.isDownloading = false;
      this.updateStatusBadge();
      if (label) {
        label.textContent = `✅ Todos os ${this.cachedUrls.size} arquivos do jogo foram salvos no dispositivo!`;
      }
      setTimeout(() => {
        const bar = document.getElementById('assetDownloadProgressContainer');
        if (bar) bar.style.display = 'none';
      }, 3500);
    } catch (err) {
      this.isDownloading = false;
      this.updateStatusBadge();
      alert(`Falha ao baixar arquivos do jogo: ${err.message}`);
    }
  }

  /**
   * Tenta resolver uma URL diretamente do CacheStorage local como Blob URL para carregamento instantâneo.
   */
  async getLocalBlobUrlOrFallback(url) {
    if (!this.isSupported || !url) return url;
    try {
      const cache = await caches.open(PlayAssetDownloader.CACHE_NAME);
      const matched = await cache.match(url);
      if (matched && matched.ok) {
        const blob = await matched.blob();
        return URL.createObjectURL(blob);
      }
    } catch {
      // Fallback para URL HTTP padrão
    }
    return url;
  }

  injectUi() {
    const lobby = document.getElementById('lobbyScreen');
    if (!lobby || document.getElementById('assetDownloaderBox')) return;

    const box = document.createElement('div');
    box.id = 'assetDownloaderBox';
    box.className = 'panel';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.gap = '8px';
    box.style.padding = '12px 16px';
    box.style.marginBottom = '8px';

    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.1rem;">⚡</span>
          <div>
            <strong style="color:#38bdf8; font-size:0.86rem;">Armazenamento Local do Jogo (Anti-Lag & Sem Tela Preta)</strong>
            <div style="font-size:0.74rem; color:var(--text-muted);">
              Baixe os mapas, personagens e monstros para que o jogo abra instantaneamente direto da memória do seu navegador.
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span id="assetDownloaderBadge" class="status-pill status-local">Verificando arquivos...</span>
          <button type="button" class="btn-primary" style="padding:6px 14px; font-size:0.80rem;" onclick="PlayApp.assetDownloader.startFullDownload()">
            📥 Baixar Todos os Arquivos
          </button>
        </div>
      </div>
      <div id="assetDownloadProgressContainer" style="display:none; margin-top:4px;">
        <div style="display:flex; justify-content:space-between; font-size:0.74rem; margin-bottom:4px; color:#fde047;">
          <span id="assetDownloadProgressLabel">Iniciando download...</span>
        </div>
        <div style="width:100%; height:8px; background:#1e293b; border-radius:999px; overflow:hidden; border:1px solid #334155;">
          <div id="assetDownloadProgressBarFill" style="width:0%; height:100%; background:linear-gradient(90deg, #38bdf8, #22c55e); transition:width 0.15s;"></div>
        </div>
      </div>
    `;

    lobby.insertBefore(box, lobby.firstChild);
  }
}

window.PlayAssetDownloader = PlayAssetDownloader;
