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
    this.zoom = 1.0;
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
  async loadMapIntoWorld(mapId, startX, startY, arrivedAtPortalId = null) {
    try {
      const mapData = await this.api(`/api/play/map/${mapId}`);
      this.currentMap = mapData;
      this.mesh = new ClientPolygonMesh(
        mapData.collisionMeshJson,
        mapData.overlapMeshJson,
        mapData.overlapOpacity
      );
      this.playerX = startX !== undefined ? Number(startX) : Number(mapData.spawnX);
      this.playerY = startY !== undefined ? Number(startY) : Number(mapData.spawnY);
      this.isTraversingPortal = true;
      this.currentPath = null; this.moveTargetX = null; this.moveTargetY = null; this.targetDestX = null; this.targetDestY = null;
      this.arrivedAtPortalId = arrivedAtPortalId ?? null;
      this.isFlying = false; this.isLandingFlight = false; this.flightAltitudeCurrent = 0; this.flightTargetAltitude = 0; this.flightLandingTarget = null;
      window.PlayFlightAndWingsController?.syncVisualAppearance(this, this.activeChar?.visualAppearance);
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
        finalBgUrl = `https://seytanir.github.io/mcrework/${finalBgUrl.replace(/^\/+/, '')}`;
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
    this.zoom = Math.min(2.6, Math.max(0.3, this.zoom * factor));
  }
  centerCameraOnPlayer() {
    this.zoom = 1.0;
  }
  setupWorldEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        if (window.PlayPartyController?.isFollower() || (this.isLandingFlight && this.flightLandingTarget)) return;
        this.keysDown.add(k);
        this.currentPath = null; this.moveTargetX = null; this.moveTargetY = null; this.targetDestX = null; this.targetDestY = null;
      } else if (k === 'v') {
        window.PlayFlightAndWingsController?.toggleFlight(this);
      }
    });
    window.addEventListener('keyup', (e) => { this.keysDown.delete(e.key.toLowerCase()); });
    const canvas = document.getElementById('gameCanvas');
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (window.BattleTransitionController?.isActive) {
        window.BattleTransitionController.skip();
        return;
      }
      if (!this.activeChar || !this.currentMap) return;
      if (window.PlayPartyController?.isFollower() && !this.actionCombatArena?.isActive) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldPt = this.screenToWorld(sx, sy);
      const bounds = this.getMapBounds();
      worldPt.x = Math.max(18, Math.min(bounds.width - 18, worldPt.x));
      worldPt.y = Math.max(20, Math.min(bounds.height - 18, worldPt.y));
      // Em batalha na arena: clique esquerdo seleciona alvo e realiza ataque básico, ou se move pelo chão
      if (this.actionCombatArena?.isActive) {
        if (window.PlayNativeAppController?.handleArenaPointer(this, worldPt)) return;
      }
      // Se o clique foi em um portal, PortalTravelController conduz o herói e abre confirmação
      if (window.PortalTravelController?.handleCanvasClick(this, worldPt)) {
        return;
      }
      // Se o jogador tocar diretamente sobre um NPC e já estiver próximo, abre o modal de Quest/Diálogo
      for (const npc of this.currentMap.npcs || []) {
        const clickDist = Math.hypot(worldPt.x - npc.posX, worldPt.y - (npc.posY - 28));
        const playerDist = Math.hypot(this.playerX - npc.posX, this.playerY - npc.posY);
        if (clickDist <= 42 && playerDist <= 95 && typeof this.openNpcQuestModal === 'function') {
          void this.openNpcQuestModal(npc);
        }
      }
      if (this.isLandingFlight) return;
      this.targetDestX = worldPt.x; this.targetDestY = worldPt.y; this.lastRepathTime = 0;
      if (this.mesh && !this.gmNoClip && !this.isFlying) {
        const path = this.mesh.findPath(this.playerX, this.playerY, worldPt.x, worldPt.y);
        if (path && path.length > 0) {
          this.currentPath = path;
          this.moveTargetX = path[0].x;
          this.moveTargetY = path[0].y;
        } else {
          this.currentPath = null;
          this.moveTargetX = worldPt.x;
          this.moveTargetY = worldPt.y;
        }
      } else {
        this.currentPath = null;
        this.moveTargetX = worldPt.x;
        this.moveTargetY = worldPt.y;
      }
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.changeZoom(e.deltaY < 0 ? 1.12 : 0.89);
      },
      { passive: false }
    );
    canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          this.lastPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      },
      { passive: true }
    );
    canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2 && this.lastPinchDist > 0) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const ratio = dist / this.lastPinchDist;
          this.zoom = Math.min(2.6, Math.max(0.3, this.zoom * ratio));
          this.lastPinchDist = dist;
        }
      },
      { passive: true }
    );
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
    if (this.actionCombatArena?.isActive || this.isEncounterLoading || !this.currentMap || !this.activeChar || now < this.encounterCooldownUntil) return;
    if (this.currentMap.mapType?.code === 'DUNGEON' || !this.currentMap.mapType?.allowMonsterSpawn || this.currentMap.canSpawnMonsters === false) return;
    const rate = Number(this.currentMap.encounterRatePct) || 0;
    if (rate > 0 && Math.random() * 100 < rate) {
      void this.triggerMapEncounter();
    }
  }
  async triggerMapEncounter() {
    if (this.isEncounterLoading || !this.activeChar || !this.currentMap || this.currentMap.mapType?.code === 'DUNGEON' || !this.currentMap.mapType?.allowMonsterSpawn || this.currentMap.canSpawnMonsters === false) return;
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
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const focusX = this.actionCombatArena?.isActive ? this.actionCombatArena.getCamFocusX() : this.playerX;
    const focusY = this.actionCombatArena?.isActive ? this.actionCombatArena.getCamFocusY() : this.playerY;
    const bounds = this.getMapBounds();
    const mapW = bounds.width;
    const mapH = bounds.height;
    let camX = Math.round(canvas.width / 2 - focusX * this.zoom);
    let camY = Math.round(canvas.height / 2 - focusY * this.zoom);
    // LIMITA A CÂMERA À BORDA DO MAPA (Sem jamais mostrar área preta vazia)
    const totalRenderedW = mapW * this.zoom;
    const totalRenderedH = mapH * this.zoom;
    if (totalRenderedW <= canvas.width) {
      camX = Math.round((canvas.width - totalRenderedW) / 2);
    } else {
      const minCamX = Math.round(canvas.width - totalRenderedW);
      camX = Math.max(minCamX, Math.min(0, camX));
    }
    if (totalRenderedH <= canvas.height) {
      camY = Math.round((canvas.height - totalRenderedH) / 2);
    } else {
      const minCamY = Math.round(canvas.height - totalRenderedH);
      camY = Math.max(minCamY, Math.min(0, camY));
    }
    this.camX = camX;
    this.camY = camY;
    ctx.save();
    ctx.translate(camX, camY);
    ctx.scale(this.zoom, this.zoom);
    // 1. Imagem de Fundo Limpa do Mapa (`mcreworkMapImage`)
    if (this.mapBgImage) {
      ctx.drawImage(this.mapBgImage, 0, 0);
    } else {
      ctx.fillStyle = '#0b1120'; ctx.fillRect(0, 0, 2000, 1500);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)'; ctx.lineWidth = 1 / this.zoom;
      for (let x = 0; x <= 2000; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1500); ctx.stroke(); }
      for (let y = 0; y <= 1500; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2000, y); ctx.stroke(); }
      ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🗺️ Carregando imagem do mapa...', this.playerX, this.playerY - 40);
    }
    // 1.1 Barreira Rúnica da Arena no Chão do Mapa Real
    if (this.actionCombatArena?.isActive) {
      this.actionCombatArena.drawArenaRingOnFloor(ctx, now, this.zoom);
    }
    // 2. Se o Modo Raio-X GM estiver ligado, desenha Malhas de Colisão, Sobreposição e Spawn
    if (this.gmXray && this.currentMap) {
      const drawPolyMesh = (list, fill, stroke) => {
        for (const poly of list || []) {
          const pts = poly.points || [];
          if (pts.length < 3) continue;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.lineWidth = 2 / this.zoom;
          ctx.strokeStyle = stroke;
          ctx.stroke();
        }
      };
      drawPolyMesh(this.currentMap.collisionMeshJson, 'rgba(239, 68, 68, 0.30)', '#ef4444');
      drawPolyMesh(this.currentMap.overlapMeshJson, 'rgba(56, 189, 248, 0.28)', '#38bdf8');
      ctx.beginPath();
      ctx.arc(this.currentMap.spawnX, this.currentMap.spawnY, 32, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.35)'; ctx.fill();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5 / this.zoom; ctx.stroke();
      ctx.fillStyle = '#fef08a'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`⭐ SPAWN (${this.currentMap.spawnX}, ${this.currentMap.spawnY})`, this.currentMap.spawnX - 50, this.currentMap.spawnY - 38);
    }
    // 3. Desenha Portais Pareados (`map_portals`) com anel energético pulsante (ocultos na arena de combate)
    if (!this.actionCombatArena?.isActive) {
      const pulse = 0.85 + 0.15 * Math.sin(now / 220);
      for (const p of this.currentMap.portals || []) {
        const r = (Number(p.triggerRadius) || 48) * pulse;
        const isLinked = Boolean(p.targetMapId);
        ctx.beginPath();
        ctx.ellipse(p.sourceX, p.sourceY, r, r * 0.65, 0, 0, Math.PI * 2);
        ctx.fillStyle = isLinked ? 'rgba(168, 85, 247, 0.32)' : 'rgba(148, 163, 184, 0.25)'; ctx.fill();
        ctx.lineWidth = 3 / this.zoom; ctx.strokeStyle = isLinked ? '#c084fc' : '#94a3b8'; ctx.stroke();
        ctx.fillStyle = '#f3e8ff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`🌀 ${p.label}${p.targetMapNamePtBr ? ` ➔ ${p.targetMapNamePtBr}` : ''}`, p.sourceX, p.sourceY - r * 0.65 - 8);
      }
    }
    // 4. Indicador de destino do clique no chão
    const destX = this.targetDestX !== null ? this.targetDestX : ((this.currentPath && this.currentPath.length > 0) ? this.currentPath[this.currentPath.length - 1].x : this.moveTargetX);
    const destY = this.targetDestY !== null ? this.targetDestY : ((this.currentPath && this.currentPath.length > 0) ? this.currentPath[this.currentPath.length - 1].y : this.moveTargetY);
    if (destX !== null && destY !== null) {
      ctx.beginPath(); ctx.arc(destX, destY, 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5 / this.zoom; ctx.stroke();
    }
    // 4.5. Halo Rúnico no Piso de Level Up (desenhado sob os pés do personagem)
    if (this.levelUpVfx) this.levelUpVfx.renderWorldFloor(ctx, now, this.zoom);
    // 5. Ordenação de Profundidade 2.5D (Y-Sorting com Pooling Zero-Alloc)
    for (let i = 0; i < this._renderQueue.length; i++) this._renderPool.push(this._renderQueue[i]);
    this._renderQueue.length = 0;
    if (this.actionCombatArena?.isActive) {
      this.actionCombatArena.populateRenderQueue(this._renderQueue, now);
    } else {
      for (const npc of this.currentMap.npcs || []) this.pushRenderItem('NPC', npc.posY, npc);
      if (window.PlayMapPresenceController) window.PlayMapPresenceController.populateRenderQueue(this._renderQueue, now);
      if (window.PlayPetsController) window.PlayPetsController.populateRenderQueue(this, this._renderQueue);
      if (this.activeChar) this.pushRenderItem('PLAYER', (this.isFlying || (this.flightAltitudeCurrent || 0) > 2) ? (this.playerY + 100000) : this.playerY, this.activeChar);
    }
    this._renderQueue.sort((a, b) => a.y - b.y);
    for (const item of this._renderQueue) {
      if (item.type === 'NPC') {
        const npc = item.data;
        const sprite = this.getOrCreateSprite(`npc_${npc.mcreworkNpcKey}`, npc.atlasJsonUrl, npc.atlasWebpUrl, npc.thumbUrl);
        sprite.draw(ctx, npc.posX, npc.posY, 0, npc.direction || 0, now, this.mesh);
        ctx.fillStyle = '#86efac'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(npc.namePtBr, npc.posX, npc.posY - 62);
        if (typeof this.drawNpcQuestHeadIcon === 'function') this.drawNpcQuestHeadIcon(ctx, npc, now);
      } else if (item.type === 'PET_FOLLOWER') {
        if (window.PlayPetsController) window.PlayPetsController.drawFollowerPet(this, ctx, item.data, now);
      } else if (item.type === 'PLAYER') {
        const char = item.data;
        const sprite = this.getOrCreateSprite(`char_${char.mcreworkCharKey}`, char.atlasJsonUrl, char.atlasWebpUrl, char.thumbUrl);
        const groundOffsetY = char.groundOffsetY || 0;
        let nameY = this.playerY - 66 + Math.round(groundOffsetY * 0.70);
        if (window.PlayFlightAndWingsController) {
          nameY = window.PlayFlightAndWingsController.drawPlayerWithCosmetics(ctx, {
            client: this, charSprite: sprite, worldX: this.playerX, worldY: this.playerY,
            action: this.isMoving ? 1 : 0, dir: this.playerDir, now, mesh: this.mesh,
            groundOffsetY, shadowOffsetX: char.shadowOffsetX || 0, shadowOffsetY: char.shadowOffsetY || 0,
            wingsObj: char.visualAppearance?.equippedWings || null, mountObj: char.visualAppearance?.equippedMount || null,
            followerPet: window.PlayPetsController?.getPrimaryFollowerPet?.() || null,
            isFlying: Boolean(this.isFlying), flightAltitude: Number(this.flightAltitudeCurrent) || 0, customScale: 0.70,
          });
        } else {
          sprite.draw(ctx, this.playerX, this.playerY, this.isMoving ? 1 : 0, this.playerDir, now, this.mesh, groundOffsetY, 0.70, false, char.shadowOffsetX || 0, char.shadowOffsetY || 0);
        }
        ctx.textAlign = 'center';
        if (window.PlayPartyController?.isLeader()) { ctx.font = '14px sans-serif'; ctx.fillText('👑', this.playerX, nameY - 14); }
        if (window.PlayPartyController?.hasParty()) { ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = '#38bdf8'; ctx.fillText('[Equipe]', this.playerX, nameY - 3); }
        ctx.fillStyle = '#fde047'; ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`${char.name}${char.isReborn ? ' ✨' : ''}${this.gmNoClip ? ' [NO-CLIP]' : ''}`, this.playerX, nameY);
      } else if (item.type === 'OTHER_PLAYER') {
        window.PlayMapPresenceController?.drawOtherPlayer(ctx, item.data, now, this.mesh, this.zoom);
      } else if (item.type === 'COMBAT_PLAYER') {
        const p = item.data;
        const isTransient = (p.action === 3 || p.action === 5 || p.action === 6 || p.action === 7);
        const elapsed = (isTransient && p.actionStartTime) ? (now - p.actionStartTime) : now;
        if (window.PlayFlightAndWingsController && p.sprite) {
          window.PlayFlightAndWingsController.drawPlayerWithCosmetics(ctx, {
            client: this, charSprite: p.sprite, worldX: p.x, worldY: p.y,
            action: p.action, dir: p.dir, now: elapsed, mesh: this.mesh,
            groundOffsetY: p.groundOffsetY || 0, shadowOffsetX: p.shadowOffsetX || 0, shadowOffsetY: p.shadowOffsetY || 0,
            wingsObj: p.equippedWings || null, mountObj: null, isFlying: false, flightAltitude: 0, customScale: 0.70,
          });
        } else if (p.sprite) {
          p.sprite.draw(ctx, p.x, p.y, p.action, p.dir, elapsed, this.mesh, p.groundOffsetY || 0, 0.70, false, p.shadowOffsetX || 0, p.shadowOffsetY || 0);
        }
        if (p.isAlive) {
          const bw = 54, bh = 5, bx = p.x - bw / 2, by = p.y - 62 + Math.round((p.groundOffsetY || 0) * 0.70);
          ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
          ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
          const hpRatio = Math.max(0, Math.min(1, p.hp / (p.maxHp || 1)));
          ctx.fillStyle = (hpRatio < 0.35) ? '#ef4444' : '#22c55e';
          ctx.fillRect(bx, by, Math.round(bw * hpRatio), bh);
          const mpy = by + bh + 1;
          ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
          ctx.fillRect(bx - 1, mpy - 1, bw + 2, 5);
          const mpRatio = Math.max(0, Math.min(1, (p.mp || 0) / (p.maxMp || 1)));
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(bx, mpy, Math.round(bw * mpRatio), 3.5);
          ctx.fillStyle = '#fde047'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(p.name, p.x, by - 4);
          this.actionCombatArena?.vfxRenderer?.drawUnitOverlays(ctx, p, by - 14, now);
        }
      } else if (item.type === 'COMBAT_MONSTER' || item.type === 'COMBAT_PET') {
        const ent = item.data;
        const isPet = item.type === 'COMBAT_PET';
        const vTier = !isPet ? (ent.variantTier || 'NORMAL') : 'NORMAL';
        const mScale = !isPet ? (Number(ent.modelScale) || 1.0) : 1.0;
        ctx.save();
        ctx.globalAlpha = ent.fadeAlpha;
        if (!isPet && ent.isAlive && (vTier === 'LEADER' || vTier === 'BOSS')) {
          const auraR = Math.round(24 * mScale * (0.92 + 0.08 * Math.sin(now / 180)));
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(ent.x, ent.y, auraR, Math.round(auraR * 0.52), 0, 0, Math.PI * 2);
          ctx.fillStyle = vTier === 'BOSS' ? 'rgba(244, 63, 94, 0.28)' : 'rgba(56, 189, 248, 0.22)';
          ctx.fill();
          ctx.strokeStyle = vTier === 'BOSS' ? '#fb7185' : '#38bdf8';
          ctx.lineWidth = vTier === 'BOSS' ? 2.4 : 1.8;
          ctx.stroke();
          ctx.restore();
        }
        if (ent.sprite) {
          const isTransient = (ent.action === 3 || ent.action === 5 || ent.action === 6 || ent.action === 7);
          const elapsed = (isTransient && ent.actionStartTime) ? (now - ent.actionStartTime) : now;
          ent.sprite.draw(ctx, ent.x, ent.y, ent.action, ent.dir, elapsed, this.mesh, ent.groundOffsetY || 0, (isPet ? 0.62 : 0.70) * mScale, ent.action === 6, ent.shadowOffsetX || 0, ent.shadowOffsetY || 0);
        }
        if (ent.isAlive) {
          const isTarget = !isPet && (this.actionCombatArena?.selectedTargetMob === ent);
          const bw = isPet ? 46 : (vTier === 'BOSS' ? 76 : vTier === 'LEADER' ? 62 : (isTarget ? 58 : 50));
          const bh = vTier === 'BOSS' ? 7 : (isTarget || vTier === 'LEADER' ? 6 : 5);
          const bx = ent.x - bw / 2, by = ent.y - Math.round((isPet ? 60 : 68) * mScale);
          ctx.fillStyle = 'rgba(2, 6, 23, 0.85)'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
          if (isTarget || vTier === 'BOSS' || vTier === 'LEADER') {
            ctx.strokeStyle = isTarget ? '#f59e0b' : (vTier === 'BOSS' ? '#fb7185' : '#38bdf8');
            ctx.lineWidth = 1.8; ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);
          }
          const hpRatio = Math.max(0, Math.min(1, ent.hp / ent.maxHp));
          ctx.fillStyle = isPet ? (hpRatio < 0.35 ? '#ef4444' : '#22c55e') : (vTier === 'BOSS' ? '#e11d48' : vTier === 'LEADER' ? '#0ea5e9' : (isTarget ? '#fbbf24' : '#ef4444'));
          ctx.fillRect(bx, by, bw * hpRatio, bh);
          if (isPet) {
            const mpy = by + bh + 1;
            const mpRatio = Math.max(0, Math.min(1, (ent.mp || 0) / (ent.maxMp || 200)));
            ctx.fillStyle = 'rgba(2, 6, 23, 0.85)'; ctx.fillRect(bx - 1, mpy - 1, bw + 2, 4.5);
            ctx.fillStyle = '#38bdf8'; ctx.fillRect(bx, mpy, bw * mpRatio, 3);
          }
          ctx.font = vTier === 'BOSS' ? 'bold 13px sans-serif' : (isTarget || vTier === 'LEADER' ? 'bold 12px sans-serif' : 'bold 11px sans-serif');
          ctx.textAlign = 'center';
          ctx.fillStyle = isPet ? '#bae6fd' : (vTier !== 'NORMAL' ? (ent.nameColorHex || '#38bdf8') : (isTarget ? '#fde047' : '#f8fafc'));
          ctx.fillText(isTarget ? `🎯 ${ent.name} (Nv.${ent.level})` : (isPet ? `🐾 ${ent.name}` : `${ent.name} (Nv.${ent.level})`), ent.x, by - 5);
          if (isTarget) this.actionCombatArena?.vfxRenderer?.drawMonsterTargetOverlays(ctx, ent, by, now);
          this.actionCombatArena?.vfxRenderer?.drawUnitOverlays(ctx, ent, by - 14, now);
        }
        ctx.restore();
      }
    }
    // 6. VFX Animados & Textos Flutuantes da Arena de Combate
    if (this.actionCombatArena?.isActive) {
      this.actionCombatArena.renderActiveVfx(ctx, now);
      this.actionCombatArena.renderFloatingTexts(ctx);
    }
    window.PlayFlightAndWingsController?.drawWorldMistParticles(ctx);
    if (this.levelUpVfx) this.levelUpVfx.renderWorldAir(ctx, now, this.zoom);
    if (window.PortalTravelController?.hasActiveVfx) window.PortalTravelController.renderWorldVfx(ctx, now, this.zoom);
    ctx.restore();
    if (window.BattleTransitionController?.isActive) window.BattleTransitionController.render(ctx, now, canvas);
    if (window.PlayHudController && (!this._lastMinimapUpdate || now - this._lastMinimapUpdate > 90)) {
      this._lastMinimapUpdate = now;
      window.PlayHudController.updateMinimap(this.currentMap, this.mapBgImage, this.playerX, this.playerY, this.playerDir);
    }
  }
}
window.PlayApp = new EtheriaPlayClient();
