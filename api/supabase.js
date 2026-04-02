const { createClient } = require('@supabase/supabase-js');

let _client = null;

function getSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Faltan variables SUPABASE_URL o SUPABASE_SERVICE_KEY');
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// ── Usuarios ────────────────────────────────────────────

async function getUserByEmail(email) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('app_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getUserById(id) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('app_users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createUser({ id, name, email, passwordHash, plan, trialEndsAt, subscriptionEndsAt, status }) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('app_users')
    .insert({
      id,
      name,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      plan,
      status,
      registered_at: new Date().toISOString(),
      trial_ends_at: trialEndsAt || null,
      subscription_ends_at: subscriptionEndsAt || null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateUserPlan(email, { plan, status, trialEndsAt, subscriptionEndsAt }) {
  const sb = getSupabase();
  const patch = { plan, status };
  if (trialEndsAt !== undefined)        patch.trial_ends_at        = trialEndsAt;
  if (subscriptionEndsAt !== undefined) patch.subscription_ends_at = subscriptionEndsAt;
  const { data, error } = await sb
    .from('app_users')
    .update(patch)
    .eq('email', email.toLowerCase())
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Pagos ────────────────────────────────────────────────

async function recordPayment({ paymentId, email, plan, amount, currency, status }) {
  const sb = getSupabase();
  const { error } = await sb
    .from('payments')
    .upsert({
      payment_id: String(paymentId),
      email: email.toLowerCase(),
      plan,
      amount,
      currency,
      status,
      created_at: new Date().toISOString()
    }, { onConflict: 'payment_id' });
  if (error) console.error('[supabase] recordPayment error:', error.message);
}

module.exports = { getSupabase, getUserByEmail, getUserById, createUser, updateUserPlan, recordPayment };
