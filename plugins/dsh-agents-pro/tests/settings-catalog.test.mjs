import test from 'node:test';
import assert from 'node:assert/strict';
import { cliConnections, skillCatalog } from '../lib/settings-catalog.js';

test('CLI discovery distinguishes missing binaries without claiming authentication', async () => {
  const rows = await cliConnections(async id => {
    if (id === 'grok-cli') throw new Error('private diagnostic');
    return '/test/codex';
  });
  assert.equal(rows[0].available, true);
  assert.equal(rows[0].executable, '/test/codex');
  assert.equal(rows[0].authenticated, undefined);
  assert.equal(rows[1].available, false);
  assert.equal(rows[1].executable, null);
  assert(!JSON.stringify(rows).includes('private diagnostic'));
});

test('settings catalog uses native winning registry and current session workspace for list and body', async () => {
  const signal = new AbortController().signal;
  const calls = [];
  const ctx = {
    sessions: { get: id => id === 'one' ? {header:{cwd:'/project/one'}} : undefined },
    skills: {
      snapshot: async options => { calls.push(options); return {complete:false,skills:[{name:'workflow',provider:'project'}]}; },
      get: async (name, options) => { calls.push(options); return name === 'workflow' ? {name,content:'Project wins',path:'/project/one/.agents/skills/workflow/SKILL.md'} : undefined; }
    }
  };
  const catalog = await skillCatalog(ctx,'one',undefined,signal);
  assert.equal(catalog.complete,false);
  assert.equal(catalog.skills[0].provider,'project');
  assert.equal((await skillCatalog(ctx,'one','workflow',signal)).content,'Project wins');
  assert.deepEqual(calls,[{cwd:'/project/one',signal},{cwd:'/project/one',signal}]);
  await assert.rejects(skillCatalog(ctx,'missing'),/Session is unavailable/);
  await assert.rejects(skillCatalog(ctx,'one','missing'),/no longer available/);
});
