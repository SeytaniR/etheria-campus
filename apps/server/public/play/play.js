/**
 * @file apps/server/public/play/play.js
 * @module @etheria/server
 * @description Motor Cliente Orientado a Objetos da Rota dos Jogadores (`/play`) e Painel GM (`/gm`).
 *   Implementa:
 *   1. Carregador e Animador 8-Direções de Atlas de Sprites do `mcrework` (`McreworkSpriteSheet`) para Personagens e NPCs.
 *   2. Malha Poligonal de Colisão e Sobreposição com AABB Pre-Culling + Ray-Casting (`ClientPolygonMesh`).
 *   3. Exploração 2.5D em Tempo Real (Clique/Toque no Mapa, Teclado WASD/Setas, D-Pad Mobile e Zoom Pinça).
 *   4. Travessia de Portais Pareados (`Entrada <-> Saída`), Função `🆘 Destravar Personagem` (Spawn) e Ficha Procedural.
 *   5. Painel `/gm` Integrado (`⚡ Painel GM`): Teleporte 1-clique para qualquer mapa, Raio-X de Malhas/Portais/Spawn,
 *      No-Clip (atravessar paredes), Multiplicador de Velocidade GM e Hot-Reload do Mapa.
 */

class ClientPolygonMesh {
  constructor(collisionPolygons = [], overlapPolygons = [], overlapOpacity = 0.45) {
    this.collisionPolygons = this.compileBounds(collisionPolygons);
    this.overlapPolygons = this.compileBounds(overlapPolygons);
    this.overlapOpacity = Math.max(0.1, Math.min(1.0, Number(overlapOpacity) || 0.45));
  }

  compileBounds(polygons) {
    if (!Array.isArray(polygons)) return [];
    const compiled = [];
    for (const poly of polygons) {
      const pts = poly?.points;
      if (!Array.isArray(pts) || pts.length < 3) continue;
      let minX = pts[0].x;
      let maxX = pts[0].x;
      let minY = pts[0].y;
      let maxY = pts[0].y;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      compiled.push({
        id: poly.id,
        name: poly.name,
        points: pts,
        minX,
        maxX,
        minY,
        maxY,
      });
    }
    return compiled;
  }

  static isPointInCompiledPolygon(x, y, poly) {
    if (x < poly.minX || x > poly.maxX || y < poly.minY || y > poly.maxY) {
      return false;
    }
    const pts = poly.points;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x;
      const yi = pts[i].y;
      const xj = pts[j].x;
      const yj = pts[j].y;
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  isPointBlocked(x, y) {
    for (let i = 0; i < this.collisionPolygons.length; i++) {
      if (ClientPolygonMesh.isPointInCompiledPolygon(x, y, this.collisionPolygons[i])) {
        return true;
      }
    }
    return false;
  }

  getCharacterOpacityAt(x, y) {
    for (let i = 0; i < this.overlapPolygons.length; i++) {
      if (ClientPolygonMesh.isPointInCompiledPolygon(x, y, this.overlapPolygons[i])) {
        return this.overlapOpacity;
      }
    }
    return 1.0;
  }
}

/**
 * Carrega e renderiza um Sprite Atlas (`atlas.json` + `atlas.webp`) do `mcrework` com suporte a 8 direções.
 */
class McreworkSpriteSheet {
  constructor(atlasJsonUrl, atlasWebpUrl, thumbUrl) {
    this.atlasJsonUrl = atlasJsonUrl;
    this.atlasWebpUrl = atlasWebpUrl;
    this.thumbUrl = thumbUrl;
    this.atlasData = null;
    this.image = null;
    this.thumbImage = null;
    this.ready = false;
    this.loading = false;
  }

