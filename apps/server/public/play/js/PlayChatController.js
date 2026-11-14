/**
 * @file apps/server/public/play/js/PlayChatController.js
 * @description Controlador do Chat Multi-Canal em Tempo Real do Etheria Campus.
 * 
 * CANAIS SUPORTADOS:
 * - SISTEMA: Mensagens oficiais do servidor (anúncios, level-up). Visualizadas em todos os canais!
 * - MUNDO: Chat global entre todos os jogadores.
 * - LOCAL: Chat do mapa atual.
 * - GUILDA: Chat da guilda.
 * - FACÇÃO: Chat da facção.
 * - EQUIPE: Chat da equipe de aventureiros.
 * 
 * RECURSOS:
 * - Filtros personalizáveis pelo jogador (canais ativos, propagação de sistema, timestamp, tamanho da fonte).
 * - Integração autoritária com moderação 16+ (censura de palavrões e bloqueio de ódio).
 * - Scroll inteligente e persistência de preferências em localStorage.
 */

class PlayChatController {
  constructor() {
    this.client = null;
    this.activeCategory = 'MUNDO';
    this.messages = [];
    this.lastMessageId = 0;
    this.pollInterval = null;
    this.isPolling = false;
    this.isCollapsed = false;

    // Preferências padrão do jogador
    this.settings = {
      showSystemInAllChannels: true,
      categories: {
        SISTEMA: true,
        MUNDO: true,
        LOCAL: true,
        GUILDA: true,
        FACCÃO: true,
        EQUIPE: true,
      },
      showTimestamp: true,
      fontSize: 'medium', // 'small' | 'medium' | 'large'
      backgroundOpacity: 0.90,
      chatHeight: 125, // px
    };

    this.CATEGORIES = [
      { id: 'MUNDO', label: 'Mundo', badgeClass: 'msg-mundo', color: '#38bdf8' },
      { id: 'LOCAL', label: 'Local', badgeClass: 'msg-local', color: '#4ade80' },
      { id: 'GUILDA', label: 'Guilda', badgeClass: 'msg-guilda', color: '#c084fc' },
      { id: 'FACCÃO', label: 'Facção', badgeClass: 'msg-faccao', color: '#fb923c' },
      { id: 'EQUIPE', label: 'Equipe', badgeClass: 'msg-equipe', color: '#22d3ee' },
      { id: 'SISTEMA', label: 'Sistema', badgeClass: 'msg-system', color: '#fbbf24' },
    ];
  }

  /**
   * Inicializa o controlador de chat vinculado à instância do cliente.
   */
  init(clientApp) {
    this.client = clientApp;
    this.loadSettings();
    this.renderChatHtml();
    this.bindEvents();
    this.applySettingsToDom();
    this.startPolling();
  }

