/**
 * @file apps/server/public/admin/js/AdminUsersTab.js
 * @module @etheria/server
 * @description Submódulo de Gestão de Contas, Roles (`DEV` vs `ADMIN`) e Matriz de Permissões por Tabela.
 * @rules
 *   - DEV tem controle total e define o que cada ADMIN pode ver ou editar em cada tabela.
 *   - ADMIN só pode alterar dados da sua própria conta (username, email, senha).
 */

class AdminUsersTab {
  static attach(app) {
    app.adminTablesList = [
      { code: 'MAPS', namePtBr: 'Mapas & Territórios', icon: '🗺️', desc: 'Biomas, pisos, colisões e spawns' },
      { code: 'NPCS', namePtBr: 'Tabela de NPCs', icon: '🧙', desc: 'Modelos de NPCs, nomes e posicionamentos' },
      { code: 'CLASSES', namePtBr: 'Personagens & Classes', icon: '🦸', desc: 'Classes, atributos base, sprites e reborns' },
      { code: 'MONSTERS', namePtBr: 'Monstros & Raridades', icon: '🐉', desc: 'Monstros, atributos, raridades e escalas' },
      { code: 'ATTRIBUTES', namePtBr: 'Atributos & Conversões', icon: '📊', desc: 'Atributos base, combate e conversões' },
      { code: 'SKILLS', namePtBr: 'Habilidades', icon: '⚡', desc: 'Habilidades ativas, passivas, alcances e custos' },
      { code: 'STATUS_EFFECTS', namePtBr: 'Buffs & Debuffs', icon: '💫', desc: 'Efeitos de status, DoTs, CC e gatilhos' },
      { code: 'QUESTS', namePtBr: 'Quests & Capítulos', icon: '📜', desc: 'Missões lineares, episódios e requisitos' },
    ];

    app.loadUsers = async function () {
      const isDev = this.session?.role === 'DEV';
      const users = await this.api('/api/admin/users');

      // 1. Ajusta o visual conforme o papel (DEV Master vs ADMIN Comum)
      const titleEl = document.getElementById('usersPanelTitle');
      const descEl = document.getElementById('usersPanelDesc');
      const roleBadgeEl = document.getElementById('userRoleBadge');
      const roleContainer = document.getElementById('userRoleFieldContainer');
      const devTablePanel = document.getElementById('devUsersTablePanel');
      const adminSelfPanel = document.getElementById('adminSelfPermissionsPanel');
      const btnClear = document.getElementById('btnClearUserForm');

      if (isDev) {
        if (titleEl) titleEl.textContent = '👑 Controle de Acesso & Contas (Painel Master do Desenvolvedor)';
        if (descEl) descEl.textContent = 'Como DEV, você tem acesso irrestrito ao sistema. Aqui você gerencia contas e define as permissões de cada Administrador por tabela.';
        if (roleBadgeEl) {
          roleBadgeEl.style.cssText = 'background:rgba(168,85,247,0.25); color:#fde047; border:1px solid #a855f7;';
          roleBadgeEl.textContent = '👑 DEV MASTER';
        }
        if (roleContainer) roleContainer.style.display = 'flex';
        if (devTablePanel) devTablePanel.style.display = 'flex';
        if (adminSelfPanel) adminSelfPanel.style.display = 'none';
        if (btnClear) btnClear.style.display = 'inline-block';
      } else {
        // ADMIN
        if (titleEl) titleEl.textContent = '🛡️ Meu Perfil / Minha Conta de Administrador';
        if (descEl) descEl.textContent = 'Você pode alterar seus dados de login abaixo (usuário, e-mail e senha). O acesso às tabelas é gerenciado pelo Desenvolvedor (DEV).';
        if (roleBadgeEl) {
          roleBadgeEl.style.cssText = 'background:rgba(59,130,246,0.25); color:#93c5fd; border:1px solid #3b82f6;';
          roleBadgeEl.textContent = '🛡️ ADMIN';
        }
        if (roleContainer) roleContainer.style.display = 'none';
        if (devTablePanel) devTablePanel.style.display = 'none';
        if (adminSelfPanel) adminSelfPanel.style.display = 'flex';
        if (btnClear) btnClear.style.display = 'none';

        // Preenche o formulário com os dados da própria conta do admin
        if (users.length > 0) {
          const self = users[0];
          document.getElementById('editUserId').value = String(self.id);
          document.getElementById('userUsername').value = self.username;
          document.getElementById('userEmail').value = self.email;
          document.getElementById('userPassword').value = '';
          document.getElementById('userPassword').placeholder = 'Deixe em branco para manter a senha atual';
        }

        this.renderAdminSelfPermissions();
      }

      // 2. Renderiza a tabela de usuários (para o DEV)
      const tbody = document.getElementById('usersTableBody');
      if (tbody) {
        if (users.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="color:var(--text-muted); padding:12px;">Nenhuma conta cadastrada no banco ainda.</td></tr>`;
          return;
        }

        tbody.innerHTML = users
          .map((u) => {
            const isUserDev = u.role === 'DEV';
            const roleBadge = isUserDev
              ? `<span style="padding:2px 8px; border-radius:99px; background:rgba(168,85,247,0.3); color:#fde047; border:1px solid #a855f7; font-weight:800; font-size:0.75rem;">👑 DEV</span>`
              : `<span style="padding:2px 8px; border-radius:99px; background:rgba(59,130,246,0.2); color:#93c5fd; border:1px solid #3b82f6; font-weight:700; font-size:0.75rem;">🛡️ ADMIN</span>`;

            // Resumo visual das permissões de tabela
            let permsBadges = '';
            if (isUserDev) {
              permsBadges = `<span style="color:#fde047; font-weight:700; font-size:0.74rem;">👑 Acesso Total Irrestrito</span>`;
            } else {
              const uPerms = u.tablePermissionsJson || {};
              permsBadges = this.adminTablesList
                .map((t) => {
                  const p = uPerms[t.code] || 'NONE';
                  let color = '#fca5a5';
                  let bg = 'rgba(239,68,68,0.1)';
                  let bdr = '#ef4444';
                  let label = '✕';
                  if (p === 'READ_WRITE') {
                    color = '#86efac';
                    bg = 'rgba(34,197,94,0.15)';
                    bdr = '#22c55e';
                    label = 'RW';
                  } else if (p === 'READ') {
                    color = '#fde047';
                    bg = 'rgba(234,179,8,0.15)';
                    bdr = '#eab308';
                    label = 'R';
                  }
                  return `<span style="display:inline-block; margin:1px 2px; padding:1px 5px; border-radius:4px; background:${bg}; color:${color}; border:1px solid ${bdr}; font-size:0.67rem; font-weight:700;" title="${t.namePtBr}: ${p}">${t.icon} ${label}</span>`;
                })
                .join(' ');
            }

            const permsJsonEscaped = JSON.stringify(u.tablePermissionsJson || {}).replace(/"/g, '&quot;');
            const isLoggedUser = this.session?.username === u.username;

            return `
            <tr>
              <td><strong>#${u.id}</strong></td>
              <td><strong>${u.username}</strong> ${isLoggedUser ? '<span style="font-size:0.68rem; color:#86efac;">(você)</span>' : ''}</td>
              <td>${u.email}</td>
              <td>${roleBadge}</td>
              <td><div style="display:flex; flex-wrap:wrap; max-width:320px;">${permsBadges}</div></td>
              <td style="font-size:0.75rem; color:var(--text-muted);">${new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
              <td>
                <div style="display:flex; gap:6px;">
                  <button type="button" onclick="AdminApp.populateUserForm(${u.id}, '${u.username}', '${u.email}', '${u.role}', ${permsJsonEscaped})">✏️ Editar</button>
                  ${isUserDev && isLoggedUser ? '' : `<button type="button" class="btn-danger" onclick="AdminApp.deleteUserAccount(${u.id})">🗑️</button>`}
                </div>
              </td>
            </tr>`;
          })
          .join('');
      }
    };

    /**
     * Renderiza o painel de permissões ativas para o ADMIN logado consultar.
     */
    app.renderAdminSelfPermissions = function () {
      const container = document.getElementById('adminSelfPermissionsGrid');
      if (!container) return;

      const perms = this.session?.tablePermissions || {};

      container.innerHTML = this.adminTablesList
        .map((t) => {
          const perm = perms[t.code] || 'NONE';
          let statusBadge = '';
          let borderCol = '#ef4444';
          let bgCol = 'rgba(239,68,68,0.06)';

          if (perm === 'READ_WRITE') {
            statusBadge = '<span style="padding:2px 8px; border-radius:4px; background:rgba(34,197,94,0.2); color:#86efac; border:1px solid #22c55e; font-size:0.72rem; font-weight:800;">🟢 Leitura & Edição</span>';
            borderCol = '#22c55e';
            bgCol = 'rgba(34,197,94,0.06)';
          } else if (perm === 'READ') {
            statusBadge = '<span style="padding:2px 8px; border-radius:4px; background:rgba(234,179,8,0.2); color:#fde047; border:1px solid #eab308; font-size:0.72rem; font-weight:800;">🟡 Apenas Leitura</span>';
            borderCol = '#eab308';
            bgCol = 'rgba(234,179,8,0.06)';
          } else {
            statusBadge = '<span style="padding:2px 8px; border-radius:4px; background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid #ef4444; font-size:0.72rem; font-weight:800;">🔴 Sem Acesso (Bloqueado)</span>';
            borderCol = '#ef4444';
            bgCol = 'rgba(239,68,68,0.06)';
          }

          return `
          <div style="background:${bgCol}; border:1px solid ${borderCol}; border-radius:8px; padding:10px; display:flex; flex-direction:column; justify-content:space-between; gap:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:0.85rem; color:#f8fafc;">${t.icon} ${t.namePtBr}</strong>
              ${statusBadge}
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted); line-height:1.3;">${t.desc}</div>
          </div>`;
        })
        .join('');
    };

    /**
     * Alterna a visibilidade da Matriz de Permissões ao alterar o cargo do usuário no formulário.
     */
    app.onUserRoleChange = function () {
      const role = document.getElementById('userRole')?.value;
      const matrixSec = document.getElementById('userPermissionsMatrixSection');
      if (matrixSec) {
        matrixSec.style.display = role === 'ADMIN' ? 'flex' : 'none';
        if (role === 'ADMIN') {
          this.renderTablePermissionsMatrix();
        }
      }
    };

    /**
     * Renderiza o grid de checkboxes/radios com as 8 tabelas e as opções NONE, READ, READ_WRITE.
     */
    app.renderTablePermissionsMatrix = function (existingPerms = {}) {
      const container = document.getElementById('tablePermissionsGrid');
      if (!container) return;

      container.innerHTML = this.adminTablesList
        .map((t) => {
          const current = existingPerms[t.code] || 'READ_WRITE';
          return `
          <div style="background:rgba(15,23,42,0.9); border:1px solid var(--border); border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:0.82rem; color:#f8fafc;">${t.icon} ${t.namePtBr}</strong>
              <code style="font-size:0.66rem; color:var(--text-muted);">${t.code}</code>
            </div>
            <div style="display:flex; gap:6px; font-size:0.73rem; justify-content:space-between; background:rgba(2,6,23,0.7); padding:4px 6px; border-radius:6px;">
              <label style="cursor:pointer; display:flex; align-items:center; gap:3px;">
                <input type="radio" name="perm_${t.code}" value="NONE" ${current === 'NONE' ? 'checked' : ''} />
                <span style="color:#fca5a5;">🔴 Bloquear</span>
              </label>
              <label style="cursor:pointer; display:flex; align-items:center; gap:3px;">
                <input type="radio" name="perm_${t.code}" value="READ" ${current === 'READ' ? 'checked' : ''} />
                <span style="color:#fde047;">🟡 Ver</span>
              </label>
              <label style="cursor:pointer; display:flex; align-items:center; gap:3px;">
                <input type="radio" name="perm_${t.code}" value="READ_WRITE" ${current === 'READ_WRITE' ? 'checked' : ''} />
                <span style="color:#86efac; font-weight:700;">🟢 Editar</span>
              </label>
            </div>
          </div>`;
        })
        .join('');
    };

    /**
     * Atalho rápido para marcar todas as tabelas com o mesmo nível de permissão.
     */
    app.setAllTablePermissions = function (level) {
      for (const t of this.adminTablesList) {
        const radios = document.getElementsByName(`perm_${t.code}`);
        for (const r of radios) {
          if (r.value === level) r.checked = true;
        }
      }
    };

    app.populateUserForm = function (id, username, email, role, perms = {}) {
      document.getElementById('editUserId').value = String(id);
      document.getElementById('userUsername').value = username;
      document.getElementById('userEmail').value = email;
      const roleSelect = document.getElementById('userRole');
      if (roleSelect) roleSelect.value = role;
      document.getElementById('userPassword').value = '';
      document.getElementById('userPassword').placeholder = 'Deixe em branco para manter a senha atual';

      const matrixSec = document.getElementById('userPermissionsMatrixSection');
      if (matrixSec) {
        matrixSec.style.display = role === 'ADMIN' ? 'flex' : 'none';
        if (role === 'ADMIN') {
          this.renderTablePermissionsMatrix(perms);
        }
      }
    };

    app.clearUserForm = function () {
      document.getElementById('editUserId').value = '';
      document.getElementById('userUsername').value = '';
      document.getElementById('userEmail').value = '';
      document.getElementById('userPassword').value = '';
      document.getElementById('userPassword').placeholder = 'Senha de acesso (mín. 4 caracteres)';
      const roleSelect = document.getElementById('userRole');
      if (roleSelect) roleSelect.value = 'ADMIN';

      const matrixSec = document.getElementById('userPermissionsMatrixSection');
      if (matrixSec) {
        matrixSec.style.display = 'flex';
        this.renderTablePermissionsMatrix();
      }
    };

    app.saveUserAccount = async function () {
      try {
        const editId = document.getElementById('editUserId').value;
        const isDev = this.session?.role === 'DEV';
        const role = isDev ? document.getElementById('userRole').value : this.session?.role || 'ADMIN';

        const dto = {
          username: document.getElementById('userUsername').value.trim(),
          email: document.getElementById('userEmail').value.trim(),
          password: document.getElementById('userPassword').value,
          role,
        };

        // Se for DEV salvando um ADMIN, coleta a matriz de permissões
        if (isDev && role === 'ADMIN') {
          const perms = {};
          for (const t of this.adminTablesList) {
            const radios = document.getElementsByName(`perm_${t.code}`);
            let val = 'READ_WRITE';
            for (const r of radios) {
              if (r.checked) val = r.value;
            }
            perms[t.code] = val;
          }
          dto.tablePermissionsJson = perms;
        }

        if (editId) {
          await this.api(`/api/admin/users/${editId}`, {
            method: 'PUT',
            body: JSON.stringify(dto),
          });
        } else {
          await this.api('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify(dto),
          });
        }

        this.clearUserForm();
        await this.loadUsers();
        alert('✅ Conta de usuário salva com sucesso!');
      } catch (err) {
        alert(`Erro ao salvar usuário: ${err.message}`);
      }
    };

    app.deleteUserAccount = async function (id) {
      if (!confirm('Deseja realmente excluir esta conta de usuário?')) return;
      try {
        await this.api(`/api/admin/users/${id}`, { method: 'DELETE' });
        await this.loadUsers();
        alert('✅ Conta excluída com sucesso.');
      } catch (err) {
        alert(`Erro ao remover conta: ${err.message}`);
      }
    };
  }
}

window.AdminUsersTab = AdminUsersTab;
