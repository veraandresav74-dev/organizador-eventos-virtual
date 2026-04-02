const crypto = require('crypto');
const { getUserByEmail } = require('./supabase');

async function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan email y/o contraseña.' });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Email no encontrado.' });
    }

    const hash = await sha256(password);
    if (hash !== user.password_hash) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    return res.status(200).json({
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
    console.error('[login] Error:', err.message);
    return res.status(500).json({ error: 'Error al iniciar sesión.', detail: err.message });
  }
};
