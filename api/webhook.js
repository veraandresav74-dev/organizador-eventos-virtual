const crypto = require('crypto');
const { updateUserPlan, recordPayment } = require('./supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verificación de firma MP
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret) {
    const xSignature  = req.headers['x-signature'];
    const xRequestId  = req.headers['x-request-id'];
    if (xSignature && xRequestId) {
      const dataId   = req.query['data.id'] || req.body?.data?.id || '';
      const ts       = xSignature.split(',').find(s => s.startsWith('ts='))?.split('=')[1] || '';
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const hmac     = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
      const v1       = xSignature.split(',').find(s => s.startsWith('v1='))?.split('=')[1];
      if (v1 && hmac !== v1) {
        console.warn('[webhook] Firma inválida');
        return res.status(401).end();
      }
    }
  }

  const { type, data, action } = req.body || {};
  console.log('[webhook] Evento:', { type, action, id: data?.id });

  if (type === 'payment' && data?.id) {
    try {
      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${data.id}`,
        { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
      );
      const payment = await mpRes.json();
      const ref     = payment.external_reference
        ? JSON.parse(payment.external_reference)
        : {};
      const email   = ref.email || payment.payer?.email;
      const plan    = ref.plan  || 'mievento';

      // Guardar registro del pago en Supabase
      await recordPayment({
        paymentId: data.id,
        email,
        plan,
        amount:   payment.transaction_amount,
        currency: payment.currency_id,
        status:   payment.status
      });

      if (payment.status === 'approved') {
        const now = Date.now();
        const patch = plan === 'organizador'
          ? { plan: 'organizador', status: 'active', subscriptionEndsAt: new Date(now + 365*86400000).toISOString(), trialEndsAt: null }
          : { plan: 'mievento',    status: 'active', trialEndsAt: new Date(now + 30*86400000).toISOString() };

        await updateUserPlan(email, patch);
        console.log(`[webhook] Plan actualizado → ${email} → ${plan}`);
      }
    } catch (err) {
      console.error('[webhook] Error procesando pago:', err.message);
    }
  }

  if (type === 'subscription_preapproval') {
    console.log('[webhook] Suscripción:', action, data?.id);
  }

  return res.status(200).end();
};
