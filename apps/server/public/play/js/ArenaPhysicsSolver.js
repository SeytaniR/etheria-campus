/**
 * @file apps/server/public/play/js/ArenaPhysicsSolver.js
 * @module @etheria/server
 * @description Motor Físico de Colisão entre Modelos, Formação Tática e Posicionamento na Arena 2.5D.
 *   - Garante que nenhuma entidade (Jogador, Pets ou Monstros) se sobreponha em uma única sombra.
 *   - Calcula spawns iniciais afastados entre equipes dentro da Arena 1300x940 px.
 *   - Constrói formações iniciais Vanguarda (Melee) / Retaguarda (Ranged) com espaçamento amplo.
 *   - Calcula slots de flanqueamento e contorno em anel ao redor de alvos sem empilhamento.
 * @rules Segue estritamente AGENTS.md (Pilar 3: OOP Modular, Regra #7 < 1.000 linhas).
 */

class ArenaPhysicsSolver {
  /**
   * Verifica se o ponto e uma margem corporal ao seu redor estão livres de paredes/colisão.
   */
  static isSpotFreeWithMargin(x, y, isBlockedFn, margin = 10) {
    if (typeof isBlockedFn !== 'function') return true;
    if (isBlockedFn(x, y)) return false;
    if (margin <= 0) return true;
    return (
      !isBlockedFn(x + margin, y) &&
      !isBlockedFn(x - margin, y) &&
      !isBlockedFn(x, y + margin) &&
      !isBlockedFn(x, y - margin)
    );
  }

