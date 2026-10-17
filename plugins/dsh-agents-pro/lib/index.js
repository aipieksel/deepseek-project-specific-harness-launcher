import { registerGoalProgress } from './goal-progress.js';
import { SkillPolicy, installSkillPolicy } from './skill-policy.js';
import { prompts } from './prompts.js';
import { cliConnections, skillCatalog } from './settings-catalog.js';
import { registerGlobalSkills } from './global-skills.js';
import { configureSettings, getSettings, updateSettings } from './settings.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { CliAdapter } from './cli-adapter.js';
import { harness } from './runtime.js';
import { checklist, resumeChecklist } from './checklists.js';
import { VoiceJobs, cleanup } from './voice.js';
import { customizations, markdownFromEvents, selectedAgent, instructionText } from './customizations.js';
const { defineTool } = await harness('dsh-tools');
const { readSessionLogText, flushLiveSessionLog, sessionLogExportDeps } = await harness('dsh-session-log-export');
const base=dirname(fileURLToPath(import.meta.url));
export const inject=['llm','tools','userQuestions','systemPrompt','connection','sessions','sessionPersistence','attachments','skills','goals'];
const text=(required=false)=>({type:'string',...(required?{required:true}:{})});
const resultOutput={schema:{type:'object',additionalProperties:true,properties:{}},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]};
export async function apply(ctx) {
  await registerGlobalSkills(ctx);
  registerGoalProgress(ctx);
  const storage=process.env.AGENTS_PRO_HOME||join(homedir(),'.agents-pro','harness');
  configureSettings(storage);
  const skillPolicy = new SkillPolicy(storage), skillRegistry = installSkillPolicy(ctx, skillPolicy);
  const lists=join(storage,'checklists'), voices=new VoiceJobs(join(storage,'recordings'));
  ctx.llm.registerAdapter(['codex-cli','grok-cli'],new CliAdapter(ctx.attachments));
  ctx.on('agent/request',async (_request,next)=>{const request=await next();return {...request,provider:request.provider==='xai'?'grok-cli':request.provider==='openai-codex'?'codex-cli':request.provider};});
  ctx.systemPrompt.section({name:'agents-pro',order:950,text:'When you need the user to answer a question, choose, clarify or approve something, call agents_pro_ask_question and wait for the submitted answer. Never assume a reply or continue dependent work while waiting. Publish tasks with agents_pro_update_checklist using stable checklist and item IDs, merge to add/update, and completed only after verification. When the user resumes pending tasks, update that existing checklist and item IDs with merge, preserve completed items, and resolve blockers before dependent work. Use the Tasks panel instead of repeating published checklists in chat.'});
  ctx.tools.register(defineTool({name:'agents_pro_update_checklist',description:'Publish persistent Tasks above this chat. Merge preserves omitted items; replace replaces only this list. Statuses: pending, in_progress, completed, blocked.',parameters:{id:text(true),title:text(),mode:{type:'string',enum:['merge','replace']},items:{type:'array',required:true,items:{type:'object',additionalProperties:false,properties:{id:text(true),text:text(true),status:{type:'string',required:true,enum:['pending','in_progress','completed','blocked']}}}}},output:resultOutput,async execute(args,exec){if(!exec.agent)throw new Error('An owning session is required');const value=await checklist(exec.agent.session.id,args,lists);return{status:'published',id:args.id,revision:value.revision};}}));
  ctx.tools.register(defineTool({name:'agents_pro_ask_question',description:'Ask required questions and wait for submitted answers. No timeout or automatic answer. Supports choices and free text.',parameters:{questions:{type:'array',required:true,items:{type:'object',additionalProperties:false,properties:{id:text(true),question:text(true),header:text(),options:{type:'array',items:{type:'object',additionalProperties:false,properties:{label:text(true),description:text()}}}}}}},output:resultOutput,async execute(args,exec){if(!exec.agent)throw new Error('An owning session is required');if(!args.questions.length||args.questions.length>3)throw new Error('Ask one to three questions');const answer=await ctx.userQuestions.ask({questions:args.questions,agent:exec.agent,signal:exec.signal});if(answer.answers.some(a=>!a.selected?.length&&!a.custom?.trim()))throw new Error('Answer was not submitted');return answer;}}));
  ctx.on('system-prompt/assemble',async (_assembly,context,next)=>{
    const assembled=await next(), agent=context.agent, id=agent?.session?.id;
    if(!id)return assembled;
    const cwd=agent.session.header?.cwd||process.cwd(),rows=await customizations(cwd),selected=await selectedAgent(storage,id);
    const instructions=instructionText(rows,selected);
    return instructions?{...assembled,sections:[...assembled.sections,{name:'agents-pro-personal-instructions',order:951,text:instructions}]}:assembled;
  });
  ctx.connection.fetch.register({path:'/api/agents-pro',methods:['GET','POST'],requestBody:'buffered',async fetch(request){
    try{
      const url=new URL(request.url), input=request.method==='POST'?await request.json():Object.fromEntries(url.searchParams), action=input.action;
      let value;
      if(action==='cli-connections')value=await cliConnections();
      else if(action==='skills')value=await skillCatalog(ctx,input.sessionId,input.name,request.signal,skillRegistry,skillPolicy);
      else if(action==='skill-enabled'){
        const catalog=await skillCatalog(ctx,input.sessionId,undefined,request.signal,skillRegistry,skillPolicy);
        if(!catalog.skills.some(skill=>skill.name===input.name))throw Error('Skill is no longer available');
        await skillPolicy.set(catalog.cwd,input.name,input.enabled);
        ctx.skills.notifyChange();
        value=await skillCatalog(ctx,input.sessionId,undefined,request.signal,skillRegistry,skillPolicy);
      }
      else if(action==='settings')value=input.change?await updateSettings(input.change):await getSettings();
      else if(action==='checklists')value=await checklist(input.sessionId,undefined,lists);
      else if(action==='prompts')value=await prompts(join(base,'../prompts'),storage,input.change);
      else if(action==='resume-checklist')value=resumeChecklist((await checklist(input.sessionId,undefined,lists)).lists,input.id);
      else if(action==='cleanup')value={text:await cleanup(String(input.text||''),String(input.prompt||''),input.route)};
      else if(action==='phrase')value=await voices.phrase(input.audio);
      else if(action==='record')value=await voices.save(input);
      else if(action==='process'){await voices.get(input.id);voices.start(input.id);value={status:'started'};}
      else if(action==='recording')value=await voices.get(input.id);
      else if(action==='recordings')value=await voices.list(input.sessionId);
      else if(action==='customizations')value=await customizations(ctx.sessions.get(input.sessionId)?.header?.cwd||process.cwd(),input.change||{});
      else if(action==='select-agent'){
        const cwd=ctx.sessions.get(input.sessionId)?.header?.cwd||process.cwd(),rows=await customizations(cwd);
        if(input.path&&!rows.some(r=>r.kind==='agents'&&r.path===input.path))throw Error('Agent not found in this project or user customizations');
        value=await selectedAgent(storage,input.sessionId,input.path||'');
      }
      else if(action==='export'){
        if(typeof input.sessionId!=='string')throw new Error('Session is required');
        const deps=sessionLogExportDeps(ctx);await flushLiveSessionLog(deps,input.sessionId,request.signal);
        const content=await readSessionLogText(ctx.sessionPersistence,input.sessionId,request.signal);
        if(content===undefined)throw new Error('Session not found');
        const events=content.trim().split('\n').map(JSON.parse);
        return new Response(markdownFromEvents(events,input.title||'Chat'),{headers:{'content-type':'text/markdown;charset=utf-8','content-disposition':'attachment; filename="chat.md"','cache-control':'no-store'}});
      }
      else if(action==='kit')return new Response(await readFile(join(base,'../skill-integration/checklists/agents-pro-checklist-kit.zip')),{headers:{'content-type':'application/zip','content-disposition':'attachment; filename="agents-pro-checklist-kit.zip"'}});
      else throw new Error('Unknown Agents Pro action');
      return Response.json(value,{headers:{'cache-control':'no-store'}});
    }catch(error){return Response.json({error:error.message},{status:400});}
  }});
  ctx.effect(()=>()=>voices.dispose(),'agents-pro voice worker');
}
