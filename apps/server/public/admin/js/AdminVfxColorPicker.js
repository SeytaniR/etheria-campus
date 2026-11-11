/**
 * @file apps/server/public/admin/js/AdminVfxColorPicker.js
 * @module @etheria/server
 * @description Componente visual reutilizável de seleção de cor e intensidade para partículas VFX
 *   com fundo transparente nas modais de Habilidades (`skill`) e Buffs/Debuffs (`status`) em `/admin`.
 * @rules Segue estritamente AGENTS.md (Modularidade UI, zero código duplicado).
 * @dependencies VfxColorProcessor
 */

class AdminVfxColorPicker {
  static PRESET_SWATCHES = [
    { hex: '#ef4444', label: '🔥 Fogo' },
    { hex: '#f97316', label: '🟠 Solar' },
    { hex: '#facc15', label: '⚡ Raio / Ouro' },
    { hex: '#22c55e', label: '🌿 Veneno / Terra' },
    { hex: '#38bdf8', label: '❄️ Gelo / Vento' },
    { hex: '#2563eb', label: '🌊 Oceano' },
    { hex: '#a855f7', label: '🔮 Arcano' },
    { hex: '#ec4899', label: '🌸 Místico' },
    { hex: '#64748b', label: '🌑 Sombrio' },
    { hex: '#f8fafc', label: '⚪ Luz Pura' },
  ];

  static buildControlsHtml(prefix) {
    const swatchesHtml = this.PRESET_SWATCHES.map(
      (s) =>
        `<button type="button" onclick="AdminApp.pickVfxPresetColor('${prefix}', '${s.hex}')" title="${s.label} (${s.hex})" style="width:22px; height:22px; padding:0; border-radius:50%; background:${s.hex}; border:1.5px solid rgba(255,255,255,0.35); flex-shrink:0;"></button>`
    ).join('');

    return `
    <div style="background:rgba(2,6,23,0.75); border:1px solid #334155; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:7px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span style="font-size:0.75rem; font-weight:700; color:#fde047;">🎨 Cor das Partículas (VFX Transparente):</span>
          <span id="${prefix}VfxColorBadge" style="font-size:0.70rem; font-weight:700; padding:2px 8px; border-radius:99px; background:rgba(56,189,248,0.16); color:#7dd3fc; border:1px solid #0284c7;">✨ Cor Original</span>
        </div>
        <button type="button" onclick="AdminApp.pickVfxPresetColor('${prefix}', null)" style="padding:2px 8px; font-size:0.70rem; background:rgba(148,163,184,0.18); color:#e2e8f0; border-color:#475569;">🔄 Restaurar Original</button>
      </div>
      <div style="display:grid; grid-template-columns:auto 95px 1fr; gap:8px; align-items:center;">
        <input type="color" id="${prefix}VfxColorInput" value="#38bdf8" oninput="AdminApp.onVfxColorInput('${prefix}', this.value)" title="Selecionar cor personalizada da partícula" style="width:36px; height:30px; padding:2px; border-radius:6px; cursor:pointer; background:#0f172a; border:1px solid #475569;" />
        <input type="text" id="${prefix}VfxHexInput" value="" placeholder="Original" maxlength="7" oninput="AdminApp.onVfxHexTextChange('${prefix}', this.value)" style="padding:4px 7px; font-size:0.75rem; font-family:monospace; text-transform:uppercase; color:#f8fafc;" />
        <div style="display:flex; align-items:center; gap:6px;">
          <label style="font-size:0.70rem; color:#94a3b8; white-space:nowrap; margin:0;">Intensidade:</label>
          <input type="range" id="${prefix}VfxIntensityRange" min="0" max="100" step="5" value="100" oninput="AdminApp.onVfxIntensityInput('${prefix}', this.value)" style="flex:1; padding:0; accent-color:#38bdf8; cursor:pointer;" />
          <span id="${prefix}VfxIntensityLabel" style="font-size:0.72rem; font-weight:700; color:#7dd3fc; min-width:34px; text-align:right;">100%</span>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
        <span style="font-size:0.68rem; color:#94a3b8; margin-right:2px;">Paleta rápida:</span>
        ${swatchesHtml}
      </div>
    </div>`;
  }

