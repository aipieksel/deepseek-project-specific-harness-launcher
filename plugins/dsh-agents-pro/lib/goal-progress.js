const inspection = new Set(['read', 'grep', 'glob', 'skill', 'get_goal']);
// Count steps, not parallel reads. A real action resets the inspection run.
export function inspectionRun(events) {
  const steps = new Set(), reads = new Map();
  let calls = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === 'user/message' && event.data?.source?.kind === 'user') break;
    if (event.type !== 'tool/call') continue;
    const call = event.data;
    if (!inspection.has(call.name)) break;
    steps.add(`${call.turn}:${call.step}`); calls++;
    const key = `${call.name}:${call.arguments}`;
    reads.set(key, (reads.get(key) || 0) + 1);
  }
  return { steps: steps.size, calls, repeats: [...reads.values()].reduce((n, count) => n + Math.max(0, count - 1), 0) };
}
export function goalProgressText(goal, events) {
  if (goal?.phase !== 'active') return '';
  const run = inspectionRun(events);
  if (run.steps < 6 || (run.steps < 10 && run.repeats < 3)) return '';
  return `Goal progress check: the last ${run.steps} tool-using steps contained only inspection (${run.calls} calls, ${run.repeats} exact repeats), with no implementation or verification action. Reuse successful results already in this conversation. Continue the current pending task and workflow stage; do not restart planning or reload unrelated skills. If the user authorized implementation and the necessary evidence is available, perform the smallest supported change now using the Harness tools, then verify it and update the existing checklist. If a specific fact is still missing, name that fact and make a targeted check instead of another broad review. Research-only goals and required planning/review still require a concrete finding or completed stage, not forced file edits. Respect current permissions, user constraints and pending answers. Never mark tasks or goals complete without verification.`;
}
export function registerGoalProgress(ctx) {
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next(), agent = context.agent;
    if (!agent) return assembled;
    const goal = ctx.goals.get(agent);
    if (goal?.phase !== 'active') return assembled;
    const events = [];
    for (let i = Math.max(0, agent.session.seq - 250); i < agent.session.seq; i++) {
      const event = agent.session.eventAt(i); if (event) events.push(event);
    }
    const text = goalProgressText(goal, events);
    return text ? {...assembled, sections: [...assembled.sections, {name:'agents-pro-goal-progress',order:952,text}]} : assembled;
  });
}
