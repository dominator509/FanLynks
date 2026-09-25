const flow = document.body.dataset.flow;
const status = document.getElementById('formStatus');
const emailField = document.getElementById('email');
const tokenField = document.getElementById('turnstileToken');
const form = document.querySelector('form[data-auth-form]');
let widgetId = null;

function showStatus(message, isError = false) {
  if (!status) return;
  status.textContent = message;
  status.dataset.error = isError ? 'true' : 'false';
}

function takeLinkToken() {
  const source = location.hash.slice(1);
  const token = new URLSearchParams(source).get(flow === 'signup' ? 'invite' : 'token') || '';
  if (token) history.replaceState(null, '', location.pathname);
  return token;
}

async function api(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed. Please try again.');
  return payload;
}

function actionForFlow() {
  return ({ signup: 'customer_signup', login: 'customer_login', forgot: 'customer_forgot_password', resend: 'customer_resend_verification' })[flow];
}

async function installTurnstile() {
  const protectedFlows = ['signup', 'login', 'forgot', 'resend'];
  if (!protectedFlows.includes(flow)) return;
  try {
    const response = await fetch('/api/customer/config', { cache: 'no-store' });
    const config = await response.json();
    if (flow === 'signup' && config.signupMode === 'invite_only' && !document.getElementById('inviteToken').value) {
      form.hidden = true;
      document.getElementById('inviteRequired').hidden = false;
      return;
    }
    if (!response.ok || !config.turnstileSiteKey) {
      showStatus('The security check is temporarily unavailable. Please try again later.', true);
      form.querySelector('button[type="submit"]').disabled = true;
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.turnstile) return showStatus('The security check did not load. Refresh and try again.', true);
      widgetId = window.turnstile.render('#turnstileWidget', {
        sitekey: config.turnstileSiteKey,
        action: actionForFlow(),
        callback: (token) => { tokenField.value = token; form.querySelector('button[type="submit"]').disabled = false; showStatus(''); },
        'expired-callback': () => { tokenField.value = ''; form.querySelector('button[type="submit"]').disabled = true; showStatus('Complete the security check again.'); },
        'error-callback': () => { tokenField.value = ''; form.querySelector('button[type="submit"]').disabled = true; showStatus('Security check failed to load. Refresh and try again.', true); }
      });
      form.querySelector('button[type="submit"]').disabled = true;
    };
    script.onerror = () => showStatus('The security check did not load. Refresh and try again.', true);
    document.head.append(script);
  } catch {
    showStatus('Could not load account security settings. Please try again later.', true);
  }
}

async function submitAuth(event) {
  event.preventDefault();
  const data = new FormData(form);
  const turnstileToken = tokenField?.value || '';
  const email = String(data.get('email') || '').trim().toLowerCase();
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  showStatus('Working…');
  try {
    if (flow === 'signup') {
      const password = String(data.get('password') || '');
      if (password !== String(data.get('confirmPassword') || '')) throw new Error('Passwords do not match.');
      const result = await api('/api/customer/signup', { email, fullName: data.get('fullName'), pageSlug: data.get('pageSlug'), password, inviteToken: document.getElementById('inviteToken').value, turnstileToken });
      showStatus(result.message || 'Check your inbox for the confirmation link.');
    } else if (flow === 'login') {
      await api('/api/customer/login', { email, password: data.get('password'), turnstileToken });
      location.assign('/dashboard');
    } else if (flow === 'forgot') {
      const result = await api('/api/customer/forgot-password', { email, turnstileToken });
      showStatus(result.message);
    } else if (flow === 'resend') {
      const result = await api('/api/customer/resend-verification', { email, turnstileToken });
      showStatus(result.message);
    } else if (flow === 'reset') {
      const password = String(data.get('password') || '');
      if (password !== String(data.get('confirmPassword') || '')) throw new Error('Passwords do not match.');
      const result = await api('/api/customer/reset-password', { token: document.getElementById('accountToken').value, password });
      showStatus(result.message || 'Password updated. Sign in with your new password.');
      form.reset();
    }
  } catch (error) {
    showStatus(error.message || 'Request failed. Please try again.', true);
  } finally {
    if (tokenField) tokenField.value = '';
    if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
    if (submit && ['signup', 'login', 'forgot', 'resend'].includes(flow)) submit.disabled = true;
  }
}

async function confirmEmail() {
  const button = document.getElementById('confirmEmailBtn');
  const token = document.getElementById('accountToken').value;
  if (!token) return showStatus('This confirmation link is invalid or expired.', true);
  button.disabled = true;
  showStatus('Confirming email…');
  try {
    const result = await api('/api/customer/verify-email', { token });
    showStatus(result.message);
  } catch (error) {
    showStatus(error.message || 'This confirmation link is invalid or expired.', true);
  }
}

const linkToken = takeLinkToken();
if (flow === 'signup') document.getElementById('inviteToken').value = linkToken;
if (flow === 'verify' || flow === 'reset') document.getElementById('accountToken').value = linkToken;
if (flow === 'verify') document.getElementById('confirmEmailBtn').addEventListener('click', confirmEmail);
if (form) form.addEventListener('submit', submitAuth);
if (new URLSearchParams(location.search).get('expired') === '1') showStatus('Your session expired. Sign in again to continue.');
installTurnstile();
