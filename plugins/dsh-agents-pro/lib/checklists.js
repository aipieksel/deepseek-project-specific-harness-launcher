import store from './checklist-store.cjs';
export const { validateChecklist, mergeChecklist } = store;
export function checklist(sessionId, update, directory) {
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 200) throw new Error('Session ID is required');
  return store.checklistStorage('deepseek:/harness/' + encodeURIComponent(sessionId), update, directory);
}

export function resumeChecklist(lists,id){
 const list=lists.find(row=>row.id===id);if(!list)throw Error('Checklist not found in this session');
 const pending=list.items.filter(row=>row.status==='pending'||row.status==='blocked');
 if(!pending.length)throw Error('This checklist has no pending or blocked tasks');
 return {id:list.id,itemIds:pending.map(row=>row.id),text:`Resume the pending tasks in existing checklist ${JSON.stringify(list.id)} (${list.title||list.id}).\nUse agents_pro_update_checklist with this exact checklist ID and the existing item IDs below. Use merge to update them; do not create a replacement list, reset completed tasks, or mark completion before verification. Read the existing task record if one is associated with this checklist. Recheck blocked items and ask any required questions before dependent work.\n\n${pending.map(row=>`- ${row.id} [${row.status}]: ${row.text}`).join('\n')}`};
}