  static attach(app) {
    app.getVfxColorStateForPrefix = function (prefix) {
      if (prefix === 'status') {
        return {
          vfxKey: this.selectedStatusVfxKey,
          colorHex: this.selectedStatusVfxColorHex,
          intensity: this.selectedStatusVfxColorIntensity ?? 100,
        };
      }
      return {
        vfxKey: this.selectedSkillVfxKey,
        colorHex: this.selectedSkillVfxColorHex,
        intensity: this.selectedSkillVfxColorIntensity ?? 100,
      };
    };

    app.setVfxColorStateForPrefix = function (prefix, colorHex, intensity) {
      const normalized = window.VfxColorProcessor ? window.VfxColorProcessor.parseHexColor(colorHex)?.hex ?? null : colorHex || null;
      const clampedInt = window.VfxColorProcessor ? window.VfxColorProcessor.clampIntensity(intensity, 100) : 100;
      if (prefix === 'status') {
        this.selectedStatusVfxColorHex = normalized;
        this.selectedStatusVfxColorIntensity = clampedInt;
      } else {
        this.selectedSkillVfxColorHex = normalized;
        this.selectedSkillVfxColorIntensity = clampedInt;
      }
    };

    app.refreshSelectedVfxThumb = function (prefix) {
      const canvas = document.getElementById(`${prefix}SelectedVfxThumbCanvas`);
      if (!canvas || !window.VfxColorProcessor) return;
      const st = this.getVfxColorStateForPrefix(prefix);
      const url = st.vfxKey
        ? `https://seytanir.github.io/mcrework/assets/effects/${String(st.vfxKey).trim()}/thumb.png`
        : '';
      window.VfxColorProcessor.renderThumbToCanvas(canvas, url, st.colorHex, st.intensity);
    };

    app.syncVfxColorControls = function (prefix, colorHex, intensity = 100) {
      this.setVfxColorStateForPrefix(prefix, colorHex, intensity);
      const st = this.getVfxColorStateForPrefix(prefix);

      const pickerEl = document.getElementById(`${prefix}VfxColorInput`);
      const hexEl = document.getElementById(`${prefix}VfxHexInput`);
      const rangeEl = document.getElementById(`${prefix}VfxIntensityRange`);
      const intLabel = document.getElementById(`${prefix}VfxIntensityLabel`);
      const badgeEl = document.getElementById(`${prefix}VfxColorBadge`);

      if (pickerEl) {
        pickerEl.value = st.colorHex || '#38bdf8';
      }
      if (hexEl && document.activeElement !== hexEl) {
        hexEl.value = st.colorHex ? st.colorHex.toUpperCase() : '';
      }
      if (rangeEl) {
        rangeEl.value = String(st.intensity);
      }
      if (intLabel) {
        intLabel.textContent = `${st.intensity}%`;
      }
      if (badgeEl) {
        if (st.colorHex && st.intensity > 0) {
          badgeEl.innerHTML = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${st.colorHex};border:1px solid #fff;vertical-align:middle;margin-right:4px;"></span>${st.colorHex.toUpperCase()} (${st.intensity}%)`;
          badgeEl.style.borderColor = st.colorHex;
          badgeEl.style.color = '#f8fafc';
        } else {
          badgeEl.textContent = '✨ Cor Original';
          badgeEl.style.borderColor = '#0284c7';
          badgeEl.style.color = '#7dd3fc';
        }
      }

      this.refreshSelectedVfxThumb(prefix);
    };

    app.onVfxColorInput = function (prefix, hexVal) {
      const st = this.getVfxColorStateForPrefix(prefix);
      const nextInt = st.intensity <= 0 ? 100 : st.intensity;
      this.syncVfxColorControls(prefix, hexVal, nextInt);
    };

    app.onVfxHexTextChange = function (prefix, rawText) {
      const trimmed = (rawText || '').trim();
      const st = this.getVfxColorStateForPrefix(prefix);
      if (!trimmed) {
        this.syncVfxColorControls(prefix, null, st.intensity);
        return;
      }
      const parsed = window.VfxColorProcessor ? window.VfxColorProcessor.parseHexColor(trimmed) : null;
      if (parsed) {
        this.syncVfxColorControls(prefix, parsed.hex, st.intensity <= 0 ? 100 : st.intensity);
      }
    };

    app.onVfxIntensityInput = function (prefix, rawVal) {
      const st = this.getVfxColorStateForPrefix(prefix);
      this.syncVfxColorControls(prefix, st.colorHex, Number(rawVal));
    };

    app.pickVfxPresetColor = function (prefix, hexOrNull) {
      if (!hexOrNull) {
        this.syncVfxColorControls(prefix, null, 100);
        return;
      }
      const st = this.getVfxColorStateForPrefix(prefix);
      const nextInt = st.intensity <= 0 ? 100 : st.intensity;
      this.syncVfxColorControls(prefix, hexOrNull, nextInt);
    };
  }
}

window.AdminVfxColorPicker = AdminVfxColorPicker;
