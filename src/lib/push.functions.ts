import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/firebase_messaging';

export const sendPushToUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; title: string; body: string; tag?: string; path?: string }) => data)
  .handler(async ({ data, context }) => {
    // Only admins or the user themselves can send push to a user.
    if (data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
      if (!isAdmin) throw new Error('Forbidden');
    }

    const LOVABLE_API_KEY = process.env['LOVABLE_API_KEY'];
    const connectionApiKey = process.env['FIREBASE_MESSAGING_API_KEY'];
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    if (!connectionApiKey) throw new Error('FIREBASE_MESSAGING_API_KEY not configured');

    const { data: tokens } = await context.supabase
      .from('device_tokens')
      .select('token')
      .eq('user_id', data.userId);

    if (!tokens || tokens.length === 0) return { sent: 0 };

    let sent = 0;
    const errors: string[] = [];

    for (const { token } of tokens) {
      const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': connectionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: data.title, body: data.body },
            data: { tag: data.tag ?? 'deen', path: data.path ?? '/', ...(data.path ? { path: data.path } : {}) },
          },
        }),
      });

      if (res.ok) {
        sent++;
      } else {
        const text = await res.text();
        errors.push(text);
        // Stale token — remove it.
        if (text.includes('UNREGISTERED') || text.includes('INVALID_ARGUMENT')) {
          await context.supabase.from('device_tokens').delete().eq('token', token);
        }
      }
    }

    if (sent === 0 && errors.length > 0) {
      throw new Error(`Push send failed: ${errors[0]}`);
    }

    return { sent, errors: errors.length > 0 ? errors : undefined };
  });
