/**
 * @file apps/server/public/play/js/ActionMotionEngine.js
 * @module @etheria/server
 * @description Motor de Movimento, Ciclo de Ataque (Windup/CastPoint/Backswing),
 *   Input Buffering, Desacoplamento de Mira e Deslize Vetorial Contínuo para Etheria Campus.
 *
 * Inspirado na arquitetura mecânica de alta precisão de action MOBAs (League of Legends):
 *   - Ciclo de Ataque Tríplice: Windup (preparação) -> Cast Point (disparo) -> Backswing (recuperação cancelável).
 *   - Orb-Walking / Kiting: Cancelamento imediato de backswing por ordem de movimento ou habilidade.
 *   - Desacoplamento de Direção: Facing/Aim Direction independente do Movement Vector (adeus tiros de costas).
 *   - Input Buffering: Fila de tolerância de 160ms para ataques, dashes e habilidades (zero botões perdidos).
 *   - Cinemática Suave: Aceleração/desaceleração responsiva e deslizamento tangencial em paredes e corpos.
 *   - Auto-Attack Resets: Habilidades e dashes que reiniciam o ciclo de ataque para combos motores.
 *
 * @rules Segue estritamente AGENTS.md (Pilar 3: OOP Modular, Regra #7 < 1.000 linhas).
 */

class ActionMotionEngine {
  constructor(arena) {
    this.arena = arena;

    // FASE 1: Estados do Ciclo de Ataque
    // 'IDLE' | 'WINDUP' | 'CAST_POINT' | 'BACKSWING'
    this.attackState = 'IDLE';
    this.windupTimer = 0;
    this.backswingTimer = 0;
    this.attackRecoveryTimer = 0;
    this.pendingAttackTarget = null;
    this.pendingAttackPayload = null;

    // FASE 2: Desacoplamento de Mira e Rotação
    this.facingAngle = 0; // Radianos
    this.facingDir = 1; // 0..7
    this.aimLockUntil = 0; // Timestamp até quando a direção está travada na mira

    // FASE 3: Input Buffering
    this.bufferedAction = null; // { type, param, timestamp, expiresAt }
    this.BUFFER_WINDOW_MS = 160;

    // FASE 4: Cinemática Suave e Velocidades
    this.currentVx = 0;
    this.currentVy = 0;
    this.ACCELERATION_RATE = 24.0; // Lerp por segundo ao acelerar
    this.DECELERATION_RATE = 28.0; // Lerp por segundo ao desacelerar

    // FASE 5: Flags de Combos
    this.canCancelBackswingWithMove = true;

    // APROXIMAÇÃO / PERSEGUIÇÃO AUTOMÁTICA (Estilo League of Legends)
    this.isApproaching = false;
    this.approachTarget = null;
    this.approachDesiredRange = 0;
    this.approachActionType = null; // 'ATTACK' | 'SKILL'
    this.approachActionPayload = null;
  }

  /**
   * Reinicia todos os estados de movimento e combate da unidade.
   */
  reset() {
    this.attackState = 'IDLE';
    this.windupTimer = 0;
    this.backswingTimer = 0;
    this.attackRecoveryTimer = 0;
    this.pendingAttackTarget = null;
    this.pendingAttackPayload = null;
    this.aimLockUntil = 0;
    this.bufferedAction = null;
    this.currentVx = 0;
    this.currentVy = 0;
    this.cancelApproach();
  }

  /**
   * Inicia o modo de aproximação até que o personagem entre no alcance de ataque ou habilidade.
   */
  startApproach(player, target, desiredRange, actionType = 'ATTACK', payload = null) {
    if (!target || !target.isAlive) return false;
    this.isApproaching = true;
    this.approachTarget = target;
    this.approachDesiredRange = Math.max(40, Number(desiredRange) || 60);
    this.approachActionType = actionType;
    this.approachActionPayload = payload;
    this.cancelWindup('APPROACH_START');
    return true;
  }

  /**
   * Cancela o modo de aproximação automática.
   */
  cancelApproach() {
    this.isApproaching = false;
    this.approachTarget = null;
    this.approachDesiredRange = 0;
    this.approachActionType = null;
    this.approachActionPayload = null;
  }

