'use strict';
// Shared by the extension and the injected Agent Host (no VS Code dependencies).
function checklistChannel(value) {
 if(typeof value!=='string'||value.length>2048)throw Error('Invalid checklist chat.');
 if(value.startsWith('ahp-chat://')) {
  const url=new URL(value),parts=url.pathname.slice(1).split('/');
  const session=Buffer.from(parts[0],'base64url').toString('utf8');
  const chat=url.hostname==='subagent'?'subagent/'+decodeURIComponent(parts.slice(1).join('/')):url.hostname;
  if(session.startsWith('ahp-chat:')||!chat)throw Error('Invalid checklist chat.');
  return checklistChannel(session)+(chat==='default'?'':'#'+encodeURIComponent(chat));
 }
 const match=/^(?:agent-host-)?(codex|grok|deepseek):([^?#]+)(?:\?[^#]*)?(?:#(.*))?$/.exec(value);
 if(!match||!match[2].startsWith('/'))throw Error('Checklist requires a local Agent Host chat.');
 const chat=match[3]?decodeURIComponent(match[3]):'default';
 return match[1]+':'+decodeURIComponent(match[2])+(chat==='default'?'':'#'+encodeURIComponent(chat));
}
function validateChecklist(value) {
 if(typeof value==='string')value=JSON.parse(value);
 const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 if(!value||!text(value.id,200)||!Array.isArray(value.items)||value.items.length>1000)throw Error('Provide a checklist ID and up to 1000 items.');
 if(value.title!==undefined&&!text(value.title,300))throw Error('Invalid checklist title.');
 if(value.mode!==undefined&&!['merge','replace'].includes(value.mode))throw Error('Use merge or replace.');
 const seen=new Set();
 const items=value.items.map(item=>{
  if(!item||!text(item.id,200)||seen.has(item.id)||!text(item.text,4000)||!['pending','in_progress','completed','blocked'].includes(item.status))throw Error('Items require unique IDs, text and a valid status.');
  seen.add(item.id);return {id:item.id,text:item.text,status:item.status};
 });
 return {id:value.id,...value.title===undefined?{}:{title:value.title},mode:value.mode||'merge',items};
}
function mergeChecklist(previous, value) {
 const update=validateChecklist(value), old=previous?.lists||[];
 const prior=old.find(list=>list.id===update.id);
 const items=new Map((update.mode==='replace'?[]:prior?.items||[]).map(item=>[item.id,item]));
 for(const item of update.items)items.set(item.id,item);
 if(items.size>1000)throw Error('A checklist can contain at most 1000 items.');
 const next={id:update.id,title:update.title||prior?.title||'Tasks',items:[...items.values()]};
 if(!prior&&old.length>=30)throw Error('A chat can contain at most 30 checklists.');
 return {version:1,revision:(previous?.revision||0)+1,lists:prior?old.map(list=>list.id===next.id?next:list):[...old,next]};
}
async function checklistStorage(channel, update, root) {
 const fs=await import('node:fs/promises'),path=await import('node:path'),os=await import('node:os'),crypto=await import('node:crypto');
 channel=checklistChannel(channel);
 root=root||path.join(os.homedir(),'.agents-pro','checklists');
 const key=crypto.createHash('sha256').update(channel).digest('hex'),file=path.join(root,key+'.json');
 const read=async()=>{try{const data=JSON.parse(await fs.readFile(file,'utf8'));if(data.version!==1||!Array.isArray(data.lists))throw Error('Invalid saved checklist');return data}catch(e){if(e.code==='ENOENT')return {version:1,revision:0,lists:[]};throw e}};
 if(update===undefined)return read();
 update=validateChecklist(update);
 await fs.mkdir(root,{recursive:true,mode:0o700});
 const lock=file+'.lock';let handle;
 for(let n=0;n<100;n++){try{handle=await fs.open(lock,'wx',0o600);break}catch(e){if(e.code!=='EEXIST')throw e;await new Promise(resolve=>setTimeout(resolve,25))}}
 if(!handle)throw Error('Checklist is busy. Retry the update.');
 const temp=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';
 try{const data=mergeChecklist(await read(),update);await fs.writeFile(temp,JSON.stringify(data),{mode:0o600});await fs.rename(temp,file);return data}
 finally{await fs.rm(temp,{force:true});await handle.close();await fs.rm(lock,{force:true})}
}
module.exports={checklistChannel,validateChecklist,mergeChecklist,checklistStorage};
