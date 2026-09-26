'use client';
import { MAX_ACTIVE_GOALS } from '@/lib/limits';
import { useEffect, useRef } from 'react';
import type { Goal } from './model';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void>;
};
/** Progressive enhancement only; unsupported browsers use the normal interface. */
export function useWebMCP(userId: string | undefined, goals: Goal[], openGoal: () => void) {
  const state = useRef({ goals, openGoal });
  state.current = { goals, openGoal };
  useEffect(() => {
    if (!userId) return;
    const context = (document as Document & { modelContext?: Context }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: Tool[] = [
      {
        name: 'read_active_goals',
        description:
          'Read your own active LevelUp goals. Does not include private notes or partner data.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          validateEmpty(input);
          return state.current.goals
            .filter((g) => g.user_id === userId && !g.archived)
            .map((g) => ({
              id: g.id,
              title: g.title,
              action: g.action,
              smallerAction: g.small_action,
              target: g.current_period
                ? {
                    measure: g.current_period.measure,
                    period: g.current_period.period,
                    amount: g.current_period.target,
                    unit: g.current_period.unit,
                  }
                : null,
            }));
        },
      },
      {
        name: 'start_goal_creation',
        description:
          'Open the new-goal form for you to review and complete. This does not create or save a goal.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          validateEmpty(input);
          if (state.current.goals.filter((g) => g.user_id === userId && !g.archived).length >= MAX_ACTIVE_GOALS)
            throw new Error(`You already have ${MAX_ACTIVE_GOALS} active goals.`);
          state.current.openGoal();
          return { status: 'form_opened', saved: false };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(
          () => {},
        );
      } catch {
        /* The regular UI remains available. */
      }
    }
    return () => lifecycle.abort();
  }, [userId]);
}
function validateEmpty(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length)
    throw new Error('Expected an empty object.');
}
