/**
 * @file apps/server/public/admin/js/AdminUsersTab.js
 * @module @etheria/server
 * @description Submódulo do CRUD de Contas de Usuários (`user_accounts`) da Rota `/admin`.
 */

class AdminUsersTab {
  static attach(app) {
    app.loadUsers = async function () {
      const users = await this.api('/api/admin/users');
      const tbody = document.getElementById('usersTableBody');
      if (!tbody) return;
      if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:var(--text-muted);">Nenhuma conta cadastrada no banco ainda. Crie uma conta ADMIN acima para poder acessar fora do localhost!</td></tr>`;
        return;
      }

      tbody.innerHTML = users
        .map(
          (u) => `
        <tr>
          <td>#${u.id}</td>
          <td><strong>${u.username}</strong></td>
          <td>${u.email}</td>
          <td><span style="padding:2px 8px; border-radius:99px; background:rgba(56,189,248,0.15); color:var(--accent); font-weight:700;">${u.role}</span></td>
          <td>${new Date(u.createdAt).toLocaleString('pt-BR')}</td>
          <td style="display:flex; gap:6px;">
            <button onclick="AdminApp.populateUserForm(${u.id}, '${u.username}', '${u.email}', '${u.role}')">✏️ Editar</button>
            <button class="btn-danger" onclick="AdminApp.deleteUserAccount(${u.id})">🗑️</button>
          </td>
        </tr>`
        )
        .join('');
    };

    app.populateUserForm = function (id, username, email, role) {
      document.getElementById('editUserId').value = String(id);
      document.getElementById('userUsername').value = username;
      document.getElementById('userEmail').value = email;
      document.getElementById('userRole').value = role;
      document.getElementById('userPassword').value = '';
      document.getElementById('userPassword').placeholder = 'Deixe em branco para manter a senha atual';
    };

    app.clearUserForm = function () {
      document.getElementById('editUserId').value = '';
      document.getElementById('userUsername').value = '';
      document.getElementById('userEmail').value = '';
      document.getElementById('userPassword').value = '';
      document.getElementById('userPassword').placeholder = 'Senha de acesso';
      document.getElementById('userRole').value = 'ADMIN';
    };

    app.saveUserAccount = async function () {
      try {
        const editId = document.getElementById('editUserId').value;
        const dto = {
          username: document.getElementById('userUsername').value.trim(),
          email: document.getElementById('userEmail').value.trim(),
          password: document.getElementById('userPassword').value,
          role: document.getElementById('userRole').value,
        };

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
        alert('✅ Conta de usuário salva no PostgreSQL com sucesso!');
      } catch (err) {
        alert(`Erro ao salvar usuário: ${err.message}`);
      }
    };

    app.deleteUserAccount = async function (id) {
      if (!confirm('Deseja realmente excluir esta conta de usuário?')) return;
      try {
        await this.api(`/api/admin/users/${id}`, { method: 'DELETE' });
        await this.loadUsers();
      } catch (err) {
        alert(`Erro ao remover conta: ${err.message}`);
      }
    };
  }
}

window.AdminUsersTab = AdminUsersTab;