  /**
   * Verifica se o corredor retilíneo entre (x1, y1) e (x2, y2) está totalmente livre de obstáculos.
   */
  static isCorridorClear(x1, y1, x2, y2, isBlockedFn, margin = 8) {
    if (typeof isBlockedFn !== 'function') return true;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(2, Math.ceil(dist / 22));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const sx = x1 + (x2 - x1) * t;
      const sy = y1 + (y2 - y1) * t;
      if (!this.isSpotFreeWithMargin(sx, sy, isBlockedFn, margin)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Sorteia posições iniciais seguras e com linha de caminhada livre entre os dois times dentro da Arena.
   */
  static findFairSpawnPositions(cx, cy, rx, ry, isBlockedFn) {
    const angles = [];
    for (let i = 0; i < 16; i++) {
      angles.push((i * Math.PI * 2) / 16);
    }
    const ryRatio = ry / Math.max(1, rx);

    // 1. Tenta pares simétricos centrados em (cx, cy) com corredor livre de ponta a ponta
    for (const dist of [320, 270, 220, 180, 140]) {
      const half = dist / 2;
      for (const ang of angles) {
        const px = Math.round(cx - Math.cos(ang) * half);
        const py = Math.round(cy - Math.sin(ang) * (half * ryRatio));
        const mx = Math.round(cx + Math.cos(ang) * half);
        const my = Math.round(cy + Math.sin(ang) * (half * ryRatio));
        if (
          this.isPointValidInArena(px, py, cx, cy, rx, ry, isBlockedFn, 0.90) &&
          this.isPointValidInArena(mx, my, cx, cy, rx, ry, isBlockedFn, 0.90) &&
          this.isCorridorClear(px, py, cx, cy, isBlockedFn, 10) &&
          this.isCorridorClear(cx, cy, mx, my, isBlockedFn, 10)
        ) {
          return { px, py, mx, my };
        }
      }
    }

    // 2. Corredor estreito: mantém o jogador na posição segura próxima a (cx, cy) e busca ângulo livre para os monstros
    const safePlayer = this.findNearestFreePoint(cx, cy, cx, cy, rx, ry, isBlockedFn, [], 24, 24);
    for (const mDist of [230, 190, 155, 125, 95]) {
      for (const ang of angles) {
        const mx = Math.round(safePlayer.x + Math.cos(ang) * mDist);
        const my = Math.round(safePlayer.y + Math.sin(ang) * (mDist * ryRatio));
        if (
          this.isPointValidInArena(mx, my, cx, cy, rx, ry, isBlockedFn, 0.92) &&
          this.isCorridorClear(safePlayer.x, safePlayer.y, mx, my, isBlockedFn, 8)
        ) {
          return { px: safePlayer.x, py: safePlayer.y, mx, my };
        }
      }
    }

    // 3. Fallback garantido livre de colisão
    const safeMob = this.findNearestFreePoint(safePlayer.x + 120, safePlayer.y, cx, cy, rx, ry, isBlockedFn, [safePlayer], 48, 36);
    return { px: safePlayer.x, py: safePlayer.y, mx: safeMob.x, my: safeMob.y };
  }

  /**
   * Fabrica o descritor unificado de unidade autônoma (Pet ou Monstro) para a Arena.
   */
  static createAiUnitModel(raw, idx, isEnemy, spawnX, spawnY, dir, fallbackSpeed, getSpriteFn, monsterTemplateId) {
    const modelScale = isEnemy ? Math.max(0.5, Number(raw.modelScale) || 1.0) : 1.0;
    return {
      id: raw.id || `${isEnemy ? 'mob' : 'pet'}_${idx}`,
      isPlayer: false,
      team: isEnemy ? 'ENEMY' : 'ALLY',
      variantTier: isEnemy ? (raw.variantTier || 'NORMAL') : 'NORMAL',
      modelScale,
      nameColorHex: raw.nameColorHex || (isEnemy ? '#f8fafc' : '#bae6fd'),
      rewardMultiplier: Math.max(1, Number(raw.rewardMultiplier) || 1),
      bodyRadiusX: Math.round((isEnemy ? 24 : 22) * modelScale),
      bodyRadiusY: Math.round((isEnemy ? 17 : 16) * modelScale),
      templateId: isEnemy ? monsterTemplateId : undefined,
      name: raw.name || `${isEnemy ? 'Monstro' : 'Pet'} #${idx + 1}`,
      level: Number(raw.level) || 1,
      elementCode: raw.elementCode || 'NEUTRAL',
      raceCode: raw.raceCode || 'BEAST',
      rarityTier: raw.rarityTier || null,
      x: spawnX,
      y: spawnY,
      dir,
      action: 0,
      isAlive: true,
      hp: raw.hp || (isEnemy ? 300 : 320),
      maxHp: raw.maxHp || (isEnemy ? 300 : 320),
      mp: raw.mp || 200,
      maxMp: raw.maxMp || 200,
      atk: raw.atk || (isEnemy ? 45 : 42),
      physAtk: raw.physAtk || raw.atk || (isEnemy ? 45 : 42),
      magAtk: raw.magAtk || raw.atk || (isEnemy ? 45 : 42),
      healPower: raw.healPower || raw.atk || (isEnemy ? 30 : 40),
      def: raw.def || (isEnemy ? 25 : 28),
      magDef: raw.magDef || raw.def || (isEnemy ? 25 : 28),
      skillIds: Array.isArray(raw.skillIds) ? raw.skillIds : [],
      activeStatuses: [],
      shieldHp: 0,
      shieldMaxHp: 0,
      critRate: raw.critRate || (isEnemy ? 0.06 : 0.08),
      critDmg: raw.critDmg || 1.5,
      attackSpeed: raw.attackSpeed || 1.0,
      physAccuracy: Number(raw.physAccuracy) || 95,
      physEvasion: Math.min(75, Number(raw.physEvasion) || 5),
      magAccuracy: Number(raw.magAccuracy) || 95,
      magEvasion: Math.min(75, Number(raw.magEvasion) || 5),
      speed: Number(raw.battleMoveSpeed) || Number(raw.speed) || Math.round(fallbackSpeed * (isEnemy ? 0.72 : 0.90)),
      combatStyle: raw.combatStyle || 'MELEE',
      attackRange: raw.attackRange || (raw.combatStyle === 'RANGED' ? 220 : 60),
      damageType: raw.damageType || 'PHYSICAL',
      nextAttackTime: performance.now() + 900 + idx * 320,
      hitTimer: 0,
      attackTimer: 0,
      fadeAlpha: 1.0,
      sprite: typeof getSpriteFn === 'function' ? getSpriteFn(raw.atlasJsonUrl, raw.atlasWebpUrl, raw.thumbUrl) : null,
      groundOffsetY: raw.groundOffsetY || 0,
      shadowOffsetX: raw.shadowOffsetX || 0,
      shadowOffsetY: raw.shadowOffsetY || 0,
      path: null,
      nextRepathTime: 0,
      targetMob: null,
      aiState: null,
      tacticalRole: 'STANDARD',
    };
  }

  /**
   * Garante que a coordenada (x, y) permaneça estritamente dentro dos limites elípticos da arena.
   */
  static clampToArenaEllipse(x, y, cx, cy, rx, ry, margin = 0.96) {
    const effRx = Math.max(40, rx * margin);
    const effRy = Math.max(40, ry * margin);
    const normX = (x - cx) / effRx;
    const normY = (y - cy) / effRy;
    const distSq = normX * normX + normY * normY;
    if (distSq <= 1) {
      return { x, y, clamped: false };
    }
    const scale = 1 / Math.sqrt(distSq);
    return {
      x: cx + (x - cx) * scale,
      y: cy + (y - cy) * scale,
      clamped: true,
    };
  }

  /**
   * Verifica se o ponto está livre de paredes poligonais do mapa e dentro da elipse da arena.
   */
  static isPointValidInArena(x, y, cx, cy, rx, ry, isBlockedFn, margin = 0.95) {
    const normX = (x - cx) / Math.max(40, rx * margin);
    const normY = (y - cy) / Math.max(40, ry * margin);
    if (normX * normX + normY * normY > 1) return false;
    if (typeof isBlockedFn === 'function' && isBlockedFn(x, y)) return false;
    return true;
  }

  /**
   * Executa deslocamento suave com deslize nos eixos X/Y ao tocar obstáculos e restrição elíptica.
   */
  static moveWithCollision(unit, targetX, targetY, cx, cy, rx, ry, isBlockedFn) {
    const clamped = this.clampToArenaEllipse(targetX, targetY, cx, cy, rx, ry, 0.96);
    const nx = clamped.x;
    const ny = clamped.y;
    const blocked = (x, y) => typeof isBlockedFn === 'function' && isBlockedFn(x, y);

    if (!blocked(nx, ny)) {
      unit.x = nx;
      unit.y = ny;
      return true;
    }
    if (!blocked(nx, unit.y)) {
      unit.x = nx;
      return true;
    }
    if (!blocked(unit.x, ny)) {
      unit.y = ny;
      return true;
    }
    return false;
  }

  /**
   * Executa deslocamento contínuo de alta fluidez com projeção tangencial de vetor (Vector Slide).
   * Impede que a unidade trave a seco ao colidir contra a borda elíptica da arena ou polígonos.
   * Projeta o vetor de movimento na tangente da superfície de colisão, mantendo a componente de deslize.
   */
  static moveWithContinuousSlide(unit, targetX, targetY, cx, cy, rx, ry, isBlockedFn) {
    const blocked = (x, y) => typeof isBlockedFn === 'function' && isBlockedFn(x, y);
    const startX = unit.x;
    const startY = unit.y;
    let dx = targetX - startX;
    let dy = targetY - startY;

    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return false;

    // 1. Projeção tangencial na borda da elipse da arena
    const margin = 0.96;
    const effRx = rx * margin;
    const effRy = ry * margin;
    const normX = (targetX - cx) / Math.max(1, effRx);
    const normY = (targetY - cy) / Math.max(1, effRy);
    const distSq = normX * normX + normY * normY;

    if (distSq > 1.0) {
      // O movimento tentaria sair da elipse. Calcula a normal da elipse na posição atual:
      const currNormX = (startX - cx) / Math.max(1, effRx);
      const currNormY = (startY - cy) / Math.max(1, effRy);
      let gradX = currNormX / Math.max(1, effRx);
      let gradY = currNormY / Math.max(1, effRy);
      const gradLen = Math.hypot(gradX, gradY);
      if (gradLen > 0.0001) {
        gradX /= gradLen;
        gradY /= gradLen;

        const dot = dx * gradX + dy * gradY;
        if (dot > 0) {
          dx -= dot * gradX;
          dy -= dot * gradY;
        }
      }
    }

    let candX = startX + dx;
    let candY = startY + dy;

    const clamped = this.clampToArenaEllipse(candX, candY, cx, cy, rx, ry, margin);
    candX = clamped.x;
    candY = clamped.y;

    // 2. Verificação de obstáculos/bloqueios no mapa
    if (!blocked(candX, candY)) {
      unit.x = candX;
      unit.y = candY;
      return true;
    }

    if (!blocked(candX, startY)) {
      unit.x = candX;
      return true;
    }
    if (!blocked(startX, candY)) {
      unit.y = candY;
      return true;
    }

    // Tenta desvios tangenciais angulares (±35° e ±55°) com passo suave
    const moveLen = Math.hypot(dx, dy);
    if (moveLen > 0.5) {
      const baseAng = Math.atan2(dy, dx);
      for (const offsetAng of [Math.PI / 5, -Math.PI / 5, Math.PI / 3, -Math.PI / 3]) {
        const testAng = baseAng + offsetAng;
        const testX = startX + Math.cos(testAng) * (moveLen * 0.85);
        const testY = startY + Math.sin(testAng) * (moveLen * 0.85);
        const testClamped = this.clampToArenaEllipse(testX, testY, cx, cy, rx, ry, margin);
        if (!blocked(testClamped.x, testClamped.y)) {
          unit.x = testClamped.x;
          unit.y = testClamped.y;
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Encontra o ponto livre mais próximo de (targetX, targetY) respeitando colisão de mapa,
   * borda da arena e separação mínima de outras unidades já posicionadas.
   */
  static findNearestFreePoint(
    targetX,
    targetY,
    cx,
    cy,
    rx,
    ry,
    isBlockedFn,
    placedUnits = [],
    minSepX = 48,
    minSepY = 34
  ) {
    const isSpotValidWithPad = (px, py) =>
      this.isPointValidInArena(px, py, cx, cy, rx, ry, isBlockedFn, 0.93) &&
      this.isSpotFreeWithMargin(px, py, isBlockedFn, 8);

    const isSpotClean = (px, py, requireCorridor = false) => {
      if (!isSpotValidWithPad(px, py)) return false;
      if (requireCorridor && !this.isCorridorClear(cx, cy, px, py, isBlockedFn, 6)) return false;
      for (const other of placedUnits) {
        const dx = px - other.x;
        const dy = py - other.y;
        if (Math.hypot(dx / minSepX, dy / minSepY) < 0.98) {
          return false;
        }
      }
      return true;
    };

    const initial = this.clampToArenaEllipse(targetX, targetY, cx, cy, rx, ry, 0.92);
    if (isSpotClean(initial.x, initial.y, true) || isSpotClean(initial.x, initial.y, false)) {
      return { x: Math.round(initial.x), y: Math.round(initial.y) };
    }

    // 1. Prioriza pontos livres, sem sobreposição e com corredor livre até o centro
    for (let radius = 24; radius <= 280; radius += 24) {
      for (let i = 0; i < 16; i++) {
        const ang = (i * Math.PI * 2) / 16;
        const candX = initial.x + Math.cos(ang) * radius;
        const candY = initial.y + Math.sin(ang) * (radius * 0.72);
        if (isSpotClean(candX, candY, true)) {
          return { x: Math.round(candX), y: Math.round(candY) };
        }
      }
    }

    // 2. Qualquer ponto livre e sem sobreposição na arena
    for (let radius = 20; radius <= 340; radius += 24) {
      for (let i = 0; i < 16; i++) {
        const ang = (i * Math.PI * 2) / 16;
        const candX = initial.x + Math.cos(ang) * radius;
        const candY = initial.y + Math.sin(ang) * (radius * 0.72);
        if (isSpotClean(candX, candY, false)) {
          return { x: Math.round(candX), y: Math.round(candY) };
        }
      }
    }

    // 3. Fallback anti-colisão: se estiver muito lotado, relaxa separação entre unidades mas JAMAIS retorna ponto bloqueado!
    if (isSpotValidWithPad(initial.x, initial.y)) {
      return { x: Math.round(initial.x), y: Math.round(initial.y) };
    }
    for (const ref of [initial, { x: cx, y: cy }]) {
      for (let radius = 14; radius <= 360; radius += 18) {
        for (let i = 0; i < 16; i++) {
          const ang = (i * Math.PI * 2) / 16;
          const candX = ref.x + Math.cos(ang) * radius;
          const candY = ref.y + Math.sin(ang) * (radius * 0.72);
          if (this.isPointValidInArena(candX, candY, cx, cy, rx, ry, isBlockedFn, 0.94)) {
            return { x: Math.round(candX), y: Math.round(candY) };
          }
        }
      }
    }

    return { x: Math.round(cx), y: Math.round(cy) };
  }

  /**
   * Ejeta imediatamente qualquer unidade que tenha entrado em área de colisão de volta para solo caminhável.
   */
  static ensureUnitOutOfCollision(unit, cx, cy, rx, ry, isBlockedFn) {
    if (!unit || !unit.isAlive) return;
    if (
      this.isPointValidInArena(unit.x, unit.y, cx, cy, rx, ry, isBlockedFn, 0.96) &&
      this.isSpotFreeWithMargin(unit.x, unit.y, isBlockedFn, 4)
    ) {
      return;
    }

    // Busca em espiral o ponto caminhável mais próximo (preferindo a direção do centro da arena)
    const toCenterAng = Math.atan2(cy - unit.y, cx - unit.x);
    for (let radius = 10; radius <= 340; radius += 14) {
      for (let i = 0; i < 16; i++) {
        const offset = (i % 2 === 0 ? i / 2 : -Math.ceil(i / 2)) * ((Math.PI * 2) / 16);
        const ang = toCenterAng + offset;
        const candX = unit.x + Math.cos(ang) * radius;
        const candY = unit.y + Math.sin(ang) * (radius * 0.78);
        if (
          this.isPointValidInArena(candX, candY, cx, cy, rx, ry, isBlockedFn, 0.94) &&
          this.isSpotFreeWithMargin(candX, candY, isBlockedFn, 6)
        ) {
          unit.x = Math.round(candX);
          unit.y = Math.round(candY);
          return;
        }
      }
    }

    if (!isBlockedFn || !isBlockedFn(cx, cy)) {
      unit.x = Math.round(cx);
      unit.y = Math.round(cy);
    }
  }

  /**
   * Gera posições iniciais espaçadas em formação Vanguarda (Melee) / Retaguarda (Ranged),
   * eliminando sobreposição desde o segundo zero da batalha.
   */
  static buildTeamFormationPositions(
    anchorX,
    anchorY,
    enemyAnchorX,
    enemyAnchorY,
    units,
    cx,
    cy,
    rx,
    ry,
    isBlockedFn,
    alreadyPlaced = []
  ) {
    const dx = enemyAnchorX - anchorX;
    const dy = enemyAnchorY - anchorY;
    const len = Math.hypot(dx, dy) || 1;
    const fwdX = dx / len;
    const fwdY = dy / len;
    const rightX = -fwdY;
    const rightY = fwdX;

    const meleeUnits = [];
    const rangedUnits = [];
    units.forEach((u, idx) => {
      if (u.combatStyle === 'RANGED') rangedUnits.push({ u, idx });
      else meleeUnits.push({ u, idx });
    });

    const placements = new Array(units.length);
    const occupied = [...alreadyPlaced];

    const isAllyPetGroup = units.length > 0 && units[0]?.team === 'ALLY';
    const placeRowGroup = (group, forwardOffset) => {
      const perRow = 4;
      group.forEach((item, posIdx) => {
        const row = Math.floor(posIdx / perRow);
        const col = posIdx % perRow;
        const rowCount = Math.min(perRow, group.length - row * perRow);
        const latOffset = rowCount === 1 && isAllyPetGroup
          ? 34
          : (col - (rowCount - 1) / 2) * 82 + (row % 2 === 1 ? 26 : 0);
        const depthOffset = forwardOffset - row * 68;

        const rawX = anchorX + fwdX * depthOffset + rightX * latOffset;
        const rawY = anchorY + fwdY * depthOffset + rightY * latOffset;
        const free = this.findNearestFreePoint(rawX, rawY, cx, cy, rx, ry, isBlockedFn, occupied, 58, 42);
        placements[item.idx] = free;
        occupied.push(free);
      });
    };

    placeRowGroup(meleeUnits, isAllyPetGroup ? 86 : 36);
    placeRowGroup(rangedUnits, isAllyPetGroup ? 44 : (meleeUnits.length > 0 ? -92 : 0));
    return placements;
  }

  /**
   * Resolve colisões físicas elípticas entre TODOS os modelos vivos na arena (Jogador, Pets e Monstros),
   * impedindo acúmulo em uma única sombra mesmo durante combates em grupo.
   */
  static resolveAllUnitCollisions(units, cx, cy, rx, ry, isBlockedFn) {
    const alive = units.filter((u) => u && u.isAlive);
    for (const u of alive) {
      this.ensureUnitOutOfCollision(u, cx, cy, rx, ry, isBlockedFn);
    }
    const count = alive.length;
    if (count < 2) return;

    const getMass = (u) => {
      if (u.isPlayer) return u.action === 1 ? 2.4 : 1.5;
      if (u.tacticalRole === 'TANK_PROTECTOR') return 1.35;
      return 1.0;
    };

    const maxPasses = 12;
    const stiffness = 0.85;

    for (let pass = 0; pass < maxPasses; pass++) {
      let hadOverlap = false;
      for (let i = 0; i < count; i++) {
        const a = alive[i];
        const aRx = a.bodyRadiusX || 24;
        const aRy = a.bodyRadiusY || 17;
        const aMass = getMass(a);

        for (let j = i + 1; j < count; j++) {
          const b = alive[j];
          const bRx = b.bodyRadiusX || 24;
          const bRy = b.bodyRadiusY || 17;
          const bMass = getMass(b);

          const minX = aRx + bRx;
          const minY = aRy + bRy;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const nd = Math.hypot(dx / minX, dy / minY);

          if (nd >= 0.995) continue;
          hadOverlap = true;

          let sepX;
          let sepY;
          if (nd < 0.0001) {
            const ang = (i + 1) * 2.39996 + (j + 1) * 1.618;
            sepX = Math.cos(ang) * minX * 0.75;
            sepY = Math.sin(ang) * minY * 0.75;
          } else {
            const factor = (1 / nd - 1) * stiffness;
            sepX = dx * factor;
            sepY = dy * factor;
          }

          const totalMass = aMass + bMass;
          const weightA = bMass / totalMass;
          const weightB = aMass / totalMass;

          this.moveWithCollision(a, a.x - sepX * weightA, a.y - sepY * weightA, cx, cy, rx, ry, isBlockedFn);
          this.moveWithCollision(b, b.x + sepX * weightB, b.y + sepY * weightB, cx, cy, rx, ry, isBlockedFn);
        }
      }
      if (!hadOverlap) break;
    }

    for (const u of alive) {
      this.ensureUnitOutOfCollision(u, cx, cy, rx, ry, isBlockedFn);
    }
  }

  /**
   * Calcula um ponto tático ao redor do alvo evitando aglomeração com aliados.
   * Quando `avoidCentroid` é informado (ex: unidade frágil atacando pelas bordas),
   * prioriza ângulos opostos ao centro de ameaça inimigo.
   */
  static computeSurroundAttackSlot(
    attacker,
    target,
    allAllies,
    desiredRange,
    cx,
    cy,
    rx,
    ry,
    isBlockedFn,
    avoidCentroid = null
  ) {
    const approachAng = Math.atan2(attacker.y - target.y, attacker.x - target.x);
    const outFromDangerAng = avoidCentroid
      ? Math.atan2(target.y - avoidCentroid.y, target.x - avoidCentroid.x)
      : approachAng;

    const ringDist = Math.max(46, Math.min(desiredRange, (desiredRange || 60) * 0.88));
    let bestPoint = { x: target.x, y: target.y };
    let bestScore = Infinity;

    for (let s = 0; s < 12; s++) {
      const ang = (s * Math.PI * 2) / 12;
      const candX = target.x + Math.cos(ang) * ringDist;
      const candY = target.y + Math.sin(ang) * (ringDist * 0.78);

      if (!this.isPointValidInArena(candX, candY, cx, cy, rx, ry, isBlockedFn, 0.94)) {
        continue;
      }

      let crowdPenalty = 0;
      for (const ally of allAllies) {
        if (!ally || !ally.isAlive || ally === attacker) continue;
        const dAlly = Math.hypot((candX - ally.x) / 48, (candY - ally.y) / 34);
        if (dAlly < 1.25) {
          crowdPenalty += (1.25 - dAlly) * 260;
        }
      }

      const angDiffDanger = Math.abs(Math.atan2(Math.sin(ang - outFromDangerAng), Math.cos(ang - outFromDangerAng)));
      const angDiffApproach = Math.abs(Math.atan2(Math.sin(ang - approachAng), Math.cos(ang - approachAng)));

      const score = avoidCentroid
        ? crowdPenalty + angDiffDanger * 85 + angDiffApproach * 22
        : crowdPenalty + angDiffApproach * 55;

      if (score < bestScore) {
        bestScore = score;
        bestPoint = { x: candX, y: candY };
      }
    }

    return bestPoint;
  }
}

window.ArenaPhysicsSolver = ArenaPhysicsSolver;
