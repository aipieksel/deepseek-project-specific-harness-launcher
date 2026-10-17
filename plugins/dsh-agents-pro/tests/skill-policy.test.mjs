import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SkillPolicy, installSkillPolicy } from '../lib/skill-policy.js';
import { harness } from '../lib/runtime.js';
import { skillCatalog } from '../lib/settings-catalog.js';
test('native registry defaults off, preserves settings catalog, persists project choices and rejects disabled loads', async () => {
 const root=await mkdtemp(join(tmpdir(),'ap-policy-'));
 const {Context}=await harness('cordis');
 const {SkillRegistry}=await harness('dsh-skill');
 const ctx=new Context();
 try {
  new SkillRegistry(ctx);
  ctx.skills.register({name:'workflow',description:'Test',content:'Body',source:'test'});
  const policy=new SkillPolicy(root), raw=installSkillPolicy(ctx,policy);
  const options={cwd:join(root,'one')};
  assert.deepEqual(await ctx.skills.list(options),[]);
  assert.equal(await ctx.skills.get('workflow',options),undefined);
  const catalog=await skillCatalog({sessions:{get:()=>({header:{cwd:options.cwd}})}},'one',undefined,undefined,raw,policy);
  assert.equal(catalog.skills[0].enabled,false);
  assert.equal((await raw.get('workflow',options)).content,'Body');
  await policy.set(options.cwd,'workflow',true);
  assert.equal((await ctx.skills.list(options))[0].name,'workflow');
  assert.equal((await ctx.skills.get('workflow',options)).content,'Body');
  assert((await new SkillPolicy(root).enabled(options.cwd)).has('workflow'));
  assert.deepEqual(await ctx.skills.list({cwd:join(root,'two')}),[]);
  ctx.skills.register({name:'new-skill',description:'New',content:'New',source:'test'});
  assert.deepEqual((await ctx.skills.list(options)).map(s=>s.name),['workflow']);
  await policy.set(options.cwd,'workflow',false);
  assert.equal(await ctx.skills.get('workflow',options),undefined);
  await assert.rejects(policy.set(options.cwd,'../bad',true));
  await assert.rejects(policy.set(options.cwd,'workflow','true'));
 } finally { await ctx.fiber.dispose(); await rm(root,{recursive:true,force:true}); }
});
