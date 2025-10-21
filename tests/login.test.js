const { test } = require('node:test');
const assert = require('node:assert/strict');

const defaultNavigator = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const noop = () => {};

const originalSetTimeout = global.setTimeout;
global.setTimeout = (fn, _delay, ...args) => {
  fn(...args);
  return 0;
};

global.window = {
  navigator: defaultNavigator,
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
  addEventListener: noop,
};

global.navigator = defaultNavigator;

global.document = {
  addEventListener: noop,
  getElementById: () => null,
  querySelectorAll: () => [],
};

const { EducaFlowPro } = require('../app.js');

function createClassList(initial = []) {
  const classes = new Set(initial);
  return {
    add: (cls) => classes.add(cls),
    remove: (cls) => classes.delete(cls),
    contains: (cls) => classes.has(cls),
  };
}

function createStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

function setupLoginDom() {
  const loginBtn = { disabled: false };
  const loginLoading = { classList: createClassList(['hidden']) };
  const loginErrorMessage = { textContent: 'Erro ao fazer login. Tente novamente.' };
  const loginError = {
    classList: createClassList(['hidden']),
    querySelector: (selector) => (selector === 'p' ? loginErrorMessage : null),
  };

  const elements = {
    googleLoginBtn: loginBtn,
    loginError,
    loginLoading,
  };

  document.getElementById = (id) => elements[id] || null;

  return { loginBtn, loginLoading, loginError, loginErrorMessage };
}

test('realiza login via popup quando possível', { concurrency: false }, async () => {
  const storage = createStorage();
  const { loginBtn, loginLoading, loginError } = setupLoginDom();
  const app = new EducaFlowPro({ autoInit: false, sessionStorage: storage });

  const toasts = [];
  app.auth = {
    signInWithPopup: async () => ({ user: { email: 'professor@escola.com' } }),
    signInWithRedirect: async () => {
      throw new Error('Redirect não deveria ser chamado');
    },
  };
  app.googleProvider = {};
  app.showToast = (message, type) => toasts.push({ message, type });
  app.hideSplash = noop;
  app.showLogin = noop;

  await app.attemptLogin();

  assert.strictEqual(loginBtn.disabled, false, 'botão deve ser reabilitado após o login');
  assert.ok(loginLoading.classList.contains('hidden'), 'indicador de carregamento deve ser oculto');
  assert.ok(loginError.classList.contains('hidden'), 'erro de login não deve ser exibido');
  assert.deepStrictEqual(toasts.pop(), {
    message: 'Login realizado com sucesso!',
    type: 'success',
  });
});

test('faz fallback para redirect quando popup é bloqueado', { concurrency: false }, async () => {
  const storage = createStorage();
  const { loginBtn, loginLoading, loginError } = setupLoginDom();
  const app = new EducaFlowPro({ autoInit: false, sessionStorage: storage });

  let redirectCalls = 0;
  app.auth = {
    signInWithPopup: async () => {
      const error = new Error('Popup bloqueado');
      error.code = 'auth/popup-blocked';
      throw error;
    },
    signInWithRedirect: async () => {
      redirectCalls += 1;
    },
  };
  app.googleProvider = {};
  app.showToast = noop;
  app.hideSplash = noop;
  app.showLogin = noop;

  await app.attemptLogin();

  assert.strictEqual(redirectCalls, 1, 'redirect deve ser chamado uma vez');
  assert.strictEqual(storage.getItem('redirectInProgress'), 'true', 'flag de redirect deve ser registrada');
  assert.strictEqual(loginBtn.disabled, false, 'botão deve ser reabilitado');
  assert.ok(loginLoading.classList.contains('hidden'), 'loading deve ser oculto após tentativa');
  assert.ok(loginError.classList.contains('hidden'), 'erro de login não deve aparecer no fallback');
});

test('exibe mensagem amigável quando domínio não está autorizado', { concurrency: false }, async () => {
  const storage = createStorage();
  const { loginBtn, loginLoading, loginError, loginErrorMessage } = setupLoginDom();
  const app = new EducaFlowPro({ autoInit: false, sessionStorage: storage });

  const toasts = [];
  app.auth = {
    signInWithPopup: async () => {
      const error = new Error('Domínio não autorizado');
      error.code = 'auth/unauthorized-domain';
      throw error;
    },
    signInWithRedirect: async () => {
      throw new Error('Redirect não deve ser chamado quando o domínio é inválido');
    },
  };
  app.googleProvider = {};
  app.showToast = (message, type) => toasts.push({ message, type });
  app.hideSplash = noop;
  app.showLogin = noop;

  await app.attemptLogin();

  const expectedMessage =
    'Domínio não autorizado no Firebase. Adicione o domínio do site às configurações de autenticação.';

  assert.strictEqual(loginBtn.disabled, false, 'botão deve ser reabilitado após erro');
  assert.ok(loginLoading.classList.contains('hidden'), 'loading deve ser oculto mesmo após erro');
  assert.ok(!loginError.classList.contains('hidden'), 'erro deve ser exibido ao usuário');
  assert.strictEqual(loginErrorMessage.textContent, expectedMessage);
  const lastToast = toasts.pop();
  assert.ok(lastToast, 'deve exibir toast de erro');
  assert.strictEqual(lastToast.message, expectedMessage);
  assert.strictEqual(lastToast.type, 'error');
  assert.strictEqual(storage.getItem('redirectInProgress'), null, 'flag de redirect deve ser limpa ao falhar');
});

process.on('exit', () => {
  global.setTimeout = originalSetTimeout;
});
