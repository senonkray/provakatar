import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const context=vm.createContext({window:{},globalThis:{}});
for(const file of ['dist/questions-data.js','dist/question-packs.js','dist/question-engine.js','dist/question-selector.js']){
  vm.runInContext(fs.readFileSync(new URL(file,root),'utf8'),context,{filename:file});
}
const Engine=context.window.QuestionEngine;
const Selector=context.window.QuestionSelector;
const engine=new Engine(context.window.PROVOCATION_DATA);
let seed=13579;
const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const selector=new Selector(engine,{random});

const snapshot=engine.all.map(question=>question.id).join('|');
const mixed=selector.createSession({category:'mixed',preset:'random',maxLevel:5,answerMode:'everyone',limit:60});
assert.equal(mixed.order.length,60,'mixed party should use configured limit');
assert.equal(new Set(mixed.order).size,mixed.order.length,'party must not repeat questions');
assert.equal(engine.all.map(question=>question.id).join('|'),snapshot,'selection must not mutate source catalogue');

const selected=mixed.order.map(id=>engine.byId.get(id));
assert.ok(selected.every(question=>question.level<=5));
assert.ok(selected.slice(0,10).every(question=>question.level<=1),'party must start softly');
const firstAverage=selected.slice(0,20).reduce((sum,q)=>sum+q.level,0)/20;
const lastAverage=selected.slice(-20).reduce((sum,q)=>sum+q.level,0)/20;
assert.ok(lastAverage>firstAverage,'difficulty must increase during the party');
for(let index=1;index<selected.length;index++){
  assert.notEqual(selected[index].category,selected[index-1].category,'mixed mode must alternate categories');
  assert.notEqual(selector.impactOf(selected[index]),selector.impactOf(selected[index-1]),'mixed mode must alternate emotional impact');
}

const safe=selector.createSession({category:'mixed',preset:'couple',maxLevel:5,limit:60});
assert.ok(safe.order.every(id=>engine.byId.get(id).ageRating<18),'safe presets must exclude 18+');
const adult=selector.createSession({category:'mixed',preset:'uncensored',maxLevel:5,limit:60});
assert.ok(adult.order.some(id=>engine.byId.get(id).ageRating===18),'uncensored preset must include 18+');

const history=mixed.order.slice(0,40);
const afterReload=selector.createSession({category:'mixed',preset:'random',maxLevel:5,history,limit:20});
assert.ok(afterReload.order.every(id=>!history.includes(id)),'recent history must be avoided after reload');

const tinyIds=engine.list({category:'psychology',level:1,allowAdult:false}).slice(0,1).map(q=>q.id);
const exhausted=selector.createSession({ids:tinyIds,maxLevel:1,history:tinyIds,limit:10});
assert.equal(exhausted.cycleReset,true,'exhausted pool must start a new cycle');
assert.deepEqual(exhausted.order,tinyIds,'new cycle must remain finite and usable');
const partialIds=engine.list({category:'psychology',level:1,allowAdult:false}).slice(0,6).map(q=>q.id);
const partial=selector.createSession({ids:partialIds,maxLevel:1,history:partialIds.slice(0,5),limit:6});
assert.equal(partial.order.length,6,'partial exhaustion must fill the party from a new cycle');
assert.equal(partial.order[0],partialIds[5],'the last unused question must be shown before recent history');
assert.equal(new Set(partial.order).size,6,'cycle refill must not duplicate inside the party');
const empty=selector.createSession({category:'missing-category',maxLevel:5});
assert.equal(empty.order.length,0,'empty category must return an empty session');

console.log('Question selector tests passed: no repeats, history, ramp, variety, age filters, cycle reset and empty pools.');
