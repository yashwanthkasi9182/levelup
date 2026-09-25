import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { buildPlanRequest, parsePlanResponse, PlanResponseError } from '@/lib/goal-plan';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const token = request.headers.get('authorization');
  if (!token?.startsWith('Bearer '))
    return Response.json({ error: 'Sign in to use goal planning.' }, { status: 401 });
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: token } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token.slice(7));
  if (error || !user)
    return Response.json({ error: 'Your session expired. Please sign in again.' }, { status: 401 });
  if (!process.env.GROQ_API_KEY)
    return Response.json(
      { error: 'AI planning has not been configured. You can still create a goal manually.' },
      { status: 503 },
    );
  let input;
  try {
    input = z.object({ goal: z.string().trim().min(5).max(1000) }).parse(await request.json());
  } catch {
    return Response.json({ error: 'Describe your goal in 5–1000 characters.' }, { status: 400 });
  }
  const budget = await db.rpc('consume_ai_request');
  if (budget.error)
    return Response.json(
      { error: 'Goal planning is unavailable. Check the database setup.' },
      { status: 503 },
    );
  if (!budget.data)
    return Response.json(
      {
        error:
          'You have used today’s 10 planning requests. Try again tomorrow, or create a goal manually.',
      },
      { status: 429 },
    );
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify(
        buildPlanRequest(input.goal, process.env.GROQ_MODEL || 'openai/gpt-oss-20b'),
      ),
    });
    if (!response.ok) {
      const upstream = await response.json().catch(() => null);
      const code = upstream?.error?.code;
      // Log diagnostics, never the API key, bearer token, or goal text.
      console.error('[goal-planner] Groq rejected request', {
        status: response.status,
        code: typeof code === 'string' ? code : 'unknown',
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      });
      if (code === 'model_not_found' || response.status === 404)
        return Response.json(
          {
            error:
              'The configured AI model is unavailable. Update GROQ_MODEL to a model enabled for your Groq account and restart the server.',
          },
          { status: 503 },
        );
      if (response.status === 401 || response.status === 403)
        return Response.json(
          {
            error:
              'AI planning is not authorized. Check the server’s Groq key and model permissions.',
          },
          { status: 503 },
        );
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        return Response.json(
          {
            error:
              'The AI provider’s usage limit was reached. Try again shortly or continue manually.',
          },
          { status: 429, headers: retryAfter ? { 'Retry-After': retryAfter } : undefined },
        );
      }
      return Response.json(
        {
          error:
            'The AI provider could not complete this request. Try again shortly or continue manually.',
        },
        { status: 502 },
      );
    }
    const result = await response.json();
    const plan = parsePlanResponse(result);
    return Response.json({ plan }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const timeout =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    const code =
      error instanceof PlanResponseError
        ? error.code
        : timeout
          ? 'planner_timeout'
          : 'planner_connection_error';
    console.error('[goal-planner] Request failed', { code });
    const messages = {
      incomplete_plan: 'The AI response was cut short. Please try again.',
      refused_plan:
        'The planner could not create this plan. Rephrase the goal or continue manually.',
      invalid_plan: 'The AI returned an invalid plan. Please try again or continue manually.',
      planner_timeout: 'The AI planner took too long to respond. Please try again.',
      planner_connection_error: 'Could not connect to the AI planner. Please try again shortly.',
    };
    return Response.json({ error: messages[code], code }, { status: timeout ? 504 : 502 });
  }
}
