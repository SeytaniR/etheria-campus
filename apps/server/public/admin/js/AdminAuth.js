/**
 * @file apps/server/public/admin/js/AdminAuth.js
 * @module @etheria/server
 * @description Submódulo de Autenticação Dual-Mode e Navegação de Abas da Rota `/admin`.
 *   Valida credenciais com proteção contra bypass externo e gerencia sessão do operador.
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
              '🟢 <strong>Acesso Localhost Detectado:</strong> Você pode entrar usando o login/senha do arquivo <code>.env</code> ou qualquer conta <code>ADMIN</code> do CRUD.';
          } else {
            banner.className = 'status-pill status-remote';
            banner.innerHTML =
              '🔒 <strong>Acesso Externo Detectado:</strong> A senha do <code>.env</code> está bloqueada por segurança. Entre com uma conta <code>ADMIN</code> cadastrada no CRUD do banco.';
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
      document.getElementById('sessionBadge').textContent = `${this.session.username} (${
        this.session.authSource === 'LOCAL_ENV' ? '.env' : 'CRUD'
      })`;

      await this.loadBootstrapData();
      await this.loadUsers();
    };

    app.switchTab = function (tab) {
      document.getElementById('tabMaps').style.display = tab === 'maps' ? 'grid' : 'none';
      document.getElementById('tabNpcs').style.display = tab === 'npcs' ? 'flex' : 'none';
      const tabQuests = document.getElementById('tabQuests');
      if (tabQuests) tabQuests.style.display = tab === 'quests' ? 'flex' : 'none';
      document.getElementById('tabClasses').style.display = tab === 'classes' ? 'flex' : 'none';
      const tabMonsters = document.getElementById('tabMonsters');
      if (tabMonsters) tabMonsters.style.display = tab === 'monsters' ? 'flex' : 'none';
      const tabSkills = document.getElementById('tabSkills');
      if (tabSkills) tabSkills.style.display = tab === 'skills' ? 'flex' : 'none';
      const tabStatusEffects = document.getElementById('tabStatusEffects');
      if (tabStatusEffects) tabStatusEffects.style.display = tab === 'status-effects' ? 'flex' : 'none';
      document.getElementById('tabUsers').style.display = tab === 'users' ? 'flex' : 'none';

      document.getElementById('tabBtnMaps').className = tab === 'maps' ? 'btn-primary' : '';
      document.getElementById('tabBtnNpcs').className = tab === 'npcs' ? 'btn-primary' : '';
      const btnQuests = document.getElementById('tabBtnQuests');
      if (btnQuests) btnQuests.className = tab === 'quests' ? 'btn-primary' : '';
      document.getElementById('tabBtnClasses').className = tab === 'classes' ? 'btn-primary' : '';
      const btnMonsters = document.getElementById('tabBtnMonsters');
      if (btnMonsters) btnMonsters.className = tab === 'monsters' ? 'btn-primary' : '';
      const btnSkills = document.getElementById('tabBtnSkills');
      if (btnSkills) btnSkills.className = tab === 'skills' ? 'btn-primary' : '';
      const btnStatus = document.getElementById('tabBtnStatusEffects');
      if (btnStatus) btnStatus.className = tab === 'status-effects' ? 'btn-primary' : '';
      document.getElementById('tabBtnUsers').className = tab === 'users' ? 'btn-primary' : '';

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
      if (tab === 'skills' && typeof this.renderSkillsCrudTable === 'function') {
        this.renderSkillsCrudTable();
      }
      if (tab === 'status-effects' && typeof this.renderStatusEffectsCrudTable === 'function') {
        this.renderStatusEffectsCrudTable();
      }
    };
  }
}

window.AdminAuth = AdminAuth;