  /* =========================================================================
   * FASE 1: CICLO DE ATAQUE (WINDUP, CAST POINT & BACKSWING CANCEL / KITING)
   * ========================================================================= */

  /**
   * Calcula as durações dinâmicas do ciclo de ataque baseadas na velocidade de ataque (ASPD).
   * No LoL:
   *   - Ataques duram `1.0 / aspd` segundos.
   *   - O Windup é ~22% a 30% da animação (preparação inquebrável para soltar o ataque).
   *   - O Cast Point é o instante de liberação.
   *   - O Backswing ocupa ~40% a 50% e pode ser cancelado por movimento ou nova skill.
   */
  computeAttackTimings(aspd = 1.0) {
    const safeAspd = Math.max(0.4, Math.min(4.0, Number(aspd) || 1.0));
    // Intervalo total entre ataques em segundos (ex: aspd 1.0 = 0.85s; aspd 1.5 = 0.56s)
    const totalCycleSec = Math.max(0.24, 0.82 / safeAspd);

    // Windup calibrado: fração necessária para puxar a arma / arco / cajado
    const windupRatio = 0.28;
    const windupSec = Math.max(0.08, totalCycleSec * windupRatio);

    // Backswing calibrado: tempo de recuperação pós-disparo (cancelável)
    const backswingSec = Math.max(0.10, totalCycleSec * 0.42);

    return { totalCycleSec, windupSec, backswingSec };
  }

  /**
   * Solicita o início de um auto-ataque contra um alvo.
   * Retorna true se iniciou com sucesso ou se foi enfileirado no buffer.
   */
  requestAttack(player, target, now, options = {}) {
    if (!this.arena || !player || !player.isAlive) return false;

    // Se estiver bloqueado por atordoamento / controle de grupo
    if (window.ActionSkillEngine && window.ActionSkillEngine.isActionBlocked(player)) {
      return false;
    }

    const pEff = window.ActionSkillEngine ? window.ActionSkillEngine.getEffectiveStats(player) : player;
    const aspd = pEff.attackSpeed || player.attackSpeed || 1.0;
    const timings = this.computeAttackTimings(aspd);

    // Se o ataque ainda estiver em cooldown ou em windup
    const cooldownRemaining = this.attackRecoveryTimer;
    if (cooldownRemaining > 0 || this.attackState === 'WINDUP') {
      // FASE 3: Enfileira no Input Buffer se faltar pouco tempo (<= 160ms)
      if (cooldownRemaining <= this.BUFFER_WINDOW_MS / 1000) {
        this.enqueueBufferedAction('ATTACK', { target }, now);
      }
      return false;
    }

    // Se estiver em BACKSWING, cancelar backswing com um novo ataque não quebra o ritmo,
    // mas o cooldown residual de ataque deve ser respeitado.
    if (this.attackState === 'BACKSWING') {
      this.cancelBackswing('NEW_ATTACK');
    }

    // Valida alcance até o alvo: se estiver fora de alcance, inicia perseguição automática (estilo LoL)
    if (target) {
      const dist = Math.hypot(target.x - player.x, target.y - player.y);
      const maxRange = (pEff && pEff.attackRange) || player.attackRange || (player.combatStyle === 'RANGED' ? 220 : 60);
      if (dist > maxRange + 15) {
        this.startApproach(player, target, maxRange, 'ATTACK', options);
        return true;
      }
    }
    // Estando em alcance, cancela qualquer modo de perseguição
    this.cancelApproach();

    // Inicia a Fase 1: WINDUP
    this.attackState = 'WINDUP';
    this.windupTimer = timings.windupSec;
    this.backswingTimer = timings.backswingSec;
    this.attackRecoveryTimer = timings.totalCycleSec;
    this.pendingAttackTarget = target;
    this.pendingAttackPayload = options;

    // Notifica o modelo do jogador sobre a postura/animação de ataque
    player.isAttacking = true;
    player.action = 3; // 3 = Ataque
    player.actionStartTime = now;
    player.attackTimer = timings.windupSec + timings.backswingSec;

    // FASE 2: Vira de frente para o alvo e trava a mira durante o windup
    if (target) {
      this.lockAimTowards(player, target.x, target.y, timings.windupSec + 0.05);
    }

    // Consome ação do buffer caso tenha sido executada
    this.clearBufferedAction();
    return true;
  }

