/* Signup, login and client session state. */
(() => {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('pulse.user') || 'null'); } catch (_) { user = null; }
  const saveUser = value => { user = value; try { if (value) localStorage.setItem('pulse.user', JSON.stringify(value)); else localStorage.removeItem('pulse.user'); } catch (_) { /* memory-only session */ } };
  const logout = () => { window.PulseApi.setToken(''); saveUser(null); };
  const session = () => user;
  window.PulseAuth = { session, saveUser, logout };

  const form = document.getElementById('authForm');
  if (!form) return;
  let mode = 'login';
  const errorHost = document.getElementById('authError');
  function setMode(next) {
    mode = next;
    const signup = mode === 'signup';
    document.getElementById('nameField').hidden = !signup;
    document.getElementById('keepRow').hidden = signup;
    document.getElementById('authTitle').textContent = signup ? 'Create your workspace' : 'Welcome back';
    document.getElementById('authSubtitle').textContent = signup ? 'Start listening to the Lumen phone conversation.' : 'Sign in to your listening workspace.';
    document.getElementById('submitAuth').textContent = signup ? 'Create account' : 'Sign in to Pulse';
    document.getElementById('password').autocomplete = signup ? 'new-password' : 'current-password';
    document.querySelectorAll('[data-auth-mode]').forEach(button => {
      const active = button.dataset.authMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    errorHost.textContent = '';
    form.querySelectorAll('.field-error').forEach(item => item.textContent = '');
  }
  document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.authMode)));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorHost.textContent = '';
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    document.querySelector('[data-error="email"]').textContent = validEmail ? '' : 'Enter a valid email address.';
    document.querySelector('[data-error="password"]').textContent = password.length >= 6 ? '' : 'Password must be at least 6 characters.';
    document.querySelector('[data-error="name"]').textContent = mode === 'signup' && !name ? 'Enter your name.' : '';
    if (!validEmail || password.length < 6 || (mode === 'signup' && !name)) return;
    const submit = document.getElementById('submitAuth');
    submit.disabled = true;
    submit.textContent = mode === 'signup' ? 'Creating account…' : 'Signing in…';
    try {
      const body = mode === 'signup' ? { email, password, name } : { email, password };
      const result = await window.PulseApi.request(`/auth/${mode}`, { method: 'POST', body });
      window.PulseApi.setToken(result.token);
      window.PulseAuth.saveUser(result.user);
      window.location.href = 'app.html#home';
    } catch (error) {
      errorHost.textContent = error.message;
    } finally {
      submit.disabled = false;
      submit.textContent = mode === 'signup' ? 'Create account' : 'Sign in to Pulse';
    }
  });
  if (window.PulseApi.getToken()) window.location.href = 'app.html#home';
})();
