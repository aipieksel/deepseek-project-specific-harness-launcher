import { readdir, stat, realpath } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { harness } from './runtime.js';
// Harness scans one level; Codex permits nested, symlinked skill collections.
// Discover container roots only, leaving parsing, precedence, reads and watching to Harness.
export async function skillDirectories(roots){
  const visited=new Set(), containers=new Set();
  async function walk(path,depth){
    if(depth>7)return;
    const resolved=await realpath(path).catch(()=>null);if(!resolved||visited.has(resolved))return;
    visited.add(resolved);
    if((await stat(join(resolved,'SKILL.md')).catch(()=>null))?.isFile()){containers.add(dirname(resolved));return;}
    for(const entry of await readdir(resolved,{withFileTypes:true}).catch(()=>[])){
      if(['node_modules','.git','.cache','dist','build','archives','backups'].includes(entry.name)||entry.name.startsWith('.')&&entry.name!=='.system')continue;
      const next=join(resolved,entry.name);
      if(entry.isDirectory()||entry.isSymbolicLink()&&(await stat(next).catch(()=>null))?.isDirectory())await walk(next,depth+1);
    }
  }
  for(const root of roots)if(root)await walk(root,0);
  return [...containers].sort();
}
export async function registerGlobalSkills(ctx){
  const home=homedir(), roots=[join(home,'.agents/skills'),join(home,'.codex/skills'),process.env.CODEX_HOME&&join(process.env.CODEX_HOME,'skills')];
  const profile=join(home,'Library/Application Support/VS Code Codex Pro 2/agent-host');
  for(const name of await readdir(profile).catch(()=>[]))if(name.startsWith('codex-home-'))roots.push(join(profile,name,'skills'));
  const dirs=await skillDirectories(roots);
  const {FileSystemSkillProvider}=await harness('dsh-skill-filesystem');
  ctx.skills.registerProvider(control=>new FileSystemSkillProvider(ctx,control,{providerName:'agents-pro-global',includeDefaultRoots:false,customSkillDirs:dirs,watch:true}));
}
