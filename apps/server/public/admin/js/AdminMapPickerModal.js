/**
 * @file apps/server/public/admin/js/AdminMapPickerModal.js
 * @module @etheria/server
 * @description Submódulo do `/admin` responsável pelos modais de seleção e upload de imagem de mapa
 *   (`mapPickerModal`, `mapUploadModal`), escolha da galeria do mcrework, e seletor de raças/monstros
 *   e boss de Dungeon vinculados ao mapa.
 */

class AdminMapPickerModal {
  static attach(app) {
    app.openMcreworkMapPicker = async function (mode = 'NEW_MAP') {
      this.mapPickerMode = mode;
      document.getElementById('mapPickerModal').style.display = 'flex';
      this.switchMapPickerSubTab('mcrework');
      const grid = document.getElementById('mcreworkMapsGrid');
      if (this.mcreworkMaps.length === 0) {
        grid.innerHTML = '<div>Carregando as 76 imagens de mapas do mcrework...</div>';
        try {
          this.mcreworkMaps = await this.api('/api/admin/mcrework/maps');
        } catch (err) {
          grid.innerHTML = `<div style="color:#fca5a5;">${err.message}</div>`;
          return;
        }
      }

      grid.innerHTML = this.mcreworkMaps
        .map(
          (m, idx) => `
        <div class="gallery-card" onclick="AdminApp.pickMcreworkMap(${idx})">
          <img src="${m.thumbUrl}" alt="${m.folderCode}" loading="lazy" />
          <strong>${m.folderCode}</strong>
          <span style="font-size:0.72rem; color:var(--text-muted);">${m.width}x${m.height} px</span>
        </div>`
        )
        .join('');
    };

    app.switchMapPickerSubTab = function (tabName) {
      const btnMcrework = document.getElementById('mapPickerTabBtnMcrework');
      const btnUploads = document.getElementById('mapPickerTabBtnUploads');
      const gridMcrework = document.getElementById('mcreworkMapsGrid');
      const gridUploads = document.getElementById('customUploadedMapsGrid');

      if (tabName === 'uploads') {
        if (btnMcrework) btnMcrework.className = 'btn-secondary';
        if (btnUploads) {
          btnUploads.className = 'btn-primary';
          btnUploads.style.background = '#0284c7';
        }
        if (gridMcrework) gridMcrework.style.display = 'none';
        if (gridUploads) gridUploads.style.display = 'grid';
        this.loadUploadedCustomMaps();
      } else {
        if (btnMcrework) btnMcrework.className = 'btn-primary';
        if (btnUploads) {
          btnUploads.className = 'btn-secondary';
          btnUploads.style.background = 'transparent';
        }
        if (gridMcrework) gridMcrework.style.display = 'grid';
        if (gridUploads) gridUploads.style.display = 'none';
      }
    };

    app.loadUploadedCustomMaps = async function () {
      const grid = document.getElementById('customUploadedMapsGrid');
      if (!grid) return;
      grid.innerHTML = '<div style="color:var(--text-muted); padding:20px; text-align:center; grid-column:1/-1;">Carregando mapas customizados...</div>';
      try {
        const uploads = await this.api('/api/admin/maps/uploads');
        if (!Array.isArray(uploads) || uploads.length === 0) {
          grid.innerHTML = `
            <div style="color:var(--text-muted); padding:30px 20px; text-align:center; grid-column:1/-1; line-height:1.6;">
              📁 <strong>Nenhum mapa customizado enviado ainda.</strong><br />
              Clique em <strong>"📤 Fazer Upload de Nova Imagem"</strong> acima para enviar qualquer PNG, JPG ou WEBP do seu computador!
            </div>`;
          return;
        }

        grid.innerHTML = uploads
          .map(
            (u) => `
          <div class="gallery-card" onclick="AdminApp.pickUploadedCustomMap('${u.url}', ${u.width}, ${u.height}, '${u.filename}')">
            <img src="${u.url}" alt="${u.filename}" loading="lazy" style="object-fit:cover; width:100%; height:110px; border-radius:6px;" />
            <strong style="font-size:0.75rem; word-break:break-all; margin-top:4px;">${u.filename}</strong>
            <span style="font-size:0.72rem; color:#86efac; font-weight:700;">${u.width}x${u.height} px</span>
            <span style="font-size:0.68rem; color:var(--text-muted);">${(u.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>
          </div>`
          )
          .join('');
      } catch (err) {
        grid.innerHTML = `<div style="color:#fca5a5; padding:20px; text-align:center; grid-column:1/-1;">Erro ao carregar uploads: ${err.message}</div>`;
      }
    };

    app.pickUploadedCustomMap = function (url, width, height, filename) {
      this.closeModal('mapPickerModal');
      if (this.mapPickerMode === 'NEW_MAP' || !this.currentMapId) {
        this.newBlankMapState({
          bgImageUrl: url,
          width: width || 2000,
          height: height || 1500,
          folderCode: filename || 'custom_map',
        });
        const nameInput = document.getElementById('mapNamePtBr');
        if (nameInput && !nameInput.value) {
          const cleanName = (filename || 'Mapa Customizado')
            .replace(/^map_\d+_/, '')
            .replace(/\.[^.]+$/, '')
            .replace(/_/g, ' ')
            .trim();
          nameInput.value = cleanName ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1) : 'Mapa Customizado';
        }
      } else {
        document.getElementById('mapImagePath').value = url;
        this.cameraInitializedForUrl = '';
        this.loadMapBackgroundImage(url);
      }
    };

