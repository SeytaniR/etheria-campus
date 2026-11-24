/**
 * @file apps/server/public/shared/EtheriaI18n.js
 * @module @etheria/shared-client
 * @description Motor frontend de internacionalização multi-locale (`pt-BR`, `en-US`, `es-ES`)
 *   compartilhado entre as rotas `/play` e `/admin`, com persistência em `localStorage`,
 *   resolução de placeholders/títulos DOM e propagação automática via cabeçalho `X-Etheria-Locale`.
 * @rules Segue estritamente Regra #4 (i18n nativo em 100% da interface) e Regra #7 (< 1.000 linhas).
 * @dependencies DOM Browser API (`document`, `localStorage`, `CustomEvent`)
 */

(function (root) {
  'use strict';

  const SUPPORTED_LOCALES = Object.freeze(['pt-BR', 'en-US', 'es-ES']);
  const DEFAULT_LOCALE = 'pt-BR';
  const STORAGE_KEY = 'etheria_locale';

  const LOCALE_LABELS = Object.freeze({
    'pt-BR': '🇧🇷 PT-BR',
    'en-US': '🇺🇸 EN-US',
    'es-ES': '🇪🇸 ES-ES',
  });

  const DICTIONARIES = {
    'pt-BR': {
      'common.language': '🌐 Idioma',
      'play.login.emblem': '✦ ACESSO AO REINO ✦',
      'play.login.subtitle': 'O Despertar do Véu • MMORPG 2.5D',
      'play.login.usernameLabel': '👤 Nome de Usuário',
      'play.login.usernamePlaceholder': 'Digite seu usuário (ex: dev)',
      'play.login.passwordLabel': '🔒 Chave de Acesso (Senha)',
      'play.login.passwordPlaceholder': 'Digite sua senha de acesso',
      'play.login.btnEnter': '⚔️ Entrar no Mundo',
      'play.login.btnRegister': '✨ Criar Nova Conta (Cadastro)',
      'play.login.footerPhase': 'Fase Beta • v0.64.0',
      'play.register.title': 'Criação de Contas em Etheria',
      'play.register.body': 'O sistema de auto-cadastro público estará disponível na próxima atualização de lançamento oficial!',
      'play.register.tip': 'Acesso Liberado para Testes: Você pode ingressar utilizando as contas de teste ou de desenvolvedor pré-autorizadas.',
      'play.register.btnClose': 'Entendido, Voltar ao Login',
      'play.lobby.tabHeroes': 'Meus Heróis',
      'play.lobby.tabCreate': 'Criar Herói',
      'play.lobby.btnLogout': 'Sair',
      'play.lobby.createTitle': 'Criar Novo Personagem',
      'play.lobby.charNameLabel': '🏷️ Nome do Personagem (2 a 24 caracteres)',
      'play.lobby.charNamePlaceholder': 'Ex: Dani, Arthur, Elena...',
      'play.lobby.classLabel': '🦸 Selecione a Classe / Arquétipo',
      'play.lobby.btnCreate': '✨ Criar Herói & Despertar no Véu',
      'play.lobby.archetypeTitle': 'Ficha do Arquétipo & Atributos Base',
      'play.hud.quests': '📜 Missões',
      'play.hud.bag': '🎒 Mochila',
      'play.hud.stats': '📊 Atributos',
      'play.hud.unstuck': '🆘 Destravar (Spawn)',
      'play.hud.gmPanel': '⚡ Painel GM',
      'play.hud.characters': '🔄 Personagens',
      'play.outcome.victoryTitle': 'VITÓRIA GLORIOSA',
      'play.outcome.victorySubtitle': 'A fenda dimensional foi expurgada e o equilíbrio restaurado.',
      'play.outcome.btnContinue': 'Continuar Jornada',
      'play.settings.title': '⚙️ Opções & Configurações',
      'play.settings.combatActive': '⚔️ Combate em Andamento',
      'play.settings.combatRetreatHint': 'Recuar com segurança e voltar ao mapa',
      'play.settings.btnFlee': '🏃 Fugir da Batalha',
      'play.settings.customHudTitle': '📐 Personalizar Interface (HUDs)',
      'play.settings.customHudHint': 'Mover, redimensionar e mudar cores no seu dispositivo',
      'play.settings.btnEditHud': '🎨 Editar HUDs',
      'play.settings.soundTitle': '🔊 Efeitos Sonoros & Música',
      'play.settings.centerCamera': '📍 Centralizar Câmera no Jogador',
      'play.settings.btnCenter': 'Centralizar',
      'play.settings.unstuckTitle': '🆘 Destravar Personagem (Spawn)',
      'play.settings.btnUnstuck': 'Destravar',
      'play.settings.languageTitle': '🌐 Idioma do Jogo',
      'play.settings.languageHint': 'Altera interface e entidades traduzidas',
      'play.settings.gmTitle': '⚡ Painel & Arsenal GM',
      'play.settings.btnGmArsenal': '🧰 Arsenal GM',
      'play.settings.btnGmPanel': '⚡ Painel GM',
      'play.settings.switchChar': '🔄 Trocar de Personagem',
      'play.settings.btnSwitch': 'Trocar',
      'admin.login.title': '🛡️ Etheria Campus — Rota /admin',
      'admin.login.usernameLabel': 'Usuário',
      'admin.login.usernamePlaceholder': 'Digite o usuário',
      'admin.login.passwordLabel': 'Senha',
      'admin.login.passwordPlaceholder': 'Digite a senha',
      'admin.login.btnEnter': 'Entrar no Studio Low-Code',
      'admin.tabs.maps': '🗺️ Mapas',
      'admin.tabs.dungeonChests': '🎁 Baús de Dungeon',
      'admin.tabs.npcs': '🧙 Tabela de NPCs',
      'admin.tabs.hunterCosts': '🐾 Caçador (Pets)',
      'admin.tabs.shops': '🏪 Lojas',
      'admin.tabs.classes': '🦸 Personagens',
      'admin.tabs.monsters': '🐉 Monstros',
      'admin.tabs.monsterConfig': '⚙️ Config. Monstros',
      'admin.tabs.uiLayouts': '📐 HUDs & Interfaces',
      'admin.tabs.attributes': '📊 Atributos & Conversões',
      'admin.tabs.users': '🔐 Contas',
      'admin.tabs.testPlay': '🎮 Testar no Jogo (/play)',
      'admin.tabs.logout': 'Sair',
      'admin.maps.title': '📂 Mapas no Banco',
      'admin.maps.enterVisualEditor': '🎯 ENTRAR NA EDIÇÃO VISUAL DO MAPA (TELA INTEIRA)',
    },
    'en-US': {
      'common.language': '🌐 Language',
      'play.login.emblem': '✦ REALM ACCESS ✦',
      'play.login.subtitle': 'Awakening of the Veil • 2.5D MMORPG',
      'play.login.usernameLabel': '👤 Username',
      'play.login.usernamePlaceholder': 'Enter your username (e.g. dev)',
      'play.login.passwordLabel': '🔒 Access Key (Password)',
      'play.login.passwordPlaceholder': 'Enter your password',
      'play.login.btnEnter': '⚔️ Enter the World',
      'play.login.btnRegister': '✨ Create New Account (Sign Up)',
      'play.login.footerPhase': 'Beta Phase • v0.64.0',
      'play.register.title': 'Account Creation in Etheria',
      'play.register.body': 'Public self-registration will be available in the next official launch update!',
      'play.register.tip': 'Open Test Access: You can sign in right away using pre-authorized test or developer accounts.',
      'play.register.btnClose': 'Got it, Back to Login',
      'play.lobby.tabHeroes': 'My Heroes',
      'play.lobby.tabCreate': 'Create Hero',
      'play.lobby.btnLogout': 'Sign Out',
      'play.lobby.createTitle': 'Create New Character',
      'play.lobby.charNameLabel': '🏷️ Character Name (2 to 24 characters)',
      'play.lobby.charNamePlaceholder': 'E.g. Dani, Arthur, Elena...',
      'play.lobby.classLabel': '🦸 Select Class / Archetype',
      'play.lobby.btnCreate': '✨ Create Hero & Awaken in the Veil',
      'play.lobby.archetypeTitle': 'Archetype Sheet & Base Attributes',
      'play.hud.quests': '📜 Quests',
      'play.hud.bag': '🎒 Inventory',
      'play.hud.stats': '📊 Stats',
      'play.hud.unstuck': '🆘 Unstuck (Spawn)',
      'play.hud.gmPanel': '⚡ GM Panel',
      'play.hud.characters': '🔄 Characters',
      'play.outcome.victoryTitle': 'GLORIOUS VICTORY',
      'play.outcome.victorySubtitle': 'The dimensional rift was purged and balance restored.',
      'play.outcome.btnContinue': 'Continue Journey',
      'play.settings.title': '⚙️ Options & Settings',
      'play.settings.combatActive': '⚔️ Combat in Progress',
      'play.settings.combatRetreatHint': 'Safely retreat and return to the map',
      'play.settings.btnFlee': '🏃 Flee Battle',
      'play.settings.customHudTitle': '📐 Customize Interface (HUDs)',
      'play.settings.customHudHint': 'Move, resize and customize colors on your device',
      'play.settings.btnEditHud': '🎨 Edit HUDs',
      'play.settings.soundTitle': '🔊 Sound Effects & Music',
      'play.settings.centerCamera': '📍 Center Camera on Player',
      'play.settings.btnCenter': 'Center',
      'play.settings.unstuckTitle': '🆘 Unstuck Character (Spawn)',
      'play.settings.btnUnstuck': 'Unstuck',
      'play.settings.languageTitle': '🌐 Game Language',
      'play.settings.languageHint': 'Switches UI and translated entities',
      'play.settings.gmTitle': '⚡ GM Panel & Arsenal',
      'play.settings.btnGmArsenal': '🧰 GM Arsenal',
      'play.settings.btnGmPanel': '⚡ GM Panel',
      'play.settings.switchChar': '🔄 Switch Character',
      'play.settings.btnSwitch': 'Switch',
      'admin.login.title': '🛡️ Etheria Campus — /admin Route',
      'admin.login.usernameLabel': 'Username',
      'admin.login.usernamePlaceholder': 'Enter username',
      'admin.login.passwordLabel': 'Password',
      'admin.login.passwordPlaceholder': 'Enter password',
      'admin.login.btnEnter': 'Enter Low-Code Studio',
      'admin.tabs.maps': '🗺️ Maps',
      'admin.tabs.dungeonChests': '🎁 Dungeon Chests',
      'admin.tabs.npcs': '🧙 NPC Table',
      'admin.tabs.hunterCosts': '🐾 Hunter (Pets)',
      'admin.tabs.shops': '🏪 Shops',
      'admin.tabs.classes': '🦸 Characters',
      'admin.tabs.monsters': '🐉 Monsters',
      'admin.tabs.monsterConfig': '⚙️ Monster Config',
      'admin.tabs.uiLayouts': '📐 HUDs & Layouts',
      'admin.tabs.attributes': '📊 Stats & Conversions',
      'admin.tabs.users': '🔐 Accounts',
      'admin.tabs.testPlay': '🎮 Test in Game (/play)',
      'admin.tabs.logout': 'Sign Out',
      'admin.maps.title': '📂 Maps in Database',
      'admin.maps.enterVisualEditor': '🎯 ENTER VISUAL MAP EDITOR (FULLSCREEN)',
    },
    'es-ES': {
      'common.language': '🌐 Idioma',
      'play.login.emblem': '✦ ACCESO AL REINO ✦',
      'play.login.subtitle': 'El Despertar del Velo • MMORPG 2.5D',
      'play.login.usernameLabel': '👤 Nombre de Usuario',
      'play.login.usernamePlaceholder': 'Ingresa tu usuario (ej: dev)',
      'play.login.passwordLabel': '🔒 Clave de Acceso (Contraseña)',
      'play.login.passwordPlaceholder': 'Ingresa tu contraseña',
      'play.login.btnEnter': '⚔️ Entrar al Mundo',
      'play.login.btnRegister': '✨ Crear Nueva Cuenta (Registro)',
      'play.login.footerPhase': 'Fase Beta • v0.64.0',
      'play.register.title': 'Creación de Cuentas en Etheria',
      'play.register.body': '¡El sistema de registro público estará disponible en la próxima actualización oficial!',
      'play.register.tip': 'Acceso Abierto de Pruebas: Puedes ingresar inmediatamente con cuentas de prueba o desarrollador autorizadas.',
      'play.register.btnClose': 'Entendido, Volver al Login',
      'play.lobby.tabHeroes': 'Mis Héroes',
      'play.lobby.tabCreate': 'Crear Héroe',
      'play.lobby.btnLogout': 'Salir',
      'play.lobby.createTitle': 'Crear Nuevo Personaje',
      'play.lobby.charNameLabel': '🏷️ Nombre del Personaje (2 a 24 caracteres)',
      'play.lobby.charNamePlaceholder': 'Ej: Dani, Arthur, Elena...',
      'play.lobby.classLabel': '🦸 Selecciona la Clase / Arquetipo',
      'play.lobby.btnCreate': '✨ Crear Héroe & Despertar en el Velo',
      'play.lobby.archetypeTitle': 'Ficha del Arquetipo & Atributos Base',
      'play.hud.quests': '📜 Misiones',
      'play.hud.bag': '🎒 Mochila',
      'play.hud.stats': '📊 Atributos',
      'play.hud.unstuck': '🆘 Destrabar (Spawn)',
      'play.hud.gmPanel': '⚡ Panel GM',
      'play.hud.characters': '🔄 Personajes',
      'play.outcome.victoryTitle': 'VICTORIA GLORIOSA',
      'play.outcome.victorySubtitle': 'La brecha dimensional fue purgada y el equilibrio restaurado.',
      'play.outcome.btnContinue': 'Continuar Viaje',
      'play.settings.title': '⚙️ Opciones & Configuración',
      'play.settings.combatActive': '⚔️ Combate en Curso',
      'play.settings.combatRetreatHint': 'Retirarse con seguridad y volver al mapa',
      'play.settings.btnFlee': '🏃 Huir de la Batalla',
      'play.settings.customHudTitle': '📐 Personalizar Interfaz (HUDs)',
      'play.settings.customHudHint': 'Mover, redimensionar y cambiar colores en tu dispositivo',
      'play.settings.btnEditHud': '🎨 Editar HUDs',
      'play.settings.soundTitle': '🔊 Efectos de Sonido & Música',
      'play.settings.centerCamera': '📍 Centrar Cámara en el Jugador',
      'play.settings.btnCenter': 'Centrar',
      'play.settings.unstuckTitle': '🆘 Destrabar Personaje (Spawn)',
      'play.settings.btnUnstuck': 'Destrabar',
      'play.settings.languageTitle': '🌐 Idioma del Juego',
      'play.settings.languageHint': 'Cambia la interfaz y entidades traducidas',
      'play.settings.gmTitle': '⚡ Panel & Arsenal GM',
      'play.settings.btnGmArsenal': '🧰 Arsenal GM',
      'play.settings.btnGmPanel': '⚡ Panel GM',
      'play.settings.switchChar': '🔄 Cambiar de Personaje',
      'play.settings.btnSwitch': 'Cambiar',
      'admin.login.title': '🛡️ Etheria Campus — Ruta /admin',
      'admin.login.usernameLabel': 'Usuario',
      'admin.login.usernamePlaceholder': 'Ingresa el usuario',
      'admin.login.passwordLabel': 'Contraseña',
      'admin.login.passwordPlaceholder': 'Ingresa la contraseña',
      'admin.login.btnEnter': 'Entrar al Studio Low-Code',
      'admin.tabs.maps': '🗺️ Mapas',
      'admin.tabs.dungeonChests': '🎁 Cofres de Dungeon',
      'admin.tabs.npcs': '🧙 Tabla de NPCs',
      'admin.tabs.hunterCosts': '🐾 Cazador (Pets)',
      'admin.tabs.shops': '🏪 Tiendas',
      'admin.tabs.classes': '🦸 Personajes',
      'admin.tabs.monsters': '🐉 Monstruos',
      'admin.tabs.monsterConfig': '⚙️ Config. Monstruos',
      'admin.tabs.uiLayouts': '📐 HUDs & Interfaces',
      'admin.tabs.attributes': '📊 Atributos & Conversiones',
      'admin.tabs.users': '🔐 Cuentas',
      'admin.tabs.testPlay': '🎮 Probar en Juego (/play)',
      'admin.tabs.logout': 'Salir',
      'admin.maps.title': '📂 Mapas en Base de Datos',
      'admin.maps.enterVisualEditor': '🎯 ENTRAR AL EDITOR VISUAL DE MAPA (PANTALLA COMPLETA)',
    },
  };

  function normalizeLocale(raw) {
    const cleaned = String(raw || '').trim().replace(/_/g, '-').toLowerCase();
    if (cleaned.startsWith('en')) return 'en-US';
    if (cleaned.startsWith('es')) return 'es-ES';
    return DEFAULT_LOCALE;
  }

  function readStorageLocale() {
    try {
      if (typeof root.localStorage !== 'undefined' && root.localStorage) {
        return root.localStorage.getItem(STORAGE_KEY) || '';
      }
    } catch {
      // ignora em ambiente sem storage
    }
    return '';
  }

  function writeStorageLocale(locale) {
    try {
      if (typeof root.localStorage !== 'undefined' && root.localStorage) {
        root.localStorage.setItem(STORAGE_KEY, locale);
      }
    } catch {
      // ignora em ambiente sem storage
    }
  }

  let memoryLocale = null;

  function getLocale() {
    const stored = readStorageLocale();
    if (stored) {
      return normalizeLocale(stored);
    }
    if (memoryLocale) {
      return memoryLocale;
    }
    const navLang = typeof root.navigator !== 'undefined' && root.navigator ? root.navigator.language : '';
    return normalizeLocale(navLang || DEFAULT_LOCALE);
  }

  function t(key, vars) {
    const loc = getLocale();
    const dict = DICTIONARIES[loc] || DICTIONARIES[DEFAULT_LOCALE];
    let text = Object.prototype.hasOwnProperty.call(dict, key)
      ? dict[key]
      : Object.prototype.hasOwnProperty.call(DICTIONARIES[DEFAULT_LOCALE], key)
      ? DICTIONARIES[DEFAULT_LOCALE][key]
      : key;

    if (vars && typeof vars === 'object') {
      text = String(text).replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, varKey) {
        return Object.prototype.hasOwnProperty.call(vars, varKey) ? String(vars[varKey]) : '{' + varKey + '}';
      });
    }
    return text;
  }

  function applyDomTranslations(targetRoot) {
    const doc = targetRoot || (typeof root.document !== 'undefined' ? root.document : null);
    if (!doc || typeof doc.querySelectorAll !== 'function') return;
    const loc = getLocale();

    if (doc.documentElement) {
      doc.documentElement.lang = loc;
    }

    doc.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });

    doc.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });

    doc.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });

    doc.querySelectorAll('[data-i18n-locale-select]').forEach(function (sel) {
      sel.value = loc;
    });
  }

  function setLocale(nextLocale, opts) {
    const normalized = normalizeLocale(nextLocale);
    memoryLocale = normalized;
    if (!opts || opts.persist !== false) {
      writeStorageLocale(normalized);
    }
    applyDomTranslations();
    if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
      root.dispatchEvent(new root.CustomEvent('etheria:locale-changed', { detail: { locale: normalized } }));
    }
    return normalized;
  }

  function renderLocaleOptionsHtml(selectedLocale) {
    const active = normalizeLocale(selectedLocale || getLocale());
    return SUPPORTED_LOCALES.map(function (code) {
      const selectedAttr = code === active ? ' selected' : '';
      return '<option value="' + code + '"' + selectedAttr + '>' + (LOCALE_LABELS[code] || code) + '</option>';
    }).join('');
  }

  const EtheriaI18n = {
    SUPPORTED_LOCALES: SUPPORTED_LOCALES,
    DEFAULT_LOCALE: DEFAULT_LOCALE,
    LOCALE_LABELS: LOCALE_LABELS,
    DICTIONARIES: DICTIONARIES,
    normalizeLocale: normalizeLocale,
    getLocale: getLocale,
    setLocale: setLocale,
    t: t,
    applyDomTranslations: applyDomTranslations,
    renderLocaleOptionsHtml: renderLocaleOptionsHtml,
  };

  root.EtheriaI18n = EtheriaI18n;
  if (typeof globalThis !== 'undefined') {
    globalThis.EtheriaI18n = EtheriaI18n;
  }

  if (typeof root.document !== 'undefined' && typeof root.document.addEventListener === 'function') {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () {
        applyDomTranslations();
      });
    } else {
      applyDomTranslations();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