  /**
   * Cancela o windup atual se o jogador forçar um movimento ou sofrer interrupção.
   * Se cancelado antes do Cast Point, o projétil NÃO é gerado (regra exata de MOBA).
   */
  cancelWindup(reason = 'MOVE') {
    if (this.attackState !== 'WINDUP') return false;

    this.attackState = 'IDLE';
    this.windupTimer = 0;
    this.pendingAttackTarget = null;
    this.pendingAttackPayload = null;

    if (this.arena?.player) {
      this.arena.player.isAttacking = false;
      this.arena.player.action = 0; // Volta para IDLE
    }

    // Devolve parte do tempo de cooldown para que o jogador possa retentar rapidamente
    this.attackRecoveryTimer = Math.min(this.attackRecoveryTimer, 0.12);
    return true;
  }

  /**
   * Cancela o backswing (winddown) para liberar movimento ou habilidades instantâneas (Kiting/Orb-Walking).
   */
  cancelBackswing(reason = 'MOVE') {
    if (this.attackState !== 'BACKSWING') return false;

    this.attackState = 'IDLE';
    this.backswingTimer = 0;

    if (this.arena?.player) {
      this.arena.player.isAttacking = false;
      if (this.arena.player.action === 3) {
        this.arena.player.action = 0;
      }
    }
    return true;
  }

  /**
   * Executa o disparo do ataque exatamente no CAST POINT.
   */
  executeCastPoint(now) {
    if (this.attackState !== 'WINDUP' || !this.arena?.player) return;

    const player = this.arena.player;
    const target = this.pendingAttackTarget || this.arena.getLockedTarget();

    this.attackState = 'BACKSWING';
    player.isAttacking = false; // Permite cancelamento de animação no backswing

    if (target && target.isAlive) {
      // Garante direção final de frente para o alvo
      player.dir = this.arena.compute8Direction(target.x - player.x, target.y - player.y);

      const isMagical = player.damageType === 'MAGICAL';
      const isRanged = player.combatStyle === 'RANGED';

      if (isRanged) {
        const projectileEmoji = isMagical ? '🔮' : '🏹';
        const projectileColor = isMagical ? '#c084fc' : '#fde047';

        this.arena.spawnHomingProjectile(
          target,
          'SINGLE',
          0,
          player.atk,
          false,
          projectileEmoji,
          projectileColor,
          isMagical,
          undefined,
          undefined,
          undefined,
          undefined,
          'ALLY',
          player.critDmg,
          { attackerUnit: player, skillMultiplier: 1.0 }
        );
      } else {
        // Melee: Não dispara projétil voador. Aplica dano direto e burst de impacto no inimigo
        const acc = isMagical ? (player.magAccuracy || 95) : (player.physAccuracy || 95);
        const payload = {
          team: 'ALLY',
          dmg: player.atk,
          attackerUnit: player,
          skillMultiplier: 1.0,
          critDmgMult: player.critDmg || 1.5,
          emoji: isMagical ? '✨' : '⚔️',
          color: isMagical ? '#c084fc' : '#fde047',
          isMagical,
        };
        this.arena.applyDamageWithHitEvasionRoll(target, payload, acc, now);

        const vfxKey = player.attackVfxKey || (isMagical ? '10008' : '10009');
        if (this.arena.vfxRenderer?.spawnBurst) {
          this.arena.vfxRenderer.spawnBurst(vfxKey, target.x, target.y - 10, isMagical ? '#c084fc' : '#f59e0b', 100, 420, 0.75);
        }

        this.arena.updateHud();
        this.arena.checkVictoryCondition();
      }
    }

    this.pendingAttackTarget = null;
    this.pendingAttackPayload = null;
    this.arena.updateHud();
  }

  /* =========================================================================
   * FASE 2: DESACOPLAMENTO DE MIRA E ROTAÇÃO (FACING VS MOVING)
   * ========================================================================= */

  /**
   * Trava a rotação do personagem em direção a um ponto ou alvo até um determinado timestamp.
   */
  lockAimTowards(player, targetX, targetY, durationSec) {
    if (!player) return;
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    this.facingAngle = Math.atan2(dy, dx);
    this.facingDir = this.arena ? this.arena.compute8Direction(dx, dy) : 1;
    player.dir = this.facingDir;
    this.aimLockUntil = performance.now() + Math.round(durationSec * 1000);
  }

