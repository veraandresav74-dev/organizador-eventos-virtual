const crypto = require('crypto');
const { getUserByEmail, createUser } = require('./supabase');

async function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { name, email, password, plan } = req.body || {};

  if (!name || !email || !password || !plan) {
    return res.status(400).json({ error: 'Faltan campos requeridos: name, email, password, plan.' });
  }
  if (!['mievento', 'organizador'].includes(plan)) {
    return res.status(400).json({ error: 'Plan inválido.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Este email ya está registrado.' });
    }

    const now = Date.now();
    const id  = 'u_' + now + '_' + crypto.randomBytes(4).toString('hex');
    const passwordHash = await sha256(password);

    const user = await createUser({
      id,
      name: name.trim(),
      email,
      passwordHash,
      plan,
      status: plan === 'mievento' ? 'trial' : 'active',
      trialEndsAt: plan === 'mievento'
        ? new Date(now + 30 * 86400000).toISOString()
        : null,
      subscriptionEndsAt: plan === 'organizador'
        ? new Date(now + 365 * 86400000).toISOString()
        : null
    });

    return res.status(201).json({
      id:                  user.id,
      name:                user.name,
      email:               user.email,
      plan:                user.plan,
      status:              user.status,
      registeredAt:        user.registered_at,
      trialEndsAt:         user.trial_ends_at,
      subscriptionEndsAt:  user.subscription_ends_at
    });

  } catch (err) {
    console.error('[register] Error:', err.message);
    return res.status(500).json({ error: 'Error al registrar usuario.', detail: err.message });
  }
};
