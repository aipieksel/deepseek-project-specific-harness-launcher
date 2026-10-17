import { executable } from './cli-adapter.js';

// Report discovery only. Finding a binary is not proof of a valid CLI login.
export async function cliConnections(resolve = executable) {
  return Promise.all([
    { id: 'codex-cli', name: 'Codex CLI', login: 'ChatGPT login', command: 'codex login' },
    { id: 'grok-cli', name: 'Grok CLI', login: 'Grok login', command: 'grok' }
  ].map(async connection => {
    try { return { ...connection, available: true, executable: await resolve(connection.id) }; }
    catch { return { ...connection, available: false, executable: null }; }
  }));
}

export async function skillCatalog(ctx, sessionId, name, signal, registry = ctx.skills, policy) {
  const session = sessionId ? ctx.sessions.get(sessionId) : undefined;
  if (sessionId && !session) throw new Error('Session is unavailable');
  const cwd = session?.header?.cwd || process.cwd();
  const options = { cwd, signal };
  // Use exactly the native winning catalog, including its project precedence.
  if (name !== undefined) {
    if (typeof name !== 'string' || !name) throw new Error('A skill name is required');
    const skill = await registry.get(name, options);
    if (!skill) throw new Error('Skill is no longer available');
    return skill;
  }
  const catalog = await registry.snapshot(options);
  const enabled = policy ? await policy.enabled(cwd) : undefined;
  return { cwd, ...catalog, skills: catalog.skills.map(skill => ({...skill, ...(enabled ? {enabled: enabled.has(skill.name)} : {})})) };
}