  /**
   * Retorna true se a direção do personagem estiver atualmente travada pela mira do ataque.
   */
  isAimLocked(now) {
    return this.attackState === 'WINDUP' || now < this.aimLockUntil;
  }

  /* =========================================================================
   * FASE 3: INPUT BUFFERING (JANELA DE TOLERÂNCIA DE 160ms)
   * ========================================================================= */

  /**
   * Enfileira uma ação de ataque, habilidade ou dash para execução assim que a unidade for liberada.
   */
  enqueueBufferedAction(type, param, now) {
    this.bufferedAction = {
      type,
      param,
      timestamp: now,
      expiresAt: now + this.BUFFER_WINDOW_MS,
    };
  }

  /**
   * Limpa o buffer de comandos.
   */
  clearBufferedAction() {
    this.bufferedAction = null;
  }

  /**
   * Processa e consome qualquer ação pendente no buffer se o jogador estiver livre.
   */
  tryConsumeBufferedAction(now) {
    if (!this.bufferedAction) return;

    if (now > this.bufferedAction.expiresAt) {
      this.bufferedAction = null;
      return;
    }

    // Se ainda estiver em WINDUP, não consome
    if (this.attackState === 'WINDUP') return;

    // Se estiver bloqueado por CC, não consome
    if (this.arena?.player && window.ActionSkillEngine?.isActionBlocked(this.arena.player)) return;

    const action = this.bufferedAction;

    if (action.type === 'ATTACK') {
      if (this.attackRecoveryTimer <= 0) {
        this.clearBufferedAction();
        this.requestAttack(this.arena.player, action.param?.target || this.arena.getLockedTarget(), now);
      }
    } else if (action.type === 'SKILL') {
      const cdKey = `skill${action.param?.skillNum}`;
      const cdExpire = this.arena?.skillCooldowns?.[cdKey] || 0;
      if (now >= cdExpire) {
        this.clearBufferedAction();
        this.arena.triggerSkill(action.param.skillNum);
      }
    }
  }

  /* =========================================================================
   * FASE 4: CINEMÁTICA SUAVE E DESLIZE VETORIAL CONTÍNUO
   * ========================================================================= */

