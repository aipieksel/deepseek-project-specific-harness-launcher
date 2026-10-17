import { readFile, writeFile, mkdir, rename, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

// Keep skills installed and inspectable. Only explicit project opt-ins are exposed
// to Harness consumers. Separate files avoid cross-project read/modify/write races.
export class SkillPolicy {
  constructor(storage) { this.directory = join(storage, 'skills'); this.writes = Promise.resolve(); }
  async file(cwd) {
    const path = await realpath(cwd || process.cwd()).catch(() => resolve(cwd || process.cwd()));
    return join(this.directory, createHash('sha256').update(path).digest('hex') + '.json');
  }
  async enabled(cwd) {
    try {
      const value = JSON.parse(await readFile(await this.file(cwd), 'utf8'));
      if (!Array.isArray(value.enabled) || value.enabled.some(n => typeof n !== 'string')) throw Error('Invalid skill preferences');
      return new Set(value.enabled);
    } catch (error) { if (error.code === 'ENOENT') return new Set(); throw error; }
  }
  set(cwd, name, enabled) {
    if (typeof name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || typeof enabled !== 'boolean') return Promise.reject(Error('Invalid skill selection'));
    const result = this.writes.then(async () => {
      const names = await this.enabled(cwd);
      if (enabled) names.add(name); else names.delete(name);
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const file = await this.file(cwd), temp = file + '.' + randomUUID();
      await writeFile(temp, JSON.stringify({ version: 1, enabled: [...names].sort() }, null, 2), { mode: 0o600 });
      await rename(temp, file);
    });
    this.writes = result.catch(() => {});
    return result;
  }
}

// Native registry has no visibility hook. Adapt its public boundary in this plugin,
// retaining receiver/scope and original discovery precedence. Never mutate providers.
export function installSkillPolicy(ctx, policy) {
  const registry = ctx.skills;
  const snapshot = registry.snapshot, get = registry.get;
  const raw = { snapshot: options => snapshot.call(registry, options), get: (name, options) => get.call(registry, name, options) };
  const filteredSnapshot = async function(options = {}) {
    const catalog = await snapshot.call(this, options), enabled = await policy.enabled(options.cwd);
    return { ...catalog, skills: catalog.skills.filter(skill => enabled.has(skill.name)) };
  };
  const filteredGet = async function(name, options = {}) {
    if (!(await policy.enabled(options.cwd)).has(name)) return undefined;
    const skill = await get.call(this, name, options);
    // Recheck in case the user disabled it during a provider read.
    return (await policy.enabled(options.cwd)).has(name) ? skill : undefined;
  };
  registry.snapshot = filteredSnapshot;
  registry.get = filteredGet;
  ctx.effect(() => () => {
    if (registry.snapshot === filteredSnapshot) registry.snapshot = snapshot;
    if (registry.get === filteredGet) registry.get = get;
  }, 'agents-pro skill visibility');
  return raw;
}
