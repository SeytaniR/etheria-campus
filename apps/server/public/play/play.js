/**
 * @file apps/server/public/play/play.js
 * @module @etheria/server
 * @description Motor Cliente da Rota dos Jogadores (`/play`) e Exploração 2.5D em Tempo Real.
 *   Gerencia autenticação, lobby de criação/seleção de personagens, loop 60 FPS, física,
 *   colisão poligonal suave, travessia de portais pareados e renderização com profundidade (Y-Sorting).
 */
class EtheriaPlayClient {
  constructor() {
    // Reutiliza automaticamente o token do /admin se o usuário já estiver logado lá
    this.token =
      localStorage.getItem('etheria_play_token') ||
      localStorage.getItem('etheria_admin_token') ||
      '';
    this.session = null;
    // Dados do Bootstrap
    this.classTemplates = [];
    this.elements = [];
    this.races = [];
    this.combatAttributes = [];
    this.attributeConversions = [];
    this.elementMatchups = [];
    this.mapsList = [];
    this.myCharacters = [];
    this.selectedClassIdForCreation = null;
    // Estado do Personagem e Mapa Ativo no Mundo
    this.activeChar = null;
    this.currentMap = null;
    this.mesh = null;
    this.mapBgImage = null;
    this.spriteCache = new Map();
    // Posição, Direção e Movimento em Tempo Real
    this.playerX = 500;
    this.playerY = 500;
    this.playerDir = 0; // 0..7
    this.isMoving = false;
    this.moveTargetX = null;
    this.moveTargetY = null;
    this.targetDestX = null;
    this.targetDestY = null;
    this.lastRepathTime = 0;
    this.currentPath = null;
    this.keysDown = new Set();
    this.dpadDx = 0;
    this.dpadDy = 0;
    this.baseMoveSpeed = 168; // pixels por segundo (reduzido em 20% do valor anterior de 210)
    // Câmera do Mundo
    this.zoom = 1.0; this.baseZoom = 1.0;
    this.lastPinchDist = 0;
    // Cooldown de Portal e Sincronização com o Servidor
    this.portalCooldownUntil = 0;
    this.isTraversingPortal = false;
    this.arrivedAtPortalId = null;
    this.camX = 0;
    this.camY = 0;
    this.lastSyncedX = 0;
    this.lastSyncedY = 0;
    this.lastSyncTime = 0;
    // Estado do Painel GM Integrado (`/gm`) & Voo / Asas
    this.gmXray = false; this.gmNoClip = false; this.gmSpeedMultiplier = 1;
    this.isFlying = false; this.isLandingFlight = false; this.flightAltitudeCurrent = 0; this.flightTargetAltitude = 0; this.flightLandingTarget = null;
    // Arena Instanciada com Combate Livre em Tempo Real e Encontros no Mapa
    this.stepDistanceAccumulator = 0;
    this.encounterCooldownUntil = 0;
    this.isEncounterLoading = false;
    this.actionCombatArena = null;
    this.actionArena = null;
    // Vincula módulos externos (Lobby, Painel GM, Ficha Procedural e Sistema de Quests)
    if (window.PlayLobbyController) window.PlayLobbyController.attach(this);
    if (window.PlayGmController) window.PlayGmController.attach(this);
    if (window.PlayQuestsController) window.PlayQuestsController.attach(this);
    if (window.PlayBagController) window.PlayBagController.attach(this);
    if (window.PlayAssetDownloader) window.PlayAssetDownloader.attach(this);
    this.lastFrameTime = performance.now();
    this._renderQueue = [];
    this._renderPool = [];
    this._renderQueue.pushItem = (t, y, d) => this.pushRenderItem(t, y, d);
    this.init();
  }
  async init() {
    this.setupWorldEvents();
    if (window.PlayMapPresenceController) window.PlayMapPresenceController.init(this);
    if (window.PlayHudController) window.PlayHudController.init(this);
    if (window.PlayPetsController) window.PlayPetsController.init(this);
    if (window.PlayHunterController) window.PlayHunterController.attach(this);
    if (window.ActionCombatArena) {
      this.actionCombatArena = new ActionCombatArena(this);
      this.actionArena = this.actionCombatArena;
    }
    if (window.LevelUpVfxController) {
      this.levelUpVfx = new LevelUpVfxController();
      this.levelUpVfx.attach(this);
    }
    requestAnimationFrame((t) => this.gameLoop(t));
    if (this.token) {
      try {
        await this.loadPlayBootstrap();
        this.showLobby();
        return;
      } catch {
        // Se o token antigo expirou ou falhou, mostra tela de login
      }
    }
    document.getElementById('playLoginScreen').style.display = 'flex';
  }
  async api(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (window.EtheriaI18n) {
      headers['X-Etheria-Locale'] = window.EtheriaI18n.getLocale();
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(path, Object.assign({}, options, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro HTTP ${res.status}`);
    }
    return data;
  }
  async changeLocale(nextLocale) {
    const loc = window.EtheriaI18n ? window.EtheriaI18n.setLocale(nextLocale) : 'pt-BR';
    if (!this.token) return;
    await this.api('/api/play/locale', { method: 'POST', body: JSON.stringify({ locale: loc }) }).catch(() => {});
    await this.loadPlayBootstrap().catch(() => {});
    const worldScreen = document.getElementById('worldScreen');
    if (worldScreen && worldScreen.style.display !== 'none' && this.activeChar && this.currentMap?.id) {
      await this.loadMapIntoWorld(this.currentMap.id, this.playerX, this.playerY, this.arrivedAtPortalId);
    }
  }
  async login() {
    const username = document.getElementById('playUsername').value.trim();
    const password = document.getElementById('playPassword').value;
    const errBox = document.getElementById('playLoginError');
    errBox.style.display = 'none';
    try {
      const res = await this.api('/api/play/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      this.token = res.token;
      localStorage.setItem('etheria_play_token', this.token);
      await this.loadPlayBootstrap();
      this.showLobby();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    }
  }
  logout() {
    this.token = '';
    localStorage.removeItem('etheria_play_token');
    this.activeChar = null;
    document.getElementById('worldScreen').style.display = 'none';
    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('playLoginScreen').style.display = 'flex';
  }
  async loadPlayBootstrap() {
    const data = await this.api('/api/play/bootstrap');
    this.session = data.session;
    if (window.EtheriaI18n && data.session?.locale && !localStorage.getItem('etheria_locale')) {
      window.EtheriaI18n.setLocale(data.session.locale, { persist: false });
    }
    if (data.baseMoveSpeed) {
      this.baseMoveSpeed = Number(data.baseMoveSpeed);
    }
    this.classTemplates = data.classTemplates || [];
    this.elements = data.elements || [];
    this.races = data.races || [];
    this.combatAttributes = data.combatAttributes || [];
    this.attributeConversions = data.attributeConversions || [];
    this.elementMatchups = data.elementMatchups || [];
    this.mapsList = data.maps || [];
    this.myCharacters = data.characters || [];
    this.availablePets = data.availablePets || [];
    this.skillTemplates = data.skillTemplates || [];
    this.uiLayoutTemplates = data.uiLayoutTemplates || [];
    if (window.PlayUiLayoutApplier) {
      window.PlayUiLayoutApplier.init(this.uiLayoutTemplates);
    }
    if (this.classTemplates.length > 0 && !this.selectedClassIdForCreation) {
      this.selectedClassIdForCreation = this.classTemplates[0].id;
    }
    this.renderLobby();
    if (typeof this.renderGmTeleportList === 'function') {
      this.renderGmTeleportList();
    }
  }
  showLobby() {
    document.getElementById('playLoginScreen').style.display = 'none';
    document.getElementById('worldScreen').style.display = 'none';
    document.getElementById('lobbyScreen').style.display = 'flex';
    if (typeof this.renderLobby === 'function') {
      this.renderLobby();
    }
  }
  getElementStyle(elementCode) {
    const styles = {
      FIRE: { icon: '🔥', color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.2)' },
      EARTH: { icon: '🪨', color: '#fde68a', bg: 'rgba(245, 158, 11, 0.2)' },
      AIR: { icon: '🌪️', color: '#a7f3d0', bg: 'rgba(16, 185, 129, 0.2)' },
      WATER: { icon: '💧', color: '#7dd3fc', bg: 'rgba(56, 189, 248, 0.2)' },
      NEUTRAL: { icon: '⚪', color: '#cbd5e1', bg: 'rgba(148, 163, 184, 0.2)' },
    };
    return styles[elementCode] || styles.NEUTRAL;
  }
  getOrCreateSprite(key, atlasJsonUrl, atlasWebpUrl, thumbUrl) {
    if (!this.spriteCache.has(key)) {
      this.spriteCache.set(key, new McreworkSpriteSheet(atlasJsonUrl, atlasWebpUrl, thumbUrl));
    }
    return this.spriteCache.get(key);
  }
  getMapBounds() {
    const w = this.mapBgImage?.naturalWidth || this.currentMap?.width || 2000;
    const h = this.mapBgImage?.naturalHeight || this.currentMap?.height || 1500;
    return { width: Math.max(200, Number(w)), height: Math.max(200, Number(h)) };
  }
  async loadMapIntoWorld(mapId, startX, startY, arrivedAtPortalId = null, opts = {}) {
    try {
      const mapData = await this.api(`/api/play/map/${mapId}`);
      this.currentMap = mapData;
      this.mesh = new ClientPolygonMesh(
        mapData.collisionMeshJson, mapData.overlapMeshJson, mapData.overlapOpacity, mapData.buildingMeshJson, mapData.plantationMeshJson
      );
      this.playerX = startX !== undefined ? Number(startX) : Number(mapData.spawnX);
      this.playerY = startY !== undefined ? Number(startY) : Number(mapData.spawnY);
      this.isTraversingPortal = true;
      this.currentPath = null; this.moveTargetX = null; this.moveTargetY = null; this.targetDestX = null; this.targetDestY = null;
      this.arrivedAtPortalId = arrivedAtPortalId ?? null;
      window.PlayFlightAndWingsController?.restoreFlightOnMapLoad(this, mapData, opts);
      if (mapData.width && mapData.height) {
        this.mesh?.initNavGrid(mapData.width, mapData.height);
      }
      const initialW = mapData.width || 2000;
      const initialH = mapData.height || 1500;
      this.playerX = Math.max(20, Math.min(initialW - 20, this.playerX));
      this.playerY = Math.max(24, Math.min(initialH - 20, this.playerY));
      this.portalCooldownUntil = performance.now() + 5000;
      // Carrega a imagem base limpa do mapa via proxy local ou remoto com fallback automático
      let rawBg = (mapData.bgImageUrl || mapData.mcreworkMapImage || '').trim();
      let finalBgUrl = rawBg;
      if (!finalBgUrl.startsWith('http://') && !finalBgUrl.startsWith('https://') && !finalBgUrl.startsWith('/')) {
        finalBgUrl = `/api/assets/mcrework/${finalBgUrl.replace(/^\/+/, '')}`;
      }
      this.loadMapBackground(mapData.id, finalBgUrl);
      // Pré-aquece os sprites do personagem e dos NPCs do mapa
      if (this.activeChar) {
        this.getOrCreateSprite(
          `char_${this.activeChar.mcreworkCharKey}`,
          this.activeChar.atlasJsonUrl,
          this.activeChar.atlasWebpUrl,
          this.activeChar.thumbUrl
        ).load();
      }
      for (const npc of mapData.npcs || []) {
        this.getOrCreateSprite(
          `npc_${npc.mcreworkNpcKey}`,
          npc.atlasJsonUrl,
          npc.atlasWebpUrl,
          npc.thumbUrl
        ).load();
      }
      this.updateHudInfo();
      if (typeof this.renderGmTeleportList === 'function') {
        this.renderGmTeleportList();
      }
      if (typeof this.loadCharacterQuests === 'function') {
        await this.loadCharacterQuests();
      }
      if (mapData.isDungeon || mapData.mapType?.code === 'DUNGEON') {
        void this.checkAndStartDungeon(mapData);
      }
    } catch (err) {
      alert(`Erro ao carregar mapa #${mapId}: ${err.message}`);
    } finally {
      this.isTraversingPortal = false;
    }
  }
  loadMapBackground(mapId, remoteBgUrl) {
    this.mapBgImage = null;
    const localProxyUrl = `/api/assets/map-image/${mapId}`;
    const tryLoad = (srcUrl, isFallback) => {
      const img = new Image();
      // Não define crossOrigin para evitar bloqueios de CORS e cache em redes móveis
      img.onload = () => {
        if (this.currentMap && Number(this.currentMap.id) === Number(mapId)) {
          this.mapBgImage = img;
          this.mesh?.initNavGrid(img.naturalWidth, img.naturalHeight);
          const b = this.getMapBounds();
          this.playerX = Math.max(18, Math.min(b.width - 18, this.playerX));
          this.playerY = Math.max(20, Math.min(b.height - 18, this.playerY));
        }
      };
      img.onerror = (err) => {
        console.warn(`[MapLoader] Falha ao carregar mapa de ${srcUrl}:`, err);
        if (!isFallback && remoteBgUrl && remoteBgUrl !== srcUrl) {
          console.info(`[MapLoader] Tentando fonte remota de fallback: ${remoteBgUrl}`);
          tryLoad(remoteBgUrl, true);
        } else if (isFallback && srcUrl !== localProxyUrl) {
          console.info(`[MapLoader] Tentando proxy local de fallback: ${localProxyUrl}`);
          tryLoad(localProxyUrl, true);
        }
      };
      img.src = srcUrl;
      if (img.complete && img.naturalWidth > 0) {
        if (this.currentMap && Number(this.currentMap.id) === Number(mapId)) {
          this.mapBgImage = img;
          this.mesh?.initNavGrid(img.naturalWidth, img.naturalHeight);
          const b = this.getMapBounds();
          this.playerX = Math.max(18, Math.min(b.width - 18, this.playerX));
          this.playerY = Math.max(20, Math.min(b.height - 18, this.playerY));
        }
      }
    };
    // Prioriza o proxy local (same-origin, multiplexado no Cloudflare Tunnel e com cache em RAM)
    tryLoad(localProxyUrl, false);
  }
  updateHudInfo() {
    if (!this.activeChar || !this.currentMap) return;
    const el = this.getElementStyle(this.activeChar.elementCode);
    document.getElementById('hudCharName').textContent = `${this.activeChar.name} (Nv.${this.activeChar.level})`;
    document.getElementById('hudCharClass').textContent = `• ${this.activeChar.classNamePtBr}`;
    const goldEl = document.getElementById('hudGoldBadge');
    if (goldEl) goldEl.textContent = `🪙 ${Number(this.activeChar.gold || 0).toLocaleString('pt-BR')}`;
    const badge = document.getElementById('hudElementBadge');
    badge.textContent = `${el.icon} ${this.activeChar.elementNamePtBr}`;
    badge.style.background = el.bg;
    badge.style.color = el.color;
    document.getElementById('hudMapName').textContent = `🗺️ #${this.currentMap.id} ${this.currentMap.namePtBr} (Nv.${this.currentMap.requiredLevel})`;
    document.getElementById('hudCoords').textContent = `X:${Math.round(this.playerX)} Y:${Math.round(this.playerY)}`;
    const pvpLabels = {
      DUEL_ONLY: '🤝 PvP: Duelo',
      FORCED_PK: '⚠️ PvP: PK Forçado',
      OPEN_PVP: '⚔️ PvP: Aberto',
    };
    const mt = this.currentMap.mapType || {};
    const rulesEl = document.getElementById('hudMapRules');
    if (rulesEl) {
      rulesEl.textContent = mt.code === 'DUNGEON'
        ? `🏰 ${mt.namePtBr || 'Dungeon'} • 🌫️ Véu Livre • 👹 Monstros Livres`
        : `${mt.namePtBr || ''} • ${pvpLabels[mt.pvpRule] || ''} • ${mt.allowMonsterSpawn ? '👹 Spawna Monstros' : '🕊️ Zona Segura'}`;
    }
    // Atualiza a nova HUD Mobile Vertical (PlayHudController)
    if (window.PlayHudController) {
      window.PlayHudController.updatePlayer(this.activeChar);
      window.PlayHudController.updateMinimap(
        this.currentMap,
        this.mapBgImage,
        this.playerX,
        this.playerY,
        this.playerDir
      );
    }
  }
  // ==========================================================================
  // MOVIMENTAÇÃO, COLISÃO POLIGONAL, PORTAIS E LOOP DE RENDERIZAÇÃO 60 FPS
  // ==========================================================================
  /**
   * Fórmula Matemática Oficial do mcrework para 8 Direções:
   * 0: Sul (Frente), 1: Sudeste, 2: Leste (Direita), 3: Nordeste,
   * 4: Norte (Costas), 5: Noroeste, 6: Oeste (Esquerda), 7: Sudoeste
   */
  calculateDirection8(dx, dy) {
    const angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 a 180 (dy positivo para baixo)
    const sector = Math.round((90 - angle) / 45);
    return ((sector % 8) + 8) % 8;
  }
  setDpad(dx, dy) {
    if (window.PlayPartyController?.isFollower()) return;
    this.dpadDx = dx;
    this.dpadDy = dy;
    if (dx !== 0 || dy !== 0) {
      this.currentPath = null; this.moveTargetX = null; this.moveTargetY = null; this.targetDestX = null; this.targetDestY = null;
    }
  }
  changeZoom(factor) {
    this.baseZoom = Math.min(2.6, Math.max(0.3, (this.baseZoom || 1.0) * factor));
    this.zoom = window.PlayFlightAndWingsController?.computeEffectiveZoom(this, this.baseZoom) ?? this.baseZoom;
  }
  centerCameraOnPlayer() {
    this.zoom = 1.0;
  }
  setupWorldEvents() {
    window.PlayWorldInputController?.setupWorldEvents(this);
  }
  resizeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  screenToWorld(sx, sy) {
    const canvas = document.getElementById('gameCanvas');
    const focusX = this.actionCombatArena?.isActive ? this.actionCombatArena.getCamFocusX() : this.playerX;
    const focusY = this.actionCombatArena?.isActive ? this.actionCombatArena.getCamFocusY() : this.playerY;
    const camX = this.camX !== undefined ? this.camX : Math.round(canvas.width / 2 - focusX * this.zoom);
    const camY = this.camY !== undefined ? this.camY : Math.round(canvas.height / 2 - focusY * this.zoom);
    return {
      x: Math.round((sx - camX) / this.zoom),
      y: Math.round((sy - camY) / this.zoom),
    };
  }
  pushRenderItem(type, y, data) {
    let item = this._renderPool.pop();
    if (!item) item = { type, y, data };
    else { item.type = type; item.y = y; item.data = data; }
    this._renderQueue.push(item);
  }
  gameLoop(now) {
    const elapsed = now - this.lastFrameTime;
    if (elapsed < 15.5) { requestAnimationFrame((t) => this.gameLoop(t)); return; }
    const dt = Math.min(0.05, elapsed / 1000);
    this.lastFrameTime = now;
    if (this.activeChar && this.currentMap) {
      if (this.actionCombatArena?.isActive) {
        this.actionCombatArena.updatePhysics(dt, now);
        this.actionCombatArena.updateHud();
      } else {
        this.updatePhysics(dt, now);
      }
      this.renderWorld(now);
    }
    requestAnimationFrame((t) => this.gameLoop(t));
  }
  updatePhysics(dt, now) {
    if (window.PlayPartyController?.isFollower()) {
      window.PlayPartyController.updateFollowerMovement(dt);
      if (window.PlayPetsController) window.PlayPetsController.updateFollowerPhysics(this, dt);
      return;
    }
    const lockManualMove = Boolean(this.isLandingFlight && this.flightLandingTarget);
    let vx = lockManualMove ? 0 : this.dpadDx;
    let vy = lockManualMove ? 0 : this.dpadDy;
    if (!lockManualMove) {
      if (this.keysDown.has('w') || this.keysDown.has('arrowup')) vy -= 1;
      if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) vy += 1;
      if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) vx -= 1;
      if (this.keysDown.has('d') || this.keysDown.has('arrowright')) vx += 1;
    }
    if (vx === 0 && vy === 0 && this.currentPath && this.currentPath.length > 0) {
      const wp = this.currentPath[0];
      const dx = wp.x - this.playerX;
      const dy = wp.y - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= 14) {
        this.currentPath.shift();
        if (this.currentPath.length > 0) {
          this.moveTargetX = this.currentPath[0].x;
          this.moveTargetY = this.currentPath[0].y;
        } else {
          this.currentPath = null;
          this.moveTargetX = null;
          this.moveTargetY = null;
          this.targetDestX = null;
          this.targetDestY = null;
        }
      } else {
        vx = dx / dist;
        vy = dy / dist;
      }
    } else if (vx === 0 && vy === 0 && this.moveTargetX !== null && this.moveTargetY !== null) {
      const dx = this.moveTargetX - this.playerX;
      const dy = this.moveTargetY - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= 8) {
        this.moveTargetX = null;
        this.moveTargetY = null;
        this.targetDestX = null;
        this.targetDestY = null;
      } else {
        vx = dx / dist;
        vy = dy / dist;
      }
    } else if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      vx /= len;
      vy /= len;
    }
    if (vx !== 0 || vy !== 0) {
      this.isMoving = true;
      this.playerDir = this.calculateDirection8(vx, vy);
      const bounds = this.getMapBounds();
      const pad = 18;
      const clampX = (x) => Math.max(pad, Math.min(bounds.width - pad, x));
      const clampY = (y) => Math.max(pad, Math.min(bounds.height - pad, y));
      this.playerX = clampX(this.playerX);
      this.playerY = clampY(this.playerY);
      const flyMult = window.PlayFlightAndWingsController?.getMoveSpeedMultiplier(this) || 1;
      const speed = this.baseMoveSpeed * this.gmSpeedMultiplier * flyMult;
      const nextX = clampX(this.playerX + vx * speed * dt);
      const nextY = clampY(this.playerY + vy * speed * dt);
      const prevX = this.playerX;
      const prevY = this.playerY;
      if (this.gmNoClip || this.isFlying || (this.flightAltitudeCurrent || 0) > 2 || !this.mesh) {
        this.playerX = nextX;
        this.playerY = nextY;
      } else {
        // Verifica colisão poligonal com deslizamento suave pelas paredes
        if (!this.mesh.isPointBlocked(nextX, nextY)) {
          this.playerX = nextX;
          this.playerY = nextY;
        } else if (!this.mesh.isPointBlocked(nextX, this.playerY)) {
          this.playerX = nextX;
        } else if (!this.mesh.isPointBlocked(this.playerX, nextY)) {
          this.playerY = nextY;
        } else {
          // Bloqueio frontal! Se estiver indo para um destino, recalcula rota contornando obstáculo
          if (this.targetDestX !== null && this.targetDestY !== null && (now - this.lastRepathTime > 220)) {
            this.lastRepathTime = now;
            const repath = this.mesh.findPath(this.playerX, this.playerY, this.targetDestX, this.targetDestY);
            if (repath && repath.length > 0) {
              this.currentPath = repath;
              this.moveTargetX = repath[0].x;
              this.moveTargetY = repath[0].y;
            } else {
              this.currentPath = null;
              this.moveTargetX = null;
              this.moveTargetY = null;
              this.targetDestX = null;
              this.targetDestY = null;
            }
          } else if (this.currentPath && this.currentPath.length > 1) {
            this.currentPath.shift();
            this.moveTargetX = this.currentPath[0].x;
            this.moveTargetY = this.currentPath[0].y;
          } else {
            this.currentPath = null;
            this.moveTargetX = null;
            this.moveTargetY = null;
            this.targetDestX = null;
            this.targetDestY = null;
          }
        }
      }
      // Acumula passos (~50px cada) para sortear encontro com monstros
      const stepDist = Math.hypot(this.playerX - prevX, this.playerY - prevY);
      if (stepDist > 0 && !this.gmNoClip && !this.isFlying) {
        this.stepDistanceAccumulator += stepDist;
        if (this.stepDistanceAccumulator >= 50) {
          this.stepDistanceAccumulator -= 50;
          this.checkRandomEncounter(now);
        }
      }
      document.getElementById('hudCoords').textContent = `X:${Math.round(this.playerX)} Y:${Math.round(this.playerY)}`;
    } else {
      this.isMoving = false;
    }
    this.checkPortalsAndNpcs(now);
    window.PlayFlightAndWingsController?.updateFlightPhysics(this, dt, now);
    if (window.PlayPetsController) window.PlayPetsController.updateFollowerPhysics(this, dt);
    if (window.PlayMapPresenceController) window.PlayMapPresenceController.syncHeartbeat(now);
  }
  async checkAndStartDungeon(mapData) {
    if (!this.activeChar || !mapData || this.actionCombatArena?.isActive) return;
    if (window.PlayFlightAndWingsController && !window.PlayFlightAndWingsController.assertGroundedForCombat(this, 'entrar em combate na Masmorra')) return;
    try {
      const res = await this.api('/api/play/dungeon/enter-battle', { method: 'POST', body: JSON.stringify({ characterId: this.activeChar.id, mapId: mapData.id }) });
      if (res?.ticketSpent && res?.exitDestination) {
        alert(res.message || '⏳ Você já utilizou sua entrada diária nesta Dungeon hoje.');
        void this.loadMapIntoWorld(res.exitDestination.mapId, res.exitDestination.x, res.exitDestination.y);
        return;
      }
      if (res?.battleState) {
        if (!this.actionCombatArena && window.ActionCombatArena) { this.actionCombatArena = new ActionCombatArena(this); this.actionArena = this.actionCombatArena; }
        this.actionCombatArena?.openArena(res.battleState);
      }
    } catch (err) {
      alert(`🏰 Não foi possível iniciar a Dungeon: ${err.message}`);
    }
  }
  async resetDungeonTickets() {
    if (!this.activeChar) return;
    try {
      const res = await this.api('/api/play/gm/reset-dungeon-tickets', { method: 'POST', body: JSON.stringify({ characterId: this.activeChar.id }) });
      alert(`✅ ${res?.message || 'Entradas resetadas!'}`);
    } catch (err) { alert(`Erro: ${err.message}`); }
  }
  checkRandomEncounter(now) {
    if (this.isFlying || (this.flightAltitudeCurrent || 0) > 0.5 || this.actionCombatArena?.isActive || this.isEncounterLoading || !this.currentMap || !this.activeChar || now < this.encounterCooldownUntil) return;
    if (this.currentMap.mapType?.code === 'DUNGEON' || !this.currentMap.mapType?.allowMonsterSpawn || this.currentMap.canSpawnMonsters === false) return;
    const rate = Number(this.currentMap.encounterRatePct) || 0;
    if (rate > 0 && Math.random() * 100 < rate) {
      void this.triggerMapEncounter();
    }
  }
  async triggerMapEncounter() {
    if (this.isFlying || (this.flightAltitudeCurrent || 0) > 0.5 || this.isEncounterLoading || !this.activeChar || !this.currentMap || this.currentMap.mapType?.code === 'DUNGEON' || !this.currentMap.mapType?.allowMonsterSpawn || this.currentMap.canSpawnMonsters === false) return;
    this.isEncounterLoading = true;
    this.moveTargetX = null;
    this.moveTargetY = null;
    this.targetDestX = null;
    this.targetDestY = null;
    this.currentPath = null;
    this.isMoving = false;
    this.dpadDx = 0;
    this.dpadDy = 0;
    this.keysDown.clear();
    try {
      const battleState = await this.api('/api/play/combat/encounter', {
        method: 'POST',
        body: JSON.stringify({
          characterId: this.activeChar.id,
          mapId: this.currentMap.id,
        }),
      });
      if (!this.actionCombatArena && window.ActionCombatArena) {
        this.actionCombatArena = new ActionCombatArena(this);
        this.actionArena = this.actionCombatArena;
      }
      if (this.actionCombatArena) {
        this.actionCombatArena.openArena(battleState);
      }
    } catch (err) {
      console.warn('Encontro cancelado:', err.message);
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('zona segura') || msg.includes('nenhum monstro')) {
        if (this.currentMap) this.currentMap.canSpawnMonsters = false;
        this.encounterCooldownUntil = performance.now() + 10000;
      } else {
        this.encounterCooldownUntil = performance.now() + 5000;
      }
    } finally {
      this.isEncounterLoading = false;
    }
  }
  checkPortalsAndNpcs(now) {
    if (window.PortalTravelController) {
      window.PortalTravelController.update(this, now);
    }
    const prompt = document.getElementById('interactionPrompt');
    const textEl = document.getElementById('interactionText');
    const btnEl = document.getElementById('interactionBtn');
    if (!this.currentMap || this.actionCombatArena?.isActive || this.isTraversingPortal) {
      if (prompt) prompt.style.display = 'none';
      return;
    }
    // Verifica proximidade de NPCs Interativos e Indicadores de Quest
    for (const n of this.currentMap.npcs || []) {
      const dist = Math.hypot(this.playerX - n.posX, this.playerY - n.posY);
      if (dist <= 68 && prompt && textEl && btnEl) {
        prompt.style.display = 'flex';
        const qInd = this.questState?.npcHeadIndicators?.[n.npcTemplateId];
        const stateLabels = { TURN_IN_READY: '❓ Entregar Missão', AVAILABLE: '❗ Nova Missão', IN_PROGRESS: '❓ Missão em Andamento' };
        textEl.textContent = `🧙 ${n.namePtBr}`;
        const nRoles = Array.isArray(n.rolesJson) ? n.rolesJson : [];
        const defaultLabel = nRoles.includes('HUNTER') ? '🐾 Falar com Caçador' : '💬 Conversar';
        btnEl.textContent = stateLabels[qInd?.state] || defaultLabel;
        btnEl.onclick = () => { if (typeof this.openNpcQuestModal === 'function') void this.openNpcQuestModal(n); };
        return;
      }
    }
    if (prompt) prompt.style.display = 'none';
  }
  traversePortal(portalId) {
    if (!this.activeChar || this.isTraversingPortal) return;
    const portal = (this.currentMap?.portals || []).find((p) => p.id === portalId);
    if (window.PortalTravelController && portal) {
      window.PortalTravelController.openConfirmation(this, portal);
    }
  }
  toggleBattleSfx() {
    if (window.BattleTransitionController) {
      const enabled = window.BattleTransitionController.toggleSound();
      const btn = document.getElementById('btnGmToggleSfx');
      if (btn) btn.textContent = enabled ? '🔊 Ligado' : '🔇 Mudo';
    }
  }
  renderWorld(now) {
    window.PlayWorldRenderer?.renderWorld(this, now);
  }
}
window.PlayApp = new EtheriaPlayClient();
