/**
 * @file apps/server/public/play/js/PlayLobbyController.js
 * @module @etheria/server
 * @description Submódulo de Seleção e Criação de Personagens no Lobby do Jogo.
 */

class PlayLobbyController {
  static attach(client) {
    client.renderLobby = function () {
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
            Abra a aba <strong>"🦸 Personagens"</strong> na rota <code>/admin</code> para cadastrar seu primeiro personagem!
            <div style="margin-top:8px;">
              <button class="btn-amber" onclick="window.location.href='/admin'">🛠️ Ir para /admin</button>
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
    };

    client.selectClassForCreation = function (classId) {
      this.selectedClassIdForCreation = Number(classId);
      this.renderLobby();
    };

    client.createCharacter = async function () {
      const name = document.getElementById('newCharName').value.trim();
      if (!name) {
        alert('Digite o nome do seu personagem.');
        return;
      }
      if (!this.selectedClassIdForCreation) {
        alert('Selecione primeiro uma Classe/Personagem.');
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
          `🎉 Personagem "${created.name}" criado com sucesso!\n\n🎲 Elemento: ${el.icon} ${created.elementNamePtBr}\n📍 Ponto de Spawn: (${created.posX}, ${created.posY})`
        );
        await this.enterWorldWithCharacter(created.id);
      } catch (err) {
        alert(`Erro ao criar personagem: ${err.message}`);
      }
    };

    client.deleteCharacter = async function (charId) {
      if (!confirm('Tem certeza que deseja excluir este personagem?')) return;
      try {
        await this.api(`/api/play/characters/${charId}`, { method: 'DELETE' });
        await this.loadPlayBootstrap();
      } catch (err) {
        alert(`Erro ao excluir personagem: ${err.message}`);
      }
    };

    client.enterWorldWithCharacter = async function (charId) {
      const found = this.myCharacters.find((c) => c.id === Number(charId));
      if (!found) return;

      this.activeChar = found;
      this.playerX = Number(found.posX) || 500;
      this.playerY = Number(found.posY) || 500;
      this.moveTargetX = null;
      this.moveTargetY = null;

      document.getElementById('lobbyScreen').style.display = 'none';
      document.getElementById('worldScreen').style.display = 'block';

      const isGmOrAdmin = this.session && (this.session.role === 'ADMIN' || this.session.role === 'GM');
      document.getElementById('btnToggleGm').style.display = isGmOrAdmin ? 'inline-block' : 'none';
      if (isGmOrAdmin && window.location.pathname.startsWith('/gm')) {
        const gmDrawer = document.getElementById('gmDrawer');
        if (gmDrawer) gmDrawer.classList.add('open');
      }

      this.resizeCanvas();
      await this.loadMapIntoWorld(found.currentMapId || 1, this.playerX, this.playerY);
    };

    client.backToLobby = function () {
      this.activeChar = null;
      document.getElementById('worldScreen').style.display = 'none';
      this.loadPlayBootstrap().then(() => this.showLobby());
    };
  }
}

window.PlayLobbyController = PlayLobbyController;
