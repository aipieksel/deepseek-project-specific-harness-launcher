import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,symlink,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prompts } from '../lib/prompts.js';
import { skillDirectories } from '../lib/global-skills.js';
import { checklist,resumeChecklist } from '../lib/checklists.js';
test('prompt override survives reads and never changes shipped source; invalid paths rejected',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ap-prompts-')),bundled=join(root,'bundled'),storage=join(root,'state');try{
 await mkdir(bundled);await writeFile(join(bundled,'developer.md'),'Original instructions');
 await prompts(bundled,storage,{name:'developer',text:'Changed instructions'});
 assert.equal((await prompts(bundled,storage))[0].text,'Changed instructions');
 assert.equal(await readFile(join(bundled,'developer.md'),'utf8'),'Original instructions');
 await assert.rejects(prompts(bundled,storage,{name:'../escape',text:'x'}));
 await assert.rejects(prompts(bundled,storage,{name:'developer',text:' '}));
 assert.equal((await prompts(bundled,storage))[0].text,'Changed instructions');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('global skill collections resolve nested symlinks and cycles without scanning skill assets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ap-skills-'));try{
 const bundle=join(root,'collections','shared','workflow');await mkdir(bundle,{recursive:true});await writeFile(join(bundle,'SKILL.md'),'---\nname: workflow\ndescription: test\n---\nBody');
 await mkdir(join(root,'user'));await symlink(join(root,'collections'),join(root,'user','shared'));await symlink(join(root,'user'),join(root,'collections','cycle'));
 await mkdir(join(bundle,'examples','not-a-skill'),{recursive:true});await writeFile(join(bundle,'examples','not-a-skill','SKILL.md'),'fake');
 assert.deepEqual(await skillDirectories([join(root,'user')]),[join(root,'collections','shared')]);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('resume uses current owning list, excludes completed/running tasks, retains stable IDs and statuses',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ap-resume-'));try{
 const items=[{id:'R1',text:'Done',status:'completed'},{id:'R2',text:'Pending',status:'pending'},{id:'R3',text:'Blocked',status:'blocked'},{id:'R4',text:'Running',status:'in_progress'}];
 await checklist('one',{id:'existing',items},root);const before=await checklist('one',undefined,root);
 const request=resumeChecklist(before.lists,'existing');assert.deepEqual(request.itemIds,['R2','R3']);assert.match(request.text,/existing/);assert.match(request.text,/merge/);
 assert.deepEqual((await checklist('one',undefined,root)).lists[0].items,items);
 assert.throws(()=>resumeChecklist([], 'existing'),/not found/);
 assert.throws(()=>resumeChecklist([{id:'done',items:[items[0]]}], 'done'),/no pending/);
 assert.deepEqual((await checklist('two',undefined,root)).lists,[]);
 }finally{await rm(root,{recursive:true,force:true});}
});
