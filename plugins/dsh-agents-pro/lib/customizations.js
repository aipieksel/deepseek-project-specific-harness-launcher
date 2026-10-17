import { readdir, readFile, writeFile, mkdir, realpath, lstat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
export function customizationRoot(scope, kind, cwd) {
  if(!['user','workspace'].includes(scope)||!['agents','instructions'].includes(kind))throw new Error('Choose User or Workspace and agents or instructions');
  return join(scope==='user'?join(homedir(),'.copilot'):join(cwd,'.github'),kind);
}
export async function customizations(cwd, input={}) {
  if(input.action==='save') {
    if(!/^[\w .-]{1,100}$/.test(input.name)||input.name.startsWith('.')||typeof input.content!=='string'||input.content.length>100000)throw new Error('Use a filename without path separators and content below 100 KB');
    const root=customizationRoot(input.scope,input.kind,cwd);await mkdir(root,{recursive:true});
    const suffix=input.kind==='agents'?'.agent.md':'.instructions.md';
    const file=join(root,input.name.endsWith(suffix)?input.name:input.name+suffix);
    if(await lstat(file).then(s=>s.isSymbolicLink(),()=>false))throw new Error('Cannot overwrite a symbolic link');
    await writeFile(file,input.content,{mode:0o600});
  }
  const rows=[];
  for(const scope of ['user','workspace'])for(const kind of ['agents','instructions']) {
    const root=customizationRoot(scope,kind,cwd);
    for(const name of await readdir(root).catch(()=>[])) {
      if(!name.endsWith('.md'))continue;
      const file=join(root,name), resolved=await realpath(file);
      if(!resolved.startsWith((await realpath(root))+sep))continue;
      rows.push({scope,kind,name,path:file,content:await readFile(file,'utf8')});
    }
  }
  return rows;
}
export function markdownFromEvents(events, title='Chat') {
  const rows=['# '+title,''];
  for(const event of events) {
    if(!['user/message','assistant/message'].includes(event.type))continue;
    const data=event.data?.message||event.data;
    if(event.type==='user/message'&&data?.source?.kind&&data.source.kind!=='user')continue;
    const content=data?.content||[];
    rows.push('## '+(event.type==='user/message'?'You':'Agent'),'');
    for(const block of content) {
      if(block.type==='text')rows.push(block.text,'');
      else if(block.type==='image'||block.type==='file')rows.push(`[${block.type}: ${block.attachment?.name||block.attachment?.id||'attachment'}]`,'');
    }
    if(typeof data?.text==='string'&&!content.length)rows.push(data.text,'');
  }
  return rows.join('\n');
}

export async function selectedAgent(storage,id,path) {
  if(typeof id!=='string'||!id)throw Error('Choose a session first');
  const dir=join(storage,'selected-agents'),file=join(dir,createHash('sha256').update(id).digest('hex')+'.json');
  if(path!==undefined){await mkdir(dir,{recursive:true});await writeFile(file,JSON.stringify({path}),{mode:0o600});}
  return readFile(file,'utf8').then(JSON.parse).catch(()=>({path:''}));
}
export function instructionText(rows,selected) {
  return rows.filter(row=>row.kind==='instructions'||row.path===selected.path).map(row=>{
    const match=row.content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/),front=match?.[1]||'',body=match?row.content.slice(match[0].length):row.content;
    if(/^alwaysApply:\s*false\s*$/m.test(front)&&!/^applyTo:/m.test(front))return '';
    const glob=front.match(/^applyTo:\s*(.+)$/m)?.[1];
    return `Instructions from ${row.path}${glob?` (apply only to files matching ${glob})`:''}:\n${body}`;
  }).filter(Boolean).join('\n\n');
}
