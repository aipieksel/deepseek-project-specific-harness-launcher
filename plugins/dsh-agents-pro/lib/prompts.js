import { readdir, readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
// Shipped prompts are immutable; edits are atomic user overrides.
export async function prompts(bundled, storage, change) {
  const directory=join(storage,'prompts');
  if(change){
    if(!/^[a-zA-Z0-9][\w .-]{0,99}$/.test(change.name)||typeof change.text!=='string'||!change.text.trim()||change.text.length>30000)throw Error('A prompt needs a valid name and 1–30000 characters.');
    await mkdir(directory,{recursive:true,mode:0o700});
    const file=join(directory,change.name+'.md'),temp=file+'.'+randomUUID();
    await writeFile(temp,change.text,{mode:0o600});await rename(temp,file);
  }
  const rows=new Map();
  for(const [dir,custom] of [[bundled,false],[directory,true]])for(const file of (await readdir(dir).catch(e=>{if(e.code==='ENOENT')return [];throw e;})).sort()){
    if(!file.endsWith('.md'))continue;
    const name=file.slice(0,-3);rows.set(name,{name,text:await readFile(join(dir,file),'utf8'),custom});
  }
  return [...rows.values()];
}