  load() {
    if (this.loading || this.ready) return;
    this.loading = true;

    if (this.thumbUrl) {
      const tImg = new Image();
      tImg.crossOrigin = 'anonymous';
      tImg.onload = () => {
        this.thumbImage = tImg;
      };
      tImg.src = this.thumbUrl;
    }

    fetch(this.atlasJsonUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        this.atlasData = json;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.image = img;
          this.ready = true;
        };
        img.src = this.atlasWebpUrl;
      })
      .catch(() => {
        this.loading = false;
      });
  }

  draw(ctx, worldX, worldY, action, direction, elapsedMs, alpha = 1.0) {
    this.load();

    ctx.save();
    ctx.globalAlpha = alpha;

    // Sombra elíptica nos pés da entidade
    ctx.beginPath();
    ctx.ellipse(worldX, worldY, 18, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    if (this.ready && this.atlasData && this.image) {
      const anims = this.atlasData.animations || {};
      const frames = this.atlasData.frames || {};
      const dir = ((direction % 8) + 8) % 8;

      // No mcrework, a chave da animação é `${dir}-${action}`
      // Ações: 0 = Parado (Stand), 1 = Caminhada (Walk), 2 = Corrida (Run), 3 = Golpe (Atk)...
      const primaryKey = `${dir}-${action}`;
      let seq =
        anims[primaryKey] ||
        (action !== 0 ? anims[`${dir}-1`] : null) ||
        anims[`${dir}-0`] ||
        anims[`0-${action}`] ||
        anims['0-0'] ||
        Object.values(anims)[0];

      if (!Array.isArray(seq) || seq.length === 0) {
        seq = Object.keys(frames);
      }

      if (seq.length > 0) {
        // No mcrework oficial, cada frame tem 80ms (12.5 FPS) com repetições calibradas no atlas
        const frameIdx = Math.floor((elapsedMs / 80) % seq.length);
        const frameKey = seq[frameIdx];
        const fObj = frames[frameKey];

        if (fObj && fObj.frame) {
          const sx = fObj.frame.x;
          const sy = fObj.frame.y;
          const sw = fObj.frame.w;
          const sh = fObj.frame.h;
          const origW = fObj.sourceSize?.w || sw;
          const origH = fObj.sourceSize?.h || sh;
          const offX = fObj.spriteSourceSize?.x || 0;
          const offY = fObj.spriteSourceSize?.y || 0;

          // Ancoragem padrão nos pés (0.5 no X, 0.92 no Y)
          const anchorX = 0.5;
          const anchorY = 0.92;
          const drawX = Math.round(worldX - origW * anchorX + offX);
          const drawY = Math.round(worldY - origH * anchorY + offY);

          ctx.drawImage(this.image, sx, sy, sw, sh, drawX, drawY, sw, sh);
          ctx.restore();
          return;
        }
      }
    }

    // Fallback para miniatura enquanto o atlas completo carrega
    if (this.thumbImage) {
      const w = 64;
      const h = 76;
      ctx.drawImage(this.thumbImage, worldX - w / 2, worldY - h * 0.92, w, h);
    } else {
      ctx.beginPath();
      ctx.arc(worldX, worldY - 24, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    }

    ctx.restore();
  }
}

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
    this.baseMoveSpeed = 210; // pixels por segundo

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
    this.renderGmTeleportList();
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
      document.getElementById('gmDrawer').classList.add('open');
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

      // Carrega a imagem base limpa do mapa (com resolução segura de URL relativa ou absoluta)
      this.mapBgImage = null;
      let rawBg = (mapData.bgImageUrl || mapData.mcreworkMapImage || '').trim();
      let finalBgUrl = rawBg;
      if (!finalBgUrl.startsWith('http://') && !finalBgUrl.startsWith('https://')) {
        finalBgUrl = `https://seytanir.github.io/mcrework/${finalBgUrl.replace(/^\/+/, '')}`;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.mapBgImage = img;
      };
      img.onerror = (err) => {
        console.error('Falha ao carregar imagem base do mapa:', finalBgUrl, err);
      };
      img.src = finalBgUrl;

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
      this.renderGmTeleportList();
    } catch (err) {
      alert(`Erro ao carregar mapa #${mapId}: ${err.message}`);
    }
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
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 2000, 1500);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Carregando imagem do mapa...', this.playerX - 120, this.playerY);
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
      ctx.fillText(`⭐ SPAWN (${this.currentMap.spawnX}, ${this.currentMap.spawnY})`, this.currentMap.spawnX - 50, this.currentMap.spawnY - 38);
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
        const alpha = this.mesh ? this.mesh.getCharacterOpacityAt(npc.posX, npc.posY) : 1.0;
        sprite.draw(ctx, npc.posX, npc.posY, 0, npc.direction || 0, now, alpha);

        ctx.fillStyle = '#86efac';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(npc.namePtBr, npc.posX, npc.posY - 88);
      } else {
        const char = item.data;
        const sprite = this.getOrCreateSprite(
          `char_${char.mcreworkCharKey}`,
          char.atlasJsonUrl,
          char.atlasWebpUrl,
          char.thumbUrl
        );
        const alpha = this.mesh ? this.mesh.getCharacterOpacityAt(this.playerX, this.playerY) : 1.0;
        const action = this.isMoving ? 1 : 0;
        sprite.draw(ctx, this.playerX, this.playerY, action, this.playerDir, now, alpha);

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          `${char.name}${this.gmNoClip ? ' [NO-CLIP]' : ''}`,
          this.playerX,
          this.playerY - 94
        );
      }
    }

    ctx.restore();
  }

  // ==========================================================================
  // DESTRAVAR PERSONAGEM (UNSTUCK) & FERRAMENTAS DO PAINEL GM (`/gm`)
  // ==========================================================================

  async unstuckCharacter() {
    if (!this.activeChar) return;
    try {
      const res = await this.api(`/api/play/characters/${this.activeChar.id}/unstuck`, {
        method: 'POST',
      });
      this.playerX = res.posX;
      this.playerY = res.posY;
      this.moveTargetX = null;
      this.moveTargetY = null;
      this.updateHudInfo();
    } catch (err) {
      alert(`Erro ao destravar personagem: ${err.message}`);
    }
  }

  toggleGmDrawer() {
    document.getElementById('gmDrawer').classList.toggle('open');
  }

  renderGmTeleportList() {
    const container = document.getElementById('gmMapsTeleportList');
    if (!container) return;

    container.innerHTML = this.mapsList
      .map(
        (m) => `
      <button onclick="PlayApp.gmTeleportToMap(${m.id})" style="display:flex; justify-content:space-between; align-items:center; text-align:left; padding:7px 10px;">
        <span><strong>#${m.id} ${m.namePtBr}</strong> <span style="font-size:0.72rem; color:var(--text-muted);">(${m.code})</span></span>
        <span style="font-size:0.72rem; color:var(--accent);">Spawn (${m.spawnX}, ${m.spawnY}) 🚀</span>
      </button>`
      )
      .join('');
  }

  async gmTeleportToMap(targetMapId) {
    if (!this.activeChar) return;
    try {
      const res = await this.api(`/api/play/characters/${this.activeChar.id}/gm-teleport`, {
        method: 'POST',
        body: JSON.stringify({ targetMapId }),
      });
      this.activeChar.currentMapId = res.currentMapId;
      this.activeChar.posX = res.posX;
      this.activeChar.posY = res.posY;
      await this.loadMapIntoWorld(res.currentMapId, res.posX, res.posY);
    } catch (err) {
      alert(`Erro no Teleporte GM: ${err.message}`);
    }
  }

  toggleGmXray() {
    this.gmXray = !this.gmXray;
    const btn = document.getElementById('btnGmXray');
    btn.textContent = `👁️ Raio-X de Malhas/Portais: ${this.gmXray ? 'LIGADO ✅' : 'DESLIGADO'}`;
    btn.className = this.gmXray ? 'btn-amber' : '';
  }

  toggleGmNoClip() {
    this.gmNoClip = !this.gmNoClip;
    const btn = document.getElementById('btnGmNoClip');
    btn.textContent = `👻 Atravessar Paredes (No-Clip): ${this.gmNoClip ? 'LIGADO ✅' : 'DESLIGADO'}`;
    btn.className = this.gmNoClip ? 'btn-amber' : '';
  }

  setGmSpeed(mult) {
    this.gmSpeedMultiplier = Number(mult) || 1;
  }

  async hotReloadCurrentMap() {
    if (!this.currentMap) return;
    await this.loadPlayBootstrap();
    await this.loadMapIntoWorld(this.currentMap.id, this.playerX, this.playerY);
    alert(`🔄 Mapa #${this.currentMap.id} (${this.currentMap.namePtBr}) recarregado em tempo real do PostgreSQL!`);
  }

  // ==========================================================================
  // MODAL DE FICHA DE ATRIBUTOS PROCEDURAIS (6 BASE -> COMBATE)
  // ==========================================================================

  openStatsModal() {
    if (!this.activeChar) return;
    const c = this.activeChar;
    const base = c.baseAttributesJson || { VIT: 10, STR: 10, INT: 10, WIS: 10, AGI: 10, DEX: 10 };
    const dist = c.distributedStatsJson || { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 };
    const grow = c.growthPerLevelJson || { VIT: 2, STR: 2, INT: 2, WIS: 2, AGI: 2, DEX: 2 };
    const lvUps = Math.max(0, (c.level || 1) - 1);

    const totalBase = {};
    for (const k of ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX']) {
      totalBase[k] = (Number(base[k]) || 0) + (Number(grow[k]) || 0) * lvUps + (Number(dist[k]) || 0);
    }

    // Calcula Atributos de Combate via Matriz Procedural (`attribute_conversions`)
    const combatLines = this.combatAttributes.map((ca) => {
      let val = Number(ca.baseDefault) || 0;
      for (const conv of this.attributeConversions) {
        if (conv.combatAttributeCode === ca.code) {
          val += (totalBase[conv.baseAttributeCode] || 0) * Number(conv.ratioPerPoint);
        }
      }
      const formatted = ca.isPercentage ? `${val.toFixed(1)}%` : Math.round(val);
      return `<div style="display:flex; justify-content:space-between; padding:4px 8px; background:rgba(30,41,59,0.6); border-radius:6px;">
        <span>${ca.namePtBr} (<code>${ca.code}</code>)</span>
        <strong style="color:var(--accent);">${formatted}</strong>
      </div>`;
    });

    const el = this.getElementStyle(c.elementCode);
    document.getElementById('statsModalBody').innerHTML = `
      <div style="padding:10px; background:rgba(56,189,248,0.1); border-radius:8px; border:1px solid var(--border);">
        <strong>${c.name}</strong> &bull; Nv.${c.level} &bull; ${c.classNamePtBr} (${c.raceCode})<br/>
        <span>Elemento: <strong style="color:${el.color};">${el.icon} ${c.elementNamePtBr}</strong></span>
      </div>
      <div>
        <strong style="color:var(--accent-amber); display:block; margin-bottom:6px;">6 Atributos Base Totais:</strong>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
          ${['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX']
            .map(
              (k) => `<div style="padding:6px; background:var(--bg-input); border-radius:6px; text-align:center;">
                <div style="font-size:0.72rem; color:var(--text-muted);">${k}</div>
                <strong style="font-size:0.95rem;">${totalBase[k]}</strong>
              </div>`
            )
            .join('')}
        </div>
      </div>
      <div>
        <strong style="color:#86efac; display:block; margin-bottom:6px;">Atributos de Combate Derivados (Matriz Procedural):</strong>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          ${combatLines.join('')}
        </div>
      </div>
    `;
    document.getElementById('statsModal').style.display = 'flex';
  }
}

window.PlayApp = new EtheriaPlayClient();
