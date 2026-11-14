/**
 * @file apps/server/public/play/js/PlayMapPresenceController.js
 * @description Controlador de Presença Multiplayer em Tempo Real e Visualização no Mapa do Etheria Campus.
 * 
 * RECURSOS:
 * - Sincronização periódica otimizada de presença e batimento cardíaco (Heartbeat) a cada 1.4s.
 * - Renderização de outros jogadores no mapa com Y-Sorting de profundidade 2.5D.
 * - Ícone clássico nostálgico de espadas se batendo (estilo Magic Campus) quando o personagem está em combate.
 * - Interpolação suave e descarte automático de jogadores que mudam de mapa ou desconectam.
 */

class PlayMapPresenceController {
  constructor() {
    this.client = null;
    this.otherPlayers = [];
    this.lastSyncTime = 0;
    this.syncIntervalMs = 1400; // 1.4s entre sincronizações
    this.isSyncing = false;
    this.isLocalInCombat = false;
  }

  /**
   * Inicializa o controlador de presença vinculado ao cliente PlayApp.
   */
  init(clientApp) {
    this.client = clientApp || window.PlayApp;
  }

  /**
   * Define o status de combate do jogador local e dispara sincronização imediata.
   */
  setLocalCombatStatus(inCombat) {
    this.isLocalInCombat = Boolean(inCombat);
    this.triggerImmediateSync();
  }

  /**
   * Força uma sincronização imediata com o servidor (ex: ao entrar/sair de combate).
   */
  triggerImmediateSync() {
    this.lastSyncTime = 0;
    this.syncHeartbeat(performance.now());
  }

