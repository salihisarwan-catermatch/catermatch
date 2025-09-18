export async function notifyEmail({ to, subject, html }) {
  try {
    const resp = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ to, subject, html })
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) {
      console.error('[notifyEmail] error:', data);
    }
    return data;
  } catch (e) {
    console.error('[notifyEmail] fetch error', e);
    return { ok:false, error: String(e) };
  }
}