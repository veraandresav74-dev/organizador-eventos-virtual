const { MercadoPagoConfig, Preference } = require('mercadopago');
const { getUserByEmail } = require('./supabase');

const PLANS = {
  mievento: {
    title: 'Plan Mi Evento — Mensual',
    price: 12,
    currency: 'USD'
  },
  organizador: {
    title: 'Plan Organizador de Eventos — Anual',
    price: 30,
    currency: 'USD'
  }
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { userEmail, userName, plan } = req.body || {};

  if (!userEmail || !plan || !PLANS[plan]) {
    return res.status(400).json({ error: 'Faltan datos: userEmail y plan son requeridos.' });
  }

  // Verificar que el usuario existe en Supabase
  try {
    const user = await getUserByEmail(userEmail);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado. Registrate primero.' });
    }
  } catch (err) {
    console.warn('[create-preference] No se pudo verificar usuario en Supabase:', err.message);
    // Continúa aunque falle la verificación (evita bloquear el pago)
  }

  const planData = PLANS[plan];
  const appUrl   = process.env.APP_URL || 'https://tu-app.vercel.app';

  try {
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [{
          title:      planData.title,
          quantity:   1,
          unit_price: planData.price,
          currency_id: planData.currency
        }],
        payer: { email: userEmail, name: userName || '' },
        back_urls: {
          success: `${appUrl}/evento.html?pago=ok&plan=${plan}`,
          failure: `${appUrl}/evento.html?pago=error`,
          pending: `${appUrl}/evento.html?pago=pendiente`
        },
        auto_return: 'approved',
        notification_url: `${appUrl}/api/webhook`,
        external_reference: JSON.stringify({ email: userEmail, plan }),
        statement_descriptor: 'Organizador Eventos',
        expires: false
      }
    });

    return res.status(200).json({
      id:                 result.id,
      init_point:         result.init_point,
      sandbox_init_point: result.sandbox_init_point
    });

  } catch (err) {
    console.error('[create-preference] Error:', err);
    return res.status(500).json({ error: 'Error al crear preferencia de pago.', detail: err.message });
  }
};