  /**
   * Carrega preferências de chat salvas no localStorage.
   */
  loadSettings() {
    try {
      const charId = this.client?.activeChar?.id || 'default';
      const saved = localStorage.getItem(`etheria_chat_settings_${charId}`) || localStorage.getItem('etheria_chat_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = {
          ...this.settings,
          ...parsed,
          categories: { ...this.settings.categories, ...(parsed.categories || {}) },
        };
      }
    } catch (e) {
      console.warn('Erro ao carregar preferências de chat:', e);
    }
  }

  /**
   * Salva preferências de chat no localStorage.
   */
  saveSettings() {
    try {
      const charId = this.client?.activeChar?.id || 'default';
      localStorage.setItem(`etheria_chat_settings_${charId}`, JSON.stringify(this.settings));
      localStorage.setItem('etheria_chat_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Erro ao salvar preferências de chat:', e);
    }
  }

  /**
   * Renderiza a estrutura interna do chat (#hudChatSection).
   */
  renderChatHtml() {
    let section = document.getElementById('hudChatSection');
    if (!section) return;

    section.innerHTML = `
      <div class="hud-chat-header">
        <div class="hud-chat-tabs" id="hudChatTabsContainer">
          ${this.CATEGORIES.map(
            (c) => `<button type="button" class="hud-chat-tab ${c.id === this.activeCategory ? 'active' : ''}" data-channel="${c.id}">${c.label}</button>`
          ).join('')}
        </div>
        <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
          <button type="button" id="hudChatSettingsBtn" class="hud-chat-toggle-btn" title="Configurações e Filtros de Chat">⚙️</button>
          <button type="button" id="hudCollapseChatBtn" class="hud-chat-toggle-btn" title="Minimizar / Expandir Chat">
            <span id="hudChatToggleIcon">▼</span>
          </button>
        </div>
      </div>
      <div id="hudChatBody" class="hud-chat-body">
        <div id="hudChatMessages" class="hud-chat-messages"></div>
        <div class="hud-chat-input-row">
          <span id="hudChatChannelPill" class="hud-chat-channel-pill" style="color:#38bdf8; font-size:0.62rem; font-weight:800; padding:2px 4px; background:rgba(30,41,59,0.8); border-radius:4px;">[Mundo]</span>
          <input type="text" id="hudChatInput" class="hud-chat-input" placeholder="[Mundo] Digite sua mensagem..." maxlength="160" />
          <button type="button" id="hudChatSendBtn" class="hud-chat-send-btn" title="Enviar Mensagem">➤</button>
        </div>
      </div>
    `;

    this.ensureSettingsModal();
  }

  /**
   * Vincula ouvintes de eventos da interface de chat.
   */
  bindEvents() {
    const section = document.getElementById('hudChatSection');
    if (!section) return;

    // 1. Alternância de abas de canais
    const tabs = section.querySelectorAll('.hud-chat-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const cat = tab.getAttribute('data-channel');
        if (cat) this.switchChannel(cat);
      });
    });

    // 2. Botão de minimizar/expandir
    const collapseBtn = document.getElementById('hudCollapseChatBtn');
    const toggleIcon = document.getElementById('hudChatToggleIcon');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.isCollapsed = section.classList.toggle('is-collapsed');
        if (toggleIcon) toggleIcon.textContent = this.isCollapsed ? '💬' : '▼';
      });
    }

    // 3. Botão de configurações de chat
    const settingsBtn = document.getElementById('hudChatSettingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.openSettingsModal();
      });
    }

    // 4. Envio de mensagem (Botão e Enter)
    const sendBtn = document.getElementById('hudChatSendBtn');
    const chatInput = document.getElementById('hudChatInput');
    if (sendBtn) {
      sendBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.handleSendMessage();
      });
    }

    if (chatInput) {
      chatInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          this.handleSendMessage();
        }
      });
    }
  }

  /**
   * Alterna o canal ativo do chat.
   */
  switchChannel(category) {
    this.activeCategory = category;

    // Atualiza classes ativas nas abas
    const tabs = document.querySelectorAll('#hudChatTabsContainer .hud-chat-tab');
    tabs.forEach((t) => {
      if (t.getAttribute('data-channel') === category) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    // Atualiza indicador de canal no input
    const pill = document.getElementById('hudChatChannelPill');
    const input = document.getElementById('hudChatInput');
    const catObj = this.CATEGORIES.find((c) => c.id === category);
    const catLabel = catObj?.label || category;
    const catColor = catObj?.color || '#38bdf8';

    if (pill) {
      pill.textContent = `[${catLabel}]`;
      pill.style.color = catColor;
    }

    if (input) {
      if (category === 'SISTEMA') {
        input.placeholder = '[Sistema] Somente leitura (anúncios)';
      } else {
        input.placeholder = `[${catLabel}] Digite sua mensagem...`;
      }
    }

    this.renderMessages();
  }

  /**
   * Inicia o ciclo de polling autoritário do chat.
   */
  startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.fetchMessages(); // Primeira busca imediata

    this.pollInterval = setInterval(() => {
      this.fetchMessages();
    }, 1600);
  }

  /**
   * Para o polling do chat.
   */
  stopPolling() {
    this.isPolling = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Busca mensagens recentes do servidor via API autoritária.
   */
  async fetchMessages() {
    if (!this.client || !this.client.api) return;

    try {
      const mapId = this.client.currentMapId || this.client.activeChar?.currentMapId || 1;
      const url = `/api/play/chat/messages?sinceId=${this.lastMessageId}&mapId=${mapId}`;
      const res = await this.client.api(url);

      if (res && res.success && Array.isArray(res.messages)) {
        if (res.messages.length > 0) {
          res.messages.forEach((msg) => {
            if (!this.messages.some((m) => m.id === msg.id)) {
              this.messages.push(msg);
              if (msg.id > this.lastMessageId) {
                this.lastMessageId = msg.id;
              }
            }
          });

          // Mantém buffer local compacto
          if (this.messages.length > 300) {
            this.messages.splice(0, this.messages.length - 300);
          }

          this.renderMessages();
        }
      }
    } catch (err) {
      // Falha silenciosa para não quebrar a HUD durante teleporte/mapa
    }
  }

  /**
   * Envia uma mensagem digitada pelo jogador.
   */
  async handleSendMessage() {
    const input = document.getElementById('hudChatInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    if (this.activeCategory === 'SISTEMA') {
      this.addSystemNotice('O canal Sistema é exclusivo para anúncios do servidor. Selecione Mundo ou Local para conversar.');
      return;
    }

    const charId = this.client?.activeChar?.id;
    if (!charId) {
      this.addSystemNotice('Você precisa selecionar um personagem para falar no chat.');
      return;
    }

    const mapId = this.client.currentMapId || this.client.activeChar?.currentMapId || 1;

    try {
      input.value = '';
      const res = await this.client.api('/api/play/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          channel: this.activeCategory,
          message: text,
          charId,
          mapId,
        }),
      });

      if (res && res.success) {
        if (res.message) {
          this.messages.push(res.message);
          if (res.message.id > this.lastMessageId) {
            this.lastMessageId = res.message.id;
          }
          this.renderMessages();
        }
        await this.fetchMessages();
      }
    } catch (err) {
      this.addSystemNotice(err.message || 'Erro ao enviar mensagem.');
    } finally {
      input.focus();
    }
  }

  /**
   * Adiciona um aviso local do sistema na interface de mensagens.
   */
  addSystemNotice(noticeText) {
    this.messages.push({
      id: --this.lastMessageId, // Id temporário local negativo
      category: 'SISTEMA',
      senderName: 'Sistema',
      text: noticeText,
      timestamp: Date.now(),
    });
    this.renderMessages();
  }

  /**
   * Renderiza as mensagens no DOM respeitando os filtros do jogador e da aba ativa.
   */
  renderMessages() {
    const container = document.getElementById('hudChatMessages');
    if (!container) return;

    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 40;

    // Filtra mensagens conforme as regras
    const visible = this.messages.filter((msg) => {
      // 1. Verifica se a categoria da mensagem está desativada nas configurações do jogador
      if (this.settings.categories[msg.category] === false) {
        return false;
      }

      // 2. Se a aba ativa for SISTEMA, mostra apenas mensagens de SISTEMA
      if (this.activeCategory === 'SISTEMA') {
        return msg.category === 'SISTEMA';
      }

      // 3. Regra Especial de Sistema: mensagens de SISTEMA aparecem em todas as outras abas
      // (conforme especificação: "sistema - suas mensagens são visualizadas em todos os outros chats tbm")
      if (msg.category === 'SISTEMA') {
        return this.settings.showSystemInAllChannels;
      }

      // 4. Nas outras abas, mostra mensagens correspondentes à aba ativa
      return msg.category === this.activeCategory;
    });

    if (visible.length === 0) {
      container.innerHTML = `<div style="color:#64748b; font-style:italic; font-size:0.64rem; padding:4px 0;">Nenhuma mensagem neste canal ainda.</div>`;
      return;
    }

    container.innerHTML = visible
      .map((msg) => this.formatMessageHtml(msg))
      .join('');

    if (isAtBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Formata o HTML de uma única mensagem com badges e estilos.
   */
  formatMessageHtml(msg) {
    const cat = msg.category || 'MUNDO';
    const catObj = this.CATEGORIES.find((c) => c.id === cat) || { label: cat, badgeClass: 'msg-mundo', color: '#38bdf8' };

    const timeHtml = this.settings.showTimestamp
      ? `<span class="chat-time" style="color:#64748b; font-size:0.60rem; margin-right:3px;">${this.formatTime(msg.timestamp)}</span>`
      : '';

    const badgeHtml = `<span class="chat-badge ${catObj.badgeClass}" style="color:${catObj.color}; font-weight:800; margin-right:4px;">[${catObj.label}]</span>`;

    const isSystem = cat === 'SISTEMA';
    let authorHtml = '';
    if (!isSystem && msg.senderName) {
      authorHtml = `<strong class="chat-author" style="color:#f8fafc; margin-right:3px;">${this.escapeHtml(msg.senderName)}:</strong>`;
    }

    const textStyle = isSystem ? 'color:#fde047; font-weight:600;' : 'color:#e2e8f0;';
    const textHtml = `<span class="chat-text" style="${textStyle}">${this.escapeHtml(msg.text)}</span>`;

    return `<div class="hud-chat-msg ${catObj.badgeClass}" style="margin-bottom:3px; word-break:break-word; line-height:1.35;">${timeHtml}${badgeHtml}${authorHtml}${textHtml}</div>`;
  }

  /**
   * Formata timestamp em HH:MM.
   */
  formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * Escapa caracteres perigosos para prevenir ataques XSS.
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Aplica configurações visuais aos nós da HUD de Chat.
   */
  applySettingsToDom() {
    const section = document.getElementById('hudChatSection');
    const body = document.getElementById('hudChatBody');
    const messages = document.getElementById('hudChatMessages');

    if (section) {
      section.style.background = `linear-gradient(180deg, rgba(15, 23, 42, ${this.settings.backgroundOpacity}), rgba(8, 13, 25, ${Math.min(1, this.settings.backgroundOpacity + 0.06)}))`;
    }

    if (body) {
      body.style.height = `${this.settings.chatHeight || 125}px`;
    }

    if (messages) {
      let fSize = '0.68rem';
      if (this.settings.fontSize === 'small') fSize = '0.62rem';
      if (this.settings.fontSize === 'large') fSize = '0.78rem';
      messages.style.fontSize = fSize;
    }
  }

  /**
   * Garante a criação do modal de Configurações e Filtros de Chat.
   */
  ensureSettingsModal() {
    if (document.getElementById('chatSettingsModal')) return;

    const modal = document.createElement('div');
    modal.id = 'chatSettingsModal';
    modal.className = 'play-modal-backdrop';
    modal.style.display = 'none';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.zIndex = '9999';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.backdropFilter = 'blur(4px)';

    modal.innerHTML = `
      <div style="background:#0f172a; border:2px solid #eab308; border-radius:12px; width:92%; max-width:440px; padding:16px; color:#e2e8f0; box-shadow:0 10px 25px rgba(0,0,0,0.8); display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #334155; padding-bottom:8px;">
          <h3 style="margin:0; font-size:1rem; color:#fde047; display:flex; align-items:center; gap:6px;">
            <span>⚙️</span> Configurações e Filtros de Chat
          </h3>
          <button type="button" id="btnCloseChatSettingsModal" style="background:transparent; border:none; color:#94a3b8; font-size:1.1rem; cursor:pointer;">✕</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px; max-height:360px; overflow-y:auto; padding-right:4px;">
          <!-- Seção 1: Filtro de Canais Visíveis -->
          <div>
            <div style="font-size:0.78rem; font-weight:700; color:#38bdf8; margin-bottom:6px;">📡 Canais Habilitados:</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.75rem;">
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="chkCatSistema" /> <span style="color:#fbbf24;">[Sistema]</span>
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="chkCatMundo" /> <span style="color:#38bdf8;">[Mundo]</span>
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="chkCatLocal" /> <span style="color:#4ade80;">[Local]</span>
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="chkCatGuilda" /> <span style="color:#c084fc;">[Guilda]</span>
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="chkCatFaccao" /> <span style="color:#fb923c;">[Facção]</span>
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="chkCatEquipe" /> <span style="color:#22d3ee;">[Equipe]</span>
              </label>
            </div>
          </div>

          <!-- Seção 2: Regras Especiais de Sistema -->
          <div style="background:rgba(30,41,59,0.5); padding:8px; border-radius:6px; border:1px solid rgba(234,179,8,0.2);">
            <label style="display:flex; align-items:center; gap:8px; font-size:0.75rem; cursor:pointer;">
              <input type="checkbox" id="chkShowSystemAll" />
              <span>Exibir mensagens do <strong>Sistema</strong> em todas as abas</span>
            </label>
            <div style="font-size:0.64rem; color:#94a3b8; margin-top:3px; padding-left:22px;">
              Anúncios de level-up, eventos e avisos oficiais aparecerão nos chats Mundo, Local, etc.
            </div>
          </div>

          <!-- Seção 3: Visual e Tamanho de Fonte -->
          <div style="display:flex; flex-direction:column; gap:8px; font-size:0.75rem;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="chkShowTimestamp" />
              <span>Exibir Horário das Mensagens [HH:MM]</span>
            </label>

            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <span>Tamanho da Fonte:</span>
              <select id="selChatFontSize" style="background:#1e293b; color:#f8fafc; border:1px solid #475569; border-radius:4px; padding:3px 6px; font-size:0.75rem;">
                <option value="small">Pequeno (11px)</option>
                <option value="medium">Médio (12px)</option>
                <option value="large">Grande (14px)</option>
              </select>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <span>Altura do Chat:</span>
              <select id="selChatHeight" style="background:#1e293b; color:#f8fafc; border:1px solid #475569; border-radius:4px; padding:3px 6px; font-size:0.75rem;">
                <option value="100">Compacto (100px)</option>
                <option value="125">Padrão (125px)</option>
                <option value="170">Expandido (170px)</option>
              </select>
            </div>
          </div>

          <!-- Seção 4: Moderação 16+ -->
          <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:6px; padding:8px; font-size:0.70rem; color:#fca5a5;">
            🛡️ <strong>Filtro de Conduta 16+ Ativo no Servidor:</strong> Discurso de ódio, discriminação e ameaças são bloqueados. Palavrões pesados são automaticamente censurados por asteriscos.
          </div>
        </div>

        <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; border-top:1px solid #334155; padding-top:8px;">
          <button type="button" id="btnResetChatSettings" style="padding:6px 12px; background:#334155; color:#cbd5e1; border:none; border-radius:6px; font-size:0.75rem; cursor:pointer;">↺ Padrão</button>
          <button type="button" id="btnSaveChatSettings" style="padding:6px 14px; background:linear-gradient(135deg,#eab308,#ca8a04); color:#020617; font-weight:800; border:none; border-radius:6px; font-size:0.75rem; cursor:pointer;">💾 Salvar Preferências</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Eventos do modal
    const closeBtn = document.getElementById('btnCloseChatSettingsModal');
    if (closeBtn) closeBtn.onclick = () => this.closeSettingsModal();
    modal.onclick = (e) => {
      if (e.target === modal) this.closeSettingsModal();
    };

    const saveBtn = document.getElementById('btnSaveChatSettings');
    if (saveBtn) {
      saveBtn.onclick = () => {
        this.saveModalSettings();
        this.closeSettingsModal();
      };
    }

    const resetBtn = document.getElementById('btnResetChatSettings');
    if (resetBtn) {
      resetBtn.onclick = () => {
        this.resetDefaultSettings();
      };
    }
  }

  /**
   * Abre o modal de configurações e preenche os campos com o estado atual.
   */
  openSettingsModal() {
    this.ensureSettingsModal();
    const modal = document.getElementById('chatSettingsModal');
    if (!modal) return;

    // Preenche checkboxes de canais
    const chkSistema = document.getElementById('chkCatSistema');
    const chkMundo = document.getElementById('chkCatMundo');
    const chkLocal = document.getElementById('chkCatLocal');
    const chkGuilda = document.getElementById('chkCatGuilda');
    const chkFaccao = document.getElementById('chkCatFaccao');
    const chkEquipe = document.getElementById('chkCatEquipe');

    if (chkSistema) chkSistema.checked = this.settings.categories.SISTEMA !== false;
    if (chkMundo) chkMundo.checked = this.settings.categories.MUNDO !== false;
    if (chkLocal) chkLocal.checked = this.settings.categories.LOCAL !== false;
    if (chkGuilda) chkGuilda.checked = this.settings.categories.GUILDA !== false;
    if (chkFaccao) chkFaccao.checked = this.settings.categories.FACCÃO !== false;
    if (chkEquipe) chkEquipe.checked = this.settings.categories.EQUIPE !== false;

    // Regra especial de sistema
    const chkSysAll = document.getElementById('chkShowSystemAll');
    if (chkSysAll) chkSysAll.checked = this.settings.showSystemInAllChannels !== false;

    // Timestamp
    const chkTime = document.getElementById('chkShowTimestamp');
    if (chkTime) chkTime.checked = this.settings.showTimestamp !== false;

    // Fonte e Altura
    const selFont = document.getElementById('selChatFontSize');
    if (selFont) selFont.value = this.settings.fontSize || 'medium';

    const selHeight = document.getElementById('selChatHeight');
    if (selHeight) selHeight.value = String(this.settings.chatHeight || 125);

    modal.style.display = 'flex';
  }

  /**
   * Fecha o modal de configurações de chat.
   */
  closeSettingsModal() {
    const modal = document.getElementById('chatSettingsModal');
    if (modal) modal.style.display = 'none';
  }

  /**
   * Salva os valores configurados no modal de volta para as preferências e DOM.
   */
  saveModalSettings() {
    const chkSistema = document.getElementById('chkCatSistema');
    const chkMundo = document.getElementById('chkCatMundo');
    const chkLocal = document.getElementById('chkCatLocal');
    const chkGuilda = document.getElementById('chkCatGuilda');
    const chkFaccao = document.getElementById('chkCatFaccao');
    const chkEquipe = document.getElementById('chkCatEquipe');
    const chkSysAll = document.getElementById('chkShowSystemAll');
    const chkTime = document.getElementById('chkShowTimestamp');
    const selFont = document.getElementById('selChatFontSize');
    const selHeight = document.getElementById('selChatHeight');

    this.settings.categories = {
      SISTEMA: Boolean(chkSistema?.checked),
      MUNDO: Boolean(chkMundo?.checked),
      LOCAL: Boolean(chkLocal?.checked),
      GUILDA: Boolean(chkGuilda?.checked),
      FACCÃO: Boolean(chkFaccao?.checked),
      EQUIPE: Boolean(chkEquipe?.checked),
    };

    this.settings.showSystemInAllChannels = Boolean(chkSysAll?.checked);
    this.settings.showTimestamp = Boolean(chkTime?.checked);
    this.settings.fontSize = selFont?.value || 'medium';
    this.settings.chatHeight = Number(selHeight?.value) || 125;

    this.saveSettings();
    this.applySettingsToDom();
    this.renderMessages();
  }

  /**
   * Restaura preferências para o padrão oficial do jogo.
   */
  resetDefaultSettings() {
    this.settings = {
      showSystemInAllChannels: true,
      categories: {
        SISTEMA: true,
        MUNDO: true,
        LOCAL: true,
        GUILDA: true,
        FACCÃO: true,
        EQUIPE: true,
      },
      showTimestamp: true,
      fontSize: 'medium',
      backgroundOpacity: 0.90,
      chatHeight: 125,
    };

    this.saveSettings();
    this.applySettingsToDom();
    this.openSettingsModal(); // Atualiza os inputs do modal aberto
    this.renderMessages();
  }
}

// Instância global disponível para o cliente
window.PlayChatController = new PlayChatController();
