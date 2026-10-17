import test from 'node:test';
import assert from 'node:assert/strict';
import {goalProgressText,inspectionRun} from '../lib/goal-progress.js';
const reads=n=>Array.from({length:n},(_,step)=>({type:'tool/call',data:{turn:1,step,name:'read',arguments:'{"file_path":"same"}'}}));
test('goal guidance detects repeated inspection, preserves normal work and never forces writes',()=>{
 const events=reads(8);
 assert.match(goalProgressText({phase:'active'},events),/8 tool-using steps/);
 assert.match(goalProgressText({phase:'active'},events),/not forced file edits/);
 assert.equal(goalProgressText({phase:'paused'},events),'');
 assert.equal(goalProgressText(undefined,events),'');
 assert.equal(goalProgressText({phase:'active'},reads(3)),'');
 assert.equal(goalProgressText({phase:'active'},[...events,{type:'tool/call',data:{turn:1,step:9,name:'edit'}}]),'');
 assert.equal(inspectionRun(events.map(e=>({...e,data:{...e.data,step:1}}))).steps,1);
});
