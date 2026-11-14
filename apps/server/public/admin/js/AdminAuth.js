/**
 * @file apps/server/public/admin/js/AdminAuth.js
 * @module @etheria/server
 * @description Submódulo de Autenticação Dual-Mode e Navegação de Abas da Rota `/admin`.
 *   Gerencia hierarquia de permissões (DEV Master vs ADMIN Controlado por Tabela).
 */

class AdminAuth {
  static attach(app) {
    app.api = async function (path, options = {}) {
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
    };

    app.checkAuthContext = async function () {
      try {
        const ctx = await this.api('/api/admin/auth/context');
        this.isStrictLocalhost = ctx.isStrictLocalhost;

        const banner = document.getElementById('authContextBanner');
        if (banner) {
          if (ctx.isStrictLocalhost) {
            banner.className = 'status-pill status-local';
            banner.innerHTML =
              '🟢 <strong>Acesso Localhost Detectado:</strong> Você pode entrar usando a senha do <code>.env</code> (DEV Master) ou contas cadastradas no banco.';
          } else {
            banner.className = 'status-pill status-remote';
            banner.innerHTML =
              '🔒 <strong>Acesso Externo Detectado:</strong> A senha do <code>.env</code> está bloqueada. Entre com uma conta <code>DEV</code> ou <code>ADMIN</code> cadastrada no banco.';
          }
        }

        if (ctx.authenticated && ctx.session) {
          this.session = ctx.session;
          await this.enterStudio();
        }
      } catch (err) {
        console.error(err);
      }
    };

    app.login = async function () {
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      const errBox = document.getElementById('loginError');
      if (errBox) errBox.style.display = 'none';

      try {
        const res = await this.api('/api/admin/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });
        this.token = res.token;
        this.session = res.session;
        localStorage.setItem('etheria_admin_token', this.token);
        await this.enterStudio();
      } catch (err) {
        if (errBox) {
          errBox.textContent = err.message;
          errBox.style.display = 'block';
        }
      }
    };

    app.logout = function () {
      this.token = '';
      this.session = null;
      localStorage.removeItem('etheria_admin_token');
      document.getElementById('visualMapEditorScreen').style.display = 'none';
      document.getElementById('adminApp').style.display = 'none';
      document.getElementById('loginScreen').style.display = 'flex';
      this.checkAuthContext();
    };

    app.enterStudio = async function () {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('adminApp').style.display = 'flex';

      const isDev = this.session?.role === 'DEV';
      const roleIcon = isDev ? '👑' : '🛡️';
      const roleColor = isDev ? '#fde047' : '#93c5fd';
      const roleBg = isDev ? 'rgba(168,85,247,0.3)' : 'rgba(30,58,138,0.3)';
      const roleBorder = isDev ? '#a855f7' : '#3b82f6';

      const badge = document.getElementById('sessionBadge');
      if (badge) {
        badge.innerHTML = `<span style="padding:2px 8px; border-radius:99px; background:${roleBg}; color:${roleColor}; border:1px solid ${roleBorder}; font-weight:700; font-size:0.75rem;">${roleIcon} ${this.session.role}: ${this.session.username}</span>`;
      }

      this.applyTablePermissions();

      await this.loadBootstrapData();
      await this.loadUsers();
    };

    /**
     * Aplica as permissões da sessão do operador na interface:
     * - DEV: visualiza e acessa todas as abas sem qualquer restrição.
     * - ADMIN: esconde abas marcadas como NONE e restringe abas marcadas como READ.
     */
    app.applyTablePermissions = function () {
      if (!this.session) return;
      const isDev = this.session.role === 'DEV';
      const perms = this.session.tablePermissions || {};

      const tabMap = {
        maps: 'MAPS',
        'world-maps': 'MAPS',
        npcs: 'NPCS',
        classes: 'CLASSES',
        monsters: 'MONSTERS',
        'ui-layouts': 'MAPS',
        equipments: 'MONSTERS',
        items: 'MONSTERS',
        mounts: 'MONSTERS',
        experience: 'ATTRIBUTES',
        attributes: 'ATTRIBUTES',
        skills: 'SKILLS',
        'status-effects': 'STATUS_EFFECTS',
        quests: 'QUESTS',
        users: 'USERS',
      };

      const btnMap = {
        maps: document.getElementById('tabBtnMaps'),
        'world-maps': document.getElementById('tabBtnWorldMaps'),
        npcs: document.getElementById('tabBtnNpcs'),
        classes: document.getElementById('tabBtnClasses'),
        monsters: document.getElementById('tabBtnMonsters'),
        'ui-layouts': document.getElementById('tabBtnUiLayouts'),
        equipments: document.getElementById('tabBtnEquipments'),
        items: document.getElementById('tabBtnItems'),
        mounts: document.getElementById('tabBtnFlyingMounts'),
        experience: document.getElementById('tabBtnExperience'),
        attributes: document.getElementById('tabBtnAttributes'),
        skills: document.getElementById('tabBtnSkills'),
        'status-effects': document.getElementById('tabBtnStatusEffects'),
        quests: document.getElementById('tabBtnQuests'),
        users: document.getElementById('tabBtnUsers'),
      };

      if (btnMap.users) {
        btnMap.users.textContent = isDev ? '🔐 Contas & Permissões' : '🛡️ Minha Conta';
      }

      for (const [tabKey, tableCode] of Object.entries(tabMap)) {
        const btn = btnMap[tabKey];
        if (!btn) continue;

        if (isDev || tabKey === 'users') {
          btn.style.display = 'inline-block';
          continue;
        }

        const perm = perms[tableCode] || 'NONE';
        if (perm === 'NONE') {
          btn.style.display = 'none';
        } else {
          btn.style.display = 'inline-block';
        }
      }

      // Se a aba atual estiver bloqueada, chaveia para a primeira permitida
      const currentTab = this.activeTab || 'maps';
      const currentCode = tabMap[currentTab];
      if (!isDev && currentTab !== 'users' && perms[currentCode] === 'NONE') {
        const firstAllowed = Object.keys(tabMap).find(
          (k) => k === 'users' || perms[tabMap[k]] !== 'NONE'
        );
        if (firstAllowed) {
          this.switchTab(firstAllowed);
        }
      }
    };

    app.switchTab = function (tab) {
      this.activeTab = tab;

      const tabs = [
        { id: 'tabMaps', btn: 'tabBtnMaps', key: 'maps', code: 'MAPS' },
        { id: 'tabWorldMaps', btn: 'tabBtnWorldMaps', key: 'world-maps', code: 'MAPS' },
        { id: 'tabNpcs', btn: 'tabBtnNpcs', key: 'npcs', code: 'NPCS' },
        { id: 'tabQuests', btn: 'tabBtnQuests', key: 'quests', code: 'QUESTS' },
        { id: 'tabClasses', btn: 'tabBtnClasses', key: 'classes', code: 'CLASSES' },
        { id: 'tabMonsters', btn: 'tabBtnMonsters', key: 'monsters', code: 'MONSTERS' },
        { id: 'tabUiLayouts', btn: 'tabBtnUiLayouts', key: 'ui-layouts', code: 'MAPS' },
        { id: 'tabEquipments', btn: 'tabBtnEquipments', key: 'equipments', code: 'MONSTERS' },
        { id: 'tabItems', btn: 'tabBtnItems', key: 'items', code: 'MONSTERS' },
        { id: 'tabFlyingMounts', btn: 'tabBtnFlyingMounts', key: 'mounts', code: 'MONSTERS' },
        { id: 'tabExperience', btn: 'tabBtnExperience', key: 'experience', code: 'ATTRIBUTES' },
        { id: 'tabSkills', btn: 'tabBtnSkills', key: 'skills', code: 'SKILLS' },
        { id: 'tabStatusEffects', btn: 'tabBtnStatusEffects', key: 'status-effects', code: 'STATUS_EFFECTS' },
        { id: 'tabAttributes', btn: 'tabBtnAttributes', key: 'attributes', code: 'ATTRIBUTES' },
        { id: 'tabUsers', btn: 'tabBtnUsers', key: 'users', code: 'USERS' },
      ];

      for (const t of tabs) {
        const el = document.getElementById(t.id);
        const btn = document.getElementById(t.btn);
        const isActive = tab === t.key;
        if (el) {
          el.style.display = isActive ? (t.key === 'maps' ? 'grid' : 'flex') : 'none';
        }
        if (btn) {
          btn.className = isActive ? 'btn-primary' : '';
        }
      }

      // Alerta visual de Somente Leitura se for ADMIN com permissão READ
      this.renderReadOnlyIndicator(tab);

      if (tab === 'npcs') {
        this.renderNpcsCrudTable();
      }
      if (tab === 'quests' && typeof this.renderQuestsCrudTable === 'function') {
        this.renderQuestsCrudTable();
      }
      if (tab === 'classes') {
        this.renderClassesCrudTable();
      }
      if (tab === 'monsters' && typeof this.renderMonstersCrudTable === 'function') {
        this.renderMonstersCrudTable();
      }
      if (tab === 'ui-layouts' && typeof this.renderUiLayoutsCrudTable === 'function') {
        this.renderUiLayoutsCrudTable();
      }
      if (tab === 'equipments' && typeof this.renderEquipmentsCrudTable === 'function') {
        this.renderEquipmentsCrudTable();
      }
      if (tab === 'items' && typeof this.renderItemsCrudTable === 'function') {
        this.renderItemsCrudTable();
      }
      if (tab === 'mounts' && typeof this.renderFlyingMountsCrudTable === 'function') {
        this.renderFlyingMountsCrudTable();
      }
      if (tab === 'experience' && typeof this.renderExperienceCrudTable === 'function') {
        this.renderExperienceCrudTable();
        if (typeof this.renderXpCurveCanvas === 'function') this.renderXpCurveCanvas();
      }
      if (tab === 'skills' && typeof this.renderSkillsCrudTable === 'function') {
        this.renderSkillsCrudTable();
      }
      if (tab === 'status-effects' && typeof this.renderStatusEffectsCrudTable === 'function') {
        this.renderStatusEffectsCrudTable();
      }
      if (tab === 'attributes' && typeof this.renderAttributesTabContent === 'function') {
        this.renderAttributesTabContent();
      }
      if (tab === 'world-maps' && typeof this.loadWorldMapsData === 'function') {
        this.loadWorldMapsData();
      }
    };

    /**
     * Renderiza banner indicativo de Somente Leitura em abas onde o ADMIN só tem acesso READ.
     */
    app.renderReadOnlyIndicator = function (tabKey) {
      const bannerId = `readonly_banner_${tabKey}`;
      const existing = document.getElementById(bannerId);
      if (existing) existing.remove();

      if (!this.session || this.session.role === 'DEV' || tabKey === 'users') {
        return;
      }

      const tabMap = {
        maps: 'MAPS',
        'world-maps': 'MAPS',
        npcs: 'NPCS',
        classes: 'CLASSES',
        monsters: 'MONSTERS',
        'ui-layouts': 'MAPS',
        equipments: 'MONSTERS',
        items: 'MONSTERS',
        mounts: 'MONSTERS',
        experience: 'ATTRIBUTES',
        attributes: 'ATTRIBUTES',
        skills: 'SKILLS',
        'status-effects': 'STATUS_EFFECTS',
        quests: 'QUESTS',
      };

      const code = tabMap[tabKey];
      const perm = this.session.tablePermissions?.[code];

      if (perm === 'READ') {
        const containerMap = {
          maps: document.getElementById('tabMaps'),
          'world-maps': document.getElementById('tabWorldMaps'),
          npcs: document.getElementById('tabNpcs'),
          classes: document.getElementById('tabClasses'),
          monsters: document.getElementById('tabMonsters'),
          'ui-layouts': document.getElementById('tabUiLayouts'),
          equipments: document.getElementById('tabEquipments'),
          items: document.getElementById('tabItems'),
          attributes: document.getElementById('tabAttributes'),
          skills: document.getElementById('tabSkills'),
          'status-effects': document.getElementById('tabStatusEffects'),
          quests: document.getElementById('tabQuests'),
        };

        const targetEl = containerMap[tabKey];
        if (targetEl) {
          const banner = document.createElement('div');
          banner.id = bannerId;
          banner.style.cssText =
            'background:rgba(234,179,8,0.15); border:1.5px solid #eab308; color:#fde047; padding:8px 12px; border-radius:8px; font-size:0.78rem; font-weight:600; display:flex; align-items:center; gap:8px; margin-bottom:8px; width:100%; box-sizing:border-box;';
          banner.innerHTML =
            '🔒 <strong>Modo Somente Leitura:</strong> O Desenvolvedor (DEV) liberou apenas visualização para esta tabela. Criações, edições e exclusões estão bloqueadas.';
          targetEl.insertBefore(banner, targetEl.firstChild);
        }
      }
    };
  }
}

window.AdminAuth = AdminAuth;
