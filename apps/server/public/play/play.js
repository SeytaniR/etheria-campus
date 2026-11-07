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
    this.keysDown = new Set();
    this.dpadDx = 0;
    this.dpadDy = 0;
    this.baseMoveSpeed = 168; // pixels por segundo (reduzido em 20% do valor anterior de 210)

    // Câmera do Mundo
    this.zoom = 1.0;
    this.lastPinchDist = 0;

    // Cooldown de Portal e Sincronização com o Servidor
    this.portalCooldownUntil = 0;
    this.lastSyncedX = 0;
    this.lastSyncedY = 0;
    this.lastSyncTime = 0;

    // Estado do Painel GM Integrado (`/gm`)
    this.gmXray = false;
    this.gmNoClip = false;
    this.gmSpeedMultiplier = 1;

    // Vincula módulos externos (Painel GM e Ficha Procedural)
    if (window.PlayGmController) {
      window.PlayGmController.attach(this);
    }

    this.lastFrameTime = performance.now();
    this.init();
  }

  async init() {
    this.setupWorldEvents();
    requestAnimationFrame((t) => this.gameLoop(t));

    if (this.token) {
      try {
        await this.loadPlayBootstrap();
        this.showLobby();
        return;
      } catch {
        // Se o token antigo expirou, mostra tela de login
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
    this.mapsList = data.maps || [];
    this.myCharacters = data.characters || [];

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

  renderLobby() {
    if (this.session) {
      document.getElementById('lobbyUserBadge').textContent = `👤 ${this.session.username} (${this.session.role})`;
    }

    const myCharsContainer = document.getElementById('myCharactersList');
    if (this.myCharacters.length === 0) {
      myCharsContainer.innerHTML = `
        <div style="color:var(--text-muted); font-size:0.84rem; padding:12px; border:1px dashed var(--border); border-radius:8px;">
          Você ainda não possui nenhum personagem criado. Crie seu primeiro personagem no painel ao lado!
        </div>`;
    } else {
      myCharsContainer.innerHTML = this.myCharacters
        .map((c) => {
          const el = this.getElementStyle(c.elementCode);
          return `
        <div class="char-card">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${c.thumbUrl}" alt="${c.name}" style="width:56px; height:56px; object-fit:contain; background:#020617; border-radius:8px; border:1px solid var(--border);" />
            <div>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <strong style="font-size:0.95rem; color:#fde047;">${c.name}</strong>
                <span style="font-size:0.74rem; padding:2px 7px; border-radius:99px; background:${el.bg}; color:${el.color}; font-weight:700;">
                  ${el.icon} ${c.elementNamePtBr}
                </span>
              </div>
              <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
                Nv.${c.level} &bull; ${c.classNamePtBr} (${c.classCode})
              </div>
              <div style="font-size:0.74rem; color:#86efac; margin-top:2px;">
                📍 ${c.currentMapNamePtBr} (${Math.round(c.posX)}, ${Math.round(c.posY)})
              </div>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn-primary" onclick="PlayApp.enterWorldWithCharacter(${c.id})">▶️ Jogar</button>
            <button class="btn-danger" onclick="PlayApp.deleteCharacter(${c.id})" title="Excluir Personagem">🗑️</button>
          </div>
        </div>`;
        })
        .join('');
    }

    const classesGrid = document.getElementById('lobbyClassesGrid');
    if (this.classTemplates.length === 0) {
      classesGrid.innerHTML = `
        <div style="grid-column: 1 / -1; color:#fde68a; font-size:0.82rem; padding:12px; background:rgba(245,158,11,0.12); border:1px solid var(--accent-amber); border-radius:8px;">
          ⚠️ <strong>Nenhuma Classe cadastrada na tabela <code>class_templates</code> ainda!</strong><br/>
          Abra a aba <strong>"🦸 Personagens"</strong> na rota <code>/admin</code> para cadastrar seu primeiro personagem do <code>mcrework</code>!
          <div style="margin-top:8px;">
            <button class="btn-amber" onclick="window.location.href='/admin'">🛠️ Ir para /admin (Aba 🦸 Personagens)</button>
          </div>
        </div>`;
    } else {
      classesGrid.innerHTML = this.classTemplates
        .map((ct) => {
          const isSel = ct.id === this.selectedClassIdForCreation ? 'selected' : '';
          return `
        <div class="class-card ${isSel}" onclick="PlayApp.selectClassForCreation(${ct.id})">
          <img src="${ct.thumbUrl}" alt="${ct.namePtBr}" />
          <strong style="font-size:0.8rem;">${ct.namePtBr}</strong>
          <span style="font-size:0.7rem; color:var(--accent);">${ct.code} &bull; ${ct.raceNamePtBr}</span>
        </div>`;
        })
        .join('');
    }
  }

  selectClassForCreation(classId) {
    this.selectedClassIdForCreation = Number(classId);
    this.renderLobby();
  }

  async createCharacter() {
    const name = document.getElementById('newCharName').value.trim();
    if (!name) {
      alert('Digite o nome do seu personagem.');
      return;
    }
    if (!this.selectedClassIdForCreation) {
      alert('Cadastre e selecione primeiro uma Classe/Personagem da tabela class_templates.');
      return;
    }

    try {
      const created = await this.api('/api/play/characters', {
        method: 'POST',
        body: JSON.stringify({
          name,
          classTemplateId: this.selectedClassIdForCreation,
        }),
      });
      document.getElementById('newCharName').value = '';
      await this.loadPlayBootstrap();
      const el = this.getElementStyle(created.elementCode);
      alert(
        `🎉 Personagem "${created.name}" criado com sucesso!\n\n🎲 Elemento Inicial Sorteado: ${el.icon} ${created.elementNamePtBr}\n📍 Posicionado no Spawn Inicial: (${created.posX}, ${created.posY})`
      );
      await this.enterWorldWithCharacter(created.id);
    } catch (err) {
      alert(`Erro ao criar personagem: ${err.message}`);
    }
  }

  async deleteCharacter(charId) {
    if (!confirm('Tem certeza que deseja excluir este personagem?')) return;
    try {
      await this.api(`/api/play/characters/${charId}`, { method: 'DELETE' });
      await this.loadPlayBootstrap();
    } catch (err) {
      alert(`Erro ao excluir personagem: ${err.message}`);
    }
  }

  // ==========================================================================
  // ENTRADA NO MUNDO 2.5D E CARREGAMENTO DE MAPAS
  // ==========================================================================

  async enterWorldWithCharacter(charId) {
    const found = this.myCharacters.find((c) => c.id === Number(charId));
    if (!found) return;

    this.activeChar = found;
    this.playerX = Number(found.posX) || 500;
    this.playerY = Number(found.posY) || 500;
    this.moveTargetX = null;
    this.moveTargetY = null;

    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('worldScreen').style.display = 'block';

    // Exibe botão do Painel GM para contas ADMIN ou GM
    const isGmOrAdmin = this.session && (this.session.role === 'ADMIN' || this.session.role === 'GM');
    document.getElementById('btnToggleGm').style.display = isGmOrAdmin ? 'inline-block' : 'none';
    if (isGmOrAdmin && window.location.pathname.startsWith('/gm')) {
      const gmDrawer = document.getElementById('gmDrawer');
      if (gmDrawer) gmDrawer.classList.add('open');
    }

    this.resizeCanvas();
    await this.loadMapIntoWorld(found.currentMapId || 1, this.playerX, this.playerY);
  }

  backToLobby() {
    this.activeChar = null;
    document.getElementById('worldScreen').style.display = 'none';
    this.loadPlayBootstrap().then(() => this.showLobby());
  }

  getOrCreateSprite(key, atlasJsonUrl, atlasWebpUrl, thumbUrl) {
    if (!this.spriteCache.has(key)) {
      this.spriteCache.set(key, new McreworkSpriteSheet(atlasJsonUrl, atlasWebpUrl, thumbUrl));
    }
    return this.spriteCache.get(key);
  }

  async loadMapIntoWorld(mapId, startX, startY) {
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
      this.moveTargetX = null;
      this.moveTargetY = null;
      this.portalCooldownUntil = performance.now() + 1800;

      // Carrega a imagem base limpa do mapa via proxy local ou remoto com fallback automático
      let rawBg = (mapData.bgImageUrl || mapData.mcreworkMapImage || '').trim();
      let finalBgUrl = rawBg;
      if (!finalBgUrl.startsWith('http://') && !finalBgUrl.startsWith('https://')) {
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
    } catch (err) {
      alert(`Erro ao carregar mapa #${mapId}: ${err.message}`);
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
    document.getElementById('hudMapRules').textContent = `${mt.namePtBr || ''} • ${pvpLabels[mt.pvpRule] || ''} • ${
      mt.allowMonsterSpawn ? '👹 Spawna Monstros' : '🕊️ Zona Segura'
    }`;
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
    this.dpadDx = dx;
    this.dpadDy = dy;
    if (dx !== 0 || dy !== 0) {
      this.moveTargetX = null;
      this.moveTargetY = null;
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
        this.keysDown.add(k);
        this.moveTargetX = null;
        this.moveTargetY = null;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.key.toLowerCase());
    });

    const canvas = document.getElementById('gameCanvas');

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!this.activeChar || !this.currentMap) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldPt = this.screenToWorld(sx, sy);
      this.moveTargetX = worldPt.x;
      this.moveTargetY = worldPt.y;
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
    const camX = canvas.width / 2 - this.playerX * this.zoom;
    const camY = canvas.height / 2 - this.playerY * this.zoom;
    return {
      x: Math.round((sx - camX) / this.zoom),
      y: Math.round((sy - camY) / this.zoom),
    };
  }

  gameLoop(now) {
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (this.activeChar && this.currentMap) {
      this.updatePhysics(dt, now);
      this.renderWorld(now);
    }

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  updatePhysics(dt, now) {
    let vx = this.dpadDx;
    let vy = this.dpadDy;

    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) vy -= 1;
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) vy += 1;
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) vx -= 1;
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) vx += 1;

    if (vx === 0 && vy === 0 && this.moveTargetX !== null && this.moveTargetY !== null) {
      const dx = this.moveTargetX - this.playerX;
      const dy = this.moveTargetY - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= 6) {
        this.moveTargetX = null;
        this.moveTargetY = null;
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
      const speed = this.baseMoveSpeed * this.gmSpeedMultiplier;
      const nextX = this.playerX + vx * speed * dt;
      const nextY = this.playerY + vy * speed * dt;

      if (this.gmNoClip || !this.mesh) {
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
          // Bateu em parede frontal durante movimento por clique
          this.moveTargetX = null;
          this.moveTargetY = null;
        }
      }

      document.getElementById('hudCoords').textContent = `X:${Math.round(this.playerX)} Y:${Math.round(this.playerY)}`;
    } else {
      this.isMoving = false;
    }

    this.checkPortalsAndNpcs(now);
    this.syncPositionPeriodically(now);
  }

  checkPortalsAndNpcs(now) {
    const prompt = document.getElementById('interactionPrompt');
    const textEl = document.getElementById('interactionText');
    const btnEl = document.getElementById('interactionBtn');

    if (!this.currentMap) {
      prompt.style.display = 'none';
      return;
    }

    // 1. Verifica proximidade de Portais Pareados
    for (const p of this.currentMap.portals || []) {
      const dist = Math.hypot(this.playerX - p.sourceX, this.playerY - p.sourceY);
      const radius = Number(p.triggerRadius) || 48;
      if (dist <= radius + 14) {
        prompt.style.display = 'flex';
        const destLabel = p.targetMapNamePtBr
          ? `Ir para ${p.targetMapNamePtBr} (${p.targetX}, ${p.targetY})`
          : 'Sem portal par vinculado ainda';
        textEl.textContent = `🌀 ${p.label}`;
        btnEl.textContent = destLabel;
        btnEl.onclick = () => this.traversePortal(p.id);

        // Travessia automática ao pisar no núcleo do portal (se já passou o cooldown de saída)
        if (dist <= radius * 0.7 && p.targetMapId && now > this.portalCooldownUntil) {
          this.portalCooldownUntil = now + 2500;
          void this.traversePortal(p.id);
        }
        return;
      }
    }

    // 2. Verifica proximidade de NPCs Interativos
    for (const n of this.currentMap.npcs || []) {
      const dist = Math.hypot(this.playerX - n.posX, this.playerY - n.posY);
      if (dist <= 68) {
        prompt.style.display = 'flex';
        const trig = Array.isArray(n.triggersJson) && n.triggersJson[0]?.type;
        const trigLabel = n.isDecorationOnly ? 'Enfeite' : trig || 'Interagir';
        textEl.textContent = `🧙 ${n.namePtBr}`;
        btnEl.textContent = `💬 ${trigLabel}`;
        btnEl.onclick = () => {
          alert(`🧙 ${n.namePtBr} (${n.code})\nFunção configurada: ${trigLabel}`);
        };
        return;
      }
    }

    prompt.style.display = 'none';
  }

  async traversePortal(portalId) {
    if (!this.activeChar) return;
    try {
      const res = await this.api(`/api/play/characters/${this.activeChar.id}/traverse-portal`, {
        method: 'POST',
        body: JSON.stringify({ portalId }),
      });
      this.activeChar.currentMapId = res.currentMapId;
      this.activeChar.posX = res.posX;
      this.activeChar.posY = res.posY;
      await this.loadMapIntoWorld(res.currentMapId, res.posX, res.posY);
    } catch (err) {
      alert(`🌀 Portal: ${err.message}`);
    }
  }

  syncPositionPeriodically(now) {
    if (!this.activeChar || !this.currentMap) return;
    if (now - this.lastSyncTime < 1500) return;

    const dist = Math.hypot(this.playerX - this.lastSyncedX, this.playerY - this.lastSyncedY);
    if (dist < 8) return;

    this.lastSyncTime = now;
    this.lastSyncedX = this.playerX;
    this.lastSyncedY = this.playerY;

    void this.api(`/api/play/characters/${this.activeChar.id}/sync-position`, {
      method: 'POST',
      body: JSON.stringify({
        mapId: this.currentMap.id,
        posX: Math.round(this.playerX),
        posY: Math.round(this.playerY),
        noClip: this.gmNoClip,
      }),
    }).catch(() => {});
  }

  renderWorld(now) {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const camX = Math.round(canvas.width / 2 - this.playerX * this.zoom);
    const camY = Math.round(canvas.height / 2 - this.playerY * this.zoom);

    ctx.save();
    ctx.translate(camX, camY);
    ctx.scale(this.zoom, this.zoom);

    // 1. Imagem de Fundo Limpa do Mapa (`mcreworkMapImage`)
    if (this.mapBgImage) {
      ctx.drawImage(this.mapBgImage, 0, 0);
    } else {
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, 2000, 1500);

      // Grade sutil isométrica do chão para feedback espacial imediato
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1 / this.zoom;
      const step = 64;
      for (let x = 0; x <= 2000; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1500);
        ctx.stroke();
      }
      for (let y = 0; y <= 1500; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(2000, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🗺️ Carregando imagem do mapa...', this.playerX, this.playerY - 40);
    }

    // 2. Se o Modo Raio-X GM estiver ligado, desenha Malhas de Colisão, Sobreposição e Spawn
    if (this.gmXray && this.currentMap) {
      for (const poly of this.currentMap.collisionMeshJson || []) {
        const pts = poly.points || [];
        if (pts.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.30)';
        ctx.fill();
        ctx.lineWidth = 2 / this.zoom;
        ctx.strokeStyle = '#ef4444';
        ctx.stroke();
      }

      for (const poly of this.currentMap.overlapMeshJson || []) {
        const pts = poly.points || [];
        if (pts.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.fill();
        ctx.lineWidth = 2 / this.zoom;
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();
      }

      // Marcador do Ponto de Spawn do Mapa
      ctx.beginPath();
      ctx.arc(this.currentMap.spawnX, this.currentMap.spawnY, 32, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5 / this.zoom;
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(
        `⭐ SPAWN (${this.currentMap.spawnX}, ${this.currentMap.spawnY})`,
        this.currentMap.spawnX - 50,
        this.currentMap.spawnY - 38
      );
    }

    // 3. Desenha Portais Pareados (`map_portals`) com anel energético pulsante
    const pulse = 0.85 + 0.15 * Math.sin(now / 220);
    for (const p of this.currentMap.portals || []) {
      const r = (Number(p.triggerRadius) || 48) * pulse;
      const isLinked = Boolean(p.targetMapId);

      ctx.beginPath();
      ctx.ellipse(p.sourceX, p.sourceY, r, r * 0.65, 0, 0, Math.PI * 2);
      ctx.fillStyle = isLinked ? 'rgba(168, 85, 247, 0.32)' : 'rgba(148, 163, 184, 0.25)';
      ctx.fill();
      ctx.lineWidth = 3 / this.zoom;
      ctx.strokeStyle = isLinked ? '#c084fc' : '#94a3b8';
      ctx.stroke();

      ctx.fillStyle = '#f3e8ff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `🌀 ${p.label}${p.targetMapNamePtBr ? ` ➔ ${p.targetMapNamePtBr}` : ''}`,
        p.sourceX,
        p.sourceY - r * 0.65 - 8
      );
    }

    // 4. Indicador de destino do clique no chão
    if (this.moveTargetX !== null && this.moveTargetY !== null) {
      ctx.beginPath();
      ctx.arc(this.moveTargetX, this.moveTargetY, 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5 / this.zoom;
      ctx.stroke();
    }

    // 5. Ordenação de Profundidade 2.5D (Y-Sorting entre Personagem do Jogador e NPCs)
    const renderQueue = [];

    for (const npc of this.currentMap.npcs || []) {
      renderQueue.push({
        type: 'NPC',
        y: npc.posY,
        data: npc,
      });
    }

    if (this.activeChar) {
      renderQueue.push({
        type: 'PLAYER',
        y: this.playerY,
        data: this.activeChar,
      });
    }

    renderQueue.sort((a, b) => a.y - b.y);

    for (const item of renderQueue) {
      if (item.type === 'NPC') {
        const npc = item.data;
        const sprite = this.getOrCreateSprite(
          `npc_${npc.mcreworkNpcKey}`,
          npc.atlasJsonUrl,
          npc.atlasWebpUrl,
          npc.thumbUrl
        );
        sprite.draw(ctx, npc.posX, npc.posY, 0, npc.direction || 0, now, this.mesh);

        ctx.fillStyle = '#86efac';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        // Altura do nome calibrada com a redução de 30% do sprite (offset -62)
        ctx.fillText(npc.namePtBr, npc.posX, npc.posY - 62);
      } else {
        const char = item.data;
        const sprite = this.getOrCreateSprite(
          `char_${char.mcreworkCharKey}`,
          char.atlasJsonUrl,
          char.atlasWebpUrl,
          char.thumbUrl
        );
        const action = this.isMoving ? 1 : 0;
        const groundOffsetY = char.groundOffsetY || 0;
        sprite.draw(ctx, this.playerX, this.playerY, action, this.playerDir, now, this.mesh, groundOffsetY);

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        // Altura do nome calibrada com a redução de 30% do sprite (offset -66) acompanhando o ajuste dos pés ao chão
        const nameY = this.playerY - 66 + Math.round(groundOffsetY * 0.70);
        ctx.fillText(
          `${char.name}${char.isReborn ? ' ✨' : ''}${this.gmNoClip ? ' [NO-CLIP]' : ''}`,
          this.playerX,
          nameY
        );
      }
    }

    ctx.restore();
  }
}

window.PlayApp = new EtheriaPlayClient();