    app.openMapUploadModal = function (mode = 'NEW_MAP') {
      this.mapPickerMode = mode;
      this.pendingMapUpload = null;

      const modal = document.getElementById('mapUploadModal');
      if (!modal) return;

      const title = document.getElementById('mapUploadModalTitle');
      if (title) {
        title.innerHTML = mode === 'NEW_MAP'
          ? '<span>📤</span> <span>Fazer Upload de Imagem para Novo Mapa</span>'
          : '<span>📤</span> <span>Fazer Upload para Trocar Imagem do Mapa</span>';
      }

      const fileInput = document.getElementById('mapFileInput');
      if (fileInput) fileInput.value = '';

      const previewContainer = document.getElementById('mapUploadPreviewContainer');
      if (previewContainer) previewContainer.style.display = 'none';

      const statusEl = document.getElementById('mapUploadStatus');
      if (statusEl) {
        statusEl.style.display = 'none';
        statusEl.textContent = '';
      }

      const submitBtn = document.getElementById('mapUploadSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '🚀 Confirmar Upload e Usar no Mapa';
      }

      modal.style.display = 'flex';

      // Configura Drag and Drop
      const dropZone = document.getElementById('mapDropZone');
      if (dropZone && !dropZone.dataset.dragConfigured) {
        dropZone.dataset.dragConfigured = 'true';
        dropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropZone.style.background = 'rgba(56,189,248,0.18)';
          dropZone.style.borderColor = '#38bdf8';
        });
        dropZone.addEventListener('dragleave', () => {
          dropZone.style.background = 'rgba(56,189,248,0.06)';
          dropZone.style.borderColor = '#38bdf8';
        });
        dropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropZone.style.background = 'rgba(56,189,248,0.06)';
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
            this.processSelectedMapFile(e.dataTransfer.files[0]);
          }
        });
      }
    };

    app.onMapFileInputChange = function (evt) {
      const file = evt.target?.files?.[0];
      if (file) {
        this.processSelectedMapFile(file);
      }
    };

    app.processSelectedMapFile = function (file) {
      const statusEl = document.getElementById('mapUploadStatus');
      const submitBtn = document.getElementById('mapUploadSubmitBtn');
      const previewContainer = document.getElementById('mapUploadPreviewContainer');
      const previewImg = document.getElementById('mapUploadPreviewImg');
      const fileNameEl = document.getElementById('mapUploadFileName');
      const metaEl = document.getElementById('mapUploadMeta');
      const dimsEl = document.getElementById('mapUploadDimensions');

      if (!file) return;

      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!validTypes.includes(file.type.toLowerCase()) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
        if (statusEl) {
          statusEl.style.display = 'block';
          statusEl.style.background = 'rgba(239,68,68,0.15)';
          statusEl.style.color = '#fca5a5';
          statusEl.textContent = '❌ Formato inválido! Por favor selecione uma imagem PNG, JPG ou WEBP.';
        }
        return;
      }

      if (file.size > 25 * 1024 * 1024) {
        if (statusEl) {
          statusEl.style.display = 'block';
          statusEl.style.background = 'rgba(239,68,68,0.15)';
          statusEl.style.color = '#fca5a5';
          statusEl.textContent = '❌ Arquivo muito grande! O limite máximo para imagens de mapas é 25 MB.';
        }
        return;
      }

      if (statusEl) statusEl.style.display = 'none';

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          const width = img.naturalWidth || 2000;
          const height = img.naturalHeight || 1500;

          this.pendingMapUpload = {
            file,
            dataUrl,
            width,
            height,
          };

          if (previewImg) previewImg.src = dataUrl;
          if (fileNameEl) fileNameEl.textContent = file.name;
          if (metaEl) metaEl.textContent = `Tamanho: ${(file.size / 1024 / 1024).toFixed(2)} MB • Tipo: ${file.type || 'Imagem'}`;
          if (dimsEl) dimsEl.textContent = `📐 Resolução detectada: ${width} × ${height} pixels`;
          if (previewContainer) previewContainer.style.display = 'flex';
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.background = '#0284c7';
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    };

    app.submitMapImageUpload = async function () {
      if (!this.pendingMapUpload) return;
      const { file, dataUrl, width, height } = this.pendingMapUpload;

      const submitBtn = document.getElementById('mapUploadSubmitBtn');
      const statusEl = document.getElementById('mapUploadStatus');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Enviando imagem...';
      }
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(56,189,248,0.15)';
        statusEl.style.color = '#7dd3fc';
        statusEl.textContent = 'Salvando imagem no servidor e otimizando resoluções...';
      }

      try {
        const res = await this.api('/api/admin/maps/upload', {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            dataBase64: dataUrl,
            namePtBr: file.name.replace(/\.[^.]+$/, ''),
          }),
        });

        this.closeModal('mapUploadModal');
        this.closeModal('mapPickerModal');

        this.pickUploadedCustomMap(res.url, res.width || width, res.height || height, res.filename);

        alert(`✅ Imagem de mapa "${res.filename}" enviada e aplicada com sucesso!\nResolução: ${res.width || width}x${res.height || height}px.`);
      } catch (err) {
        if (statusEl) {
          statusEl.style.display = 'block';
          statusEl.style.background = 'rgba(239,68,68,0.15)';
          statusEl.style.color = '#fca5a5';
          statusEl.textContent = `❌ Falha no envio: ${err.message}`;
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '🚀 Confirmar Upload e Usar no Mapa';
        }
      }
    };

    app.pickMcreworkMap = function (idx) {
      const item = this.mcreworkMaps[idx];
      if (!item) return;
      this.closeModal('mapPickerModal');

      if (this.mapPickerMode === 'NEW_MAP' || !this.currentMapId) {
        this.newBlankMapState(item);
      } else {
        document.getElementById('mapImagePath').value = item.bgImageUrl;
        this.cameraInitializedForUrl = '';
        this.loadMapBackgroundImage(item.bgImageUrl);
      }
    };

    app.renderMapMonsterTypesAndPicker = function () {
      const container = document.getElementById('mapMonsterTypesContainer');
      if (container && this.races) {
        const raceIcons = {
          DRAGON: '🐉', BEAST: '🐺', HUMAN: '👤', SPIRIT: '👻', DEMON: '😈',
          AQUATIC: '🌊', REPTILIAN: '🦎', ROBOTIC: '⚙️', PLANT: '🌿', CELESTIAL: '👼', FAIRY: '🧚',
        };
        container.innerHTML = this.races
          .map((r) => {
            const icon = raceIcons[r.code] || '🐾';
            const isChecked = this.mapSelectedMonsterRaces.includes(r.code);
            return `
              <label style="display:flex; align-items:center; gap:4px; font-size:0.73rem; background:rgba(30,41,59,0.7); padding:3px 6px; border-radius:4px; cursor:pointer;">
                <input type="checkbox" name="mapMonsterRace" value="${r.code}" ${isChecked ? 'checked' : ''} onchange="AdminApp.onMapMonsterRaceChanged()" />
                <span>${icon} ${r.namePtBr || r.code}</span>
              </label>
            `;
          })
          .join('');
      }

      const select = document.getElementById('mapAddIndividualMonsterSelect');
      if (select && this.allMonsterTemplates) {
        select.innerHTML = '<option value="">➕ Selecione um monstro para adicionar...</option>' +
          this.allMonsterTemplates
            .map((m) => `<option value="${m.id}">[${m.rarityTier}] #${m.id} ${m.namePtBr} (${m.raceCode})</option>`)
            .join('');
      }
      const bossSelect = document.getElementById('mapDungeonBossSelect');
      if (bossSelect && this.allMonsterTemplates) {
        const prevVal = bossSelect.value;
        bossSelect.innerHTML = '<option value="">🎲 Aleatório dos elegíveis (ou selecione um Boss específico)</option>' +
          this.allMonsterTemplates
            .map((m) => `<option value="${m.id}">[${m.rarityTier}] #${m.id} ${m.namePtBr} (${m.raceCode})</option>`)
            .join('');
        if (prevVal) bossSelect.value = prevVal;
      }

      this.renderMapIndividualMonstersChips();
    };

    app.toggleAllMapMonsterTypes = function (checked) {
      document.querySelectorAll('input[name="mapMonsterRace"]').forEach((chk) => {
        chk.checked = checked;
      });
      this.onMapMonsterRaceChanged();
    };

    app.onMapMonsterRaceChanged = function () {
      this.mapSelectedMonsterRaces = Array.from(document.querySelectorAll('input[name="mapMonsterRace"]:checked')).map((c) => c.value);
    };

    app.addIndividualMonsterToMap = function () {
      const select = document.getElementById('mapAddIndividualMonsterSelect');
      if (!select || !select.value) return;
      const id = Number(select.value);
      if (!this.mapSelectedMonsterTemplateIds.includes(id)) {
        this.mapSelectedMonsterTemplateIds.push(id);
        this.renderMapIndividualMonstersChips();
      }
      select.value = '';
    };

    app.removeIndividualMonsterFromMap = function (id) {
      this.mapSelectedMonsterTemplateIds = this.mapSelectedMonsterTemplateIds.filter((x) => x !== Number(id));
      this.renderMapIndividualMonstersChips();
    };

    app.renderMapIndividualMonstersChips = function () {
      const box = document.getElementById('mapIndividualMonstersChips');
      if (!box) return;
      if (this.mapSelectedMonsterTemplateIds.length === 0) {
        box.innerHTML = '<span style="color:#64748b; font-size:0.74rem; font-style:italic;">Nenhum monstro individual adicionado fora dos tipos.</span>';
        return;
      }
      const rarityColors = { SS: '#fbbf24', S: '#c084fc', A: '#38bdf8', B: '#4ade80', C: '#fde047', D: '#cbd5e1', F: '#94a3b8' };
      box.innerHTML = this.mapSelectedMonsterTemplateIds
        .map((id) => {
          const m = this.allMonsterTemplates.find((x) => x.id === id);
          const name = m ? m.namePtBr : `Monstro #${id}`;
          const rColor = m ? (rarityColors[m.rarityTier] || '#94a3b8') : '#94a3b8';
          const thumb = m?.thumbUrl || '/play/assets/placeholder_pet.png';
          return `
            <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(30,41,59,0.9); border:1px solid ${rColor}55; border-radius:6px; padding:2px 8px; font-size:0.75rem;">
              <img src="${thumb}" alt="" style="width:18px; height:18px; object-fit:contain; border-radius:3px;" onerror="this.style.display='none'" />
              <strong style="color:#f8fafc;">${name}</strong>
              <span style="color:${rColor}; font-size:0.70rem; font-weight:700;">[${m?.rarityTier || 'F'}]</span>
              <button type="button" onclick="AdminApp.removeIndividualMonsterFromMap(${id})" style="background:transparent; border:none; color:#f87171; cursor:pointer; padding:0 2px; font-size:0.80rem;" title="Remover">✕</button>
            </div>
          `;
        })
        .join('');
    };
  }
}

window.AdminMapPickerModal = AdminMapPickerModal;