  /**
   * Atualiza a física de movimento do jogador com aceleração, desaceleração e rotação correta.
   */
  updatePlayerKinematics(player, rawVx, rawVy, curSpeed, dt, now) {
    if (!player || !player.isAlive) return;

    // 0. Modo de Perseguição / Aproximação ao Alvo (Estilo League of Legends)
    if (this.isApproaching) {
      const target = this.approachTarget;
      if (!target || !target.isAlive) {
        this.cancelApproach();
      } else {
        const dist = Math.hypot(target.x - player.x, target.y - player.y);
        if (dist <= this.approachDesiredRange + 5) {
          // Entrou no alcance de ataque ou habilidade!
          const actType = this.approachActionType;
          const actPayload = this.approachActionPayload;
          this.cancelApproach();
          if (actType === 'ATTACK') {
            this.requestAttack(player, target, now, actPayload);
          } else if (actType === 'SKILL' && actPayload?.skillNum) {
            this.arena.triggerSkill(actPayload.skillNum);
          }
          rawVx = 0;
          rawVy = 0;
        } else {
          // Conduz o personagem suavemente em direção ao alvo
          const adx = target.x - player.x;
          const ady = target.y - player.y;
          const alen = Math.hypot(adx, ady) || 1;
          rawVx = adx / alen;
          rawVy = ady / alen;
          player.dir = this.arena.compute8Direction(adx, ady);
        }
      }
    }

    // 1. Atualização dos cronômetros do ciclo de ataque
    if (this.attackRecoveryTimer > 0) {
      this.attackRecoveryTimer = Math.max(0, this.attackRecoveryTimer - dt);
    }

    if (this.attackState === 'WINDUP') {
      this.windupTimer -= dt;
      // PRIORIZA O ATAQUE: Durante o windup, o ataque é executado com foco total.
      // O joystick não cancela o disparo prematuramente; o boneco planta os pés e solta o golpe.
      if (this.windupTimer <= 0) {
        this.executeCastPoint(now);
      }
    } else if (this.attackState === 'BACKSWING') {
      this.backswingTimer -= dt;

      // KITING / ORB-WALKING: O movimento cancela imediatamente o backswing pós-disparo!
      const hasMoveInput = rawVx !== 0 || rawVy !== 0;
      if (hasMoveInput && this.canCancelBackswingWithMove) {
        this.cancelBackswing('ORB_WALK_MOVE');
      } else if (this.backswingTimer <= 0) {
        this.attackState = 'IDLE';
        player.isAttacking = false;
        if (player.action === 3) player.action = 0;
      }
    }

    // 2. Tenta consumir comandos do buffer
    this.tryConsumeBufferedAction(now);

    // 3. Bloqueio de locomoção se estiver em WINDUP
    let inputVx = rawVx;
    let inputVy = rawVy;
    if (this.attackState === 'WINDUP') {
      inputVx = 0;
      inputVy = 0;
    }

    // 4. Aceleração e desaceleração suave (lerp)
    const targetVx = inputVx * curSpeed;
    const targetVy = inputVy * curSpeed;
    const rate = (inputVx !== 0 || inputVy !== 0) ? this.ACCELERATION_RATE : this.DECELERATION_RATE;
    const lerpFactor = Math.min(1.0, rate * dt);

    this.currentVx += (targetVx - this.currentVx) * lerpFactor;
    this.currentVy += (targetVy - this.currentVy) * lerpFactor;

    // Corta micro-velocidades residuais para parada limpa
    if (Math.abs(this.currentVx) < 1.2) this.currentVx = 0;
    if (Math.abs(this.currentVy) < 1.2) this.currentVy = 0;

    const speedSq = this.currentVx * this.currentVx + this.currentVy * this.currentVy;
    const isMoving = speedSq > 4.0;

    // 5. Aplicação do movimento com deslizamento vetorial na arena
    if (isMoving) {
      const stepX = this.currentVx * dt;
      const stepY = this.currentVy * dt;
      const targetX = player.x + stepX;
      const targetY = player.y + stepY;

      const isBlockedFn = (x, y) => this.arena.isBlocked(x, y);

      if (window.ArenaPhysicsSolver && typeof window.ArenaPhysicsSolver.moveWithContinuousSlide === 'function') {
        window.ArenaPhysicsSolver.moveWithContinuousSlide(
          player,
          targetX,
          targetY,
          this.arena.arenaCenterX,
          this.arena.arenaCenterY,
          this.arena.arenaRadiusX,
          this.arena.arenaRadiusY,
          isBlockedFn
        );
      } else if (window.ArenaPhysicsSolver) {
        window.ArenaPhysicsSolver.moveWithCollision(
          player,
          targetX,
          targetY,
          this.arena.arenaCenterX,
          this.arena.arenaCenterY,
          this.arena.arenaRadiusX,
          this.arena.arenaRadiusY,
          isBlockedFn
        );
      } else {
        player.x = targetX;
        player.y = targetY;
      }

      // FASE 2: Atualiza a direção do personagem pelo movimento APENAS se a mira não estiver travada
      if (!this.isAimLocked(now)) {
        player.dir = this.arena.compute8Direction(this.currentVx, this.currentVy);
      }

      if (this.attackState === 'IDLE') {
        player.action = 1; // 1 = Caminhada/Corrida
      }
    } else {
      if (this.attackState === 'IDLE' && player.hitTimer <= 0) {
        player.action = 0; // 0 = Parado
      }
    }
  }

  /* =========================================================================
   * FASE 5: AUTO-ATTACK RESET E COMBOS MECÂNICOS
   * ========================================================================= */

  /**
   * Reseta instantaneamente o cooldown e o backswing do auto-ataque.
   * Usado ao lançar Dash ou habilidades marcadas para resetar ataque.
   */
  resetAutoAttackTimer() {
    this.attackState = 'IDLE';
    this.windupTimer = 0;
    this.backswingTimer = 0;
    this.attackRecoveryTimer = 0;
    if (this.arena?.player) {
      this.arena.player.isAttacking = false;
    }
    // Se havia um ataque em buffer, ele poderá disparar no exato próximo frame!
  }
}

if (typeof window !== 'undefined') {
  window.ActionMotionEngine = ActionMotionEngine;
}