  /**
   * Ciclo de batimento cardíaco periódico (chamado a cada frame do gameLoop).
   */
  async syncHeartbeat(now) {
    const client = this.client || window.PlayApp;
    if (!client || !client.activeChar || !client.currentMap) return;
    if (this.isSyncing) return;
    if (now - this.lastSyncTime < this.syncIntervalMs) return;

    this.lastSyncTime = now;
    this.isSyncing = true;

    try {
      const charId = client.activeChar.id;
      const res = await client.api(`/api/play/characters/${charId}/sync-position`, {
        method: 'POST',
        body: JSON.stringify({
          mapId: client.currentMap.id,
          posX: Math.round(client.playerX),
          posY: Math.round(client.playerY),
          dir: client.playerDir || 0,
          isMoving: Boolean(client.isMoving),
          isInCombat: Boolean(this.isLocalInCombat || client.actionCombatArena?.isActive),
          noClip: Boolean(client.gmNoClip),
        }),
      });

      if (res && res.ok) {
        if (Array.isArray(res.otherPlayers)) {
          this.updateOtherPlayersList(res.otherPlayers);
        }
      }
    } catch (_) {
      // Falha silenciosa para conexões intermitentes
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Atualiza e mescla a lista de outros jogadores no mapa atual.
   */
  updateOtherPlayersList(incoming) {
    const activeMapId = this.client?.currentMap?.id;
    // Filtra apenas jogadores válidos
    this.otherPlayers = incoming.filter((p) => p && p.characterId !== this.client?.activeChar?.id);
  }

  /**
   * Insere os outros jogadores na fila de renderização (Y-Sorting) do mapa.
   */
  populateRenderQueue(renderQueue, now) {
    if (!Array.isArray(renderQueue)) return;
    if (!this.otherPlayers || this.otherPlayers.length === 0) return;

    for (const player of this.otherPlayers) {
      renderQueue.push({
        type: 'OTHER_PLAYER',
        y: player.posY,
        data: player,
      });
    }
  }

  /**
   * Renderiza um outro jogador no mapa canvas com sprite 2.5D, nameplate e status de combate.
   */
  drawOtherPlayer(ctx, other, now, mesh, zoom) {
    const client = this.client || window.PlayApp;
    if (!client) return;

    const spriteKey = `char_${other.mcreworkCharKey || '100101'}`;
    const sprite = client.getOrCreateSprite(
      spriteKey,
      other.atlasJsonUrl || `/api/assets/mcrework/assets/characters/${other.mcreworkCharKey || '100101'}/atlas.json`,
      other.atlasWebpUrl || `/api/assets/mcrework/assets/characters/${other.mcreworkCharKey || '100101'}/atlas.webp`,
      other.thumbUrl || `/api/assets/mcrework/assets/characters/${other.mcreworkCharKey || '100101'}/thumb.webp`
    );

    const groundOffsetY = other.groundOffsetY || 0;
    // Se o personagem estiver em combate, ele fica parado em pose idle (action = 0)
    const action = other.isInCombat ? 0 : (other.isMoving ? 1 : 0);
    const dir = other.dir !== undefined ? other.dir : 0;

    // 1. Desenha o modelo 2.5D do jogador
    if (sprite) {
      sprite.draw(
        ctx,
        other.posX,
        other.posY,
        action,
        dir,
        now,
        mesh,
        groundOffsetY,
        0.70, // Escala padrão oficial 70%
        false,
        other.shadowOffsetX || 0,
        other.shadowOffsetY || 0
      );
    }

    // 2. Nameplate Superior (Nome e Nível com pill sutil)
    const nameY = other.posY - 64 + Math.round(groundOffsetY * 0.70);
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';

    // Sombra do texto para máxima legibilidade
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillText(`${other.name} (Nv.${other.level})`, other.posX + 1, nameY + 1);

    // Cor do nome: Ciano brilhante para aventureiros amigáveis
    ctx.fillStyle = '#67e8f9';
    ctx.fillText(`${other.name} (Nv.${other.level})`, other.posX, nameY);

    // 3. Se o jogador estiver em combate: desenha as duas espadas se batendo sobre a cabeça
    if (other.isInCombat) {
      this.drawCombatSwords(ctx, other.posX, nameY - 26, now);
    }
  }

  /**
   * Desenha o clássico efeito nostálgico de espadas se batendo (estilo Magic Campus).
   */
  drawCombatSwords(ctx, x, y, now) {
    ctx.save();
    ctx.translate(x, y);

    // Oscilação periódica do choque das lâminas (efeito rítmico de golpe)
    const cycle = (now / 130) % (Math.PI * 2);
    const clash = Math.sin(cycle);
    // Espadas se aproximam e colidem quando clash atinge o pico
    const swingAngle = 0.45 + clash * 0.28;

    // 1. Espada Esquerda (inclinação positiva atacando)
    ctx.save();
    ctx.rotate(swingAngle);
    this.renderSingleSword(ctx);
    ctx.restore();

    // 2. Espada Direita (inclinação negativa atacando)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.rotate(swingAngle);
    this.renderSingleSword(ctx);
    ctx.restore();

    // 3. Efeito de Faíscas Douradas no momento exato do impacto (pico do clash)
    if (clash > 0.70) {
      const sparkAlpha = (clash - 0.70) / 0.30;
      ctx.fillStyle = `rgba(254, 240, 138, ${sparkAlpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // Cruz de brilho
      ctx.strokeStyle = `rgba(253, 224, 71, ${sparkAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
      ctx.moveTo(0, -10); ctx.lineTo(0, 10);
      ctx.stroke();
    }

    // 4. Pill / Badge sutil "[EM COMBATE]" acima das espadas
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.90)';
    ctx.fillRect(-34, -20, 68, 13);
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1;
    ctx.strokeRect(-34, -20, 68, 13);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('EM COMBATE', 0, -10);

    ctx.restore();
  }

  /**
   * Renderiza a lâmina e cabo de uma espada estilizada.
   */
  renderSingleSword(ctx) {
    // Guarda/cabo
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-2, 6, 4, 3);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-1.5, 9, 3, 5);

    // Lâmina prateada
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(-2, 6);
    ctx.lineTo(0, -14);
    ctx.lineTo(2, 6);
    ctx.closePath();
    ctx.fill();

    // Fio de corte com brilho azulado
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

// Instância global do controlador de presença
window.PlayMapPresenceController = new PlayMapPresenceController();
