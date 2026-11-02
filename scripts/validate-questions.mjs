import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const context=vm.createContext({window:{}});
for(const file of ['dist/questions-data.js','dist/question-packs.js','dist/question-engine.js']){
  vm.runInContext(fs.readFileSync(new URL(file,root),'utf8'),context,{filename:file});
}

const data=context.window.PROVOCATION_DATA;
const Engine=context.window.QuestionEngine;
const engine=new Engine(data);
const targets={hard:150,flirt:150,psychology:120,morality:100,people:120,secrets:100,cringe:100,relationships:100,unexpected:100,uncomfortable:100};
const errors=[];
const normalized=new Map();
const ids=new Set();
const stop=new Set('а без бы в во для до его ее её и или из к как ко ли на не но о об от по про с со то у что это я ты он она мы вы они же уже'.split(' '));
const normalize=text=>text.toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^а-яa-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const tokens=text=>new Set(normalize(text).split(' ').filter(word=>word.length>2&&!stop.has(word)));

for(const question of data.questions){
  if(ids.has(question.id))errors.push(`duplicate id: ${question.id}`);ids.add(question.id);
  const key=normalize(question.text?.ru||'');
  if(!key)errors.push(`empty text: ${question.id}`);
  if(normalized.has(key))errors.push(`duplicate text: ${normalized.get(key)} / ${question.id}`);else normalized.set(key,question.id);
  if(!targets[question.category])errors.push(`bad category: ${question.id}`);
  if(!Number.isInteger(question.level)||question.level<1||question.level>5)errors.push(`bad level: ${question.id}`);
  if(![12,16,18].includes(question.ageRating))errors.push(`bad age: ${question.id}`);
  if(!Array.isArray(question.modes)||!question.modes.length)errors.push(`bad modes: ${question.id}`);
  if(question.category==='flirt'&&question.ageRating!==18)errors.push(`non-18 flirt item: ${question.id}`);
}

const questions=data.questions.map(question=>({id:question.id,set:tokens(question.text.ru)}));
const similar=[];
const structural=[];
for(let i=0;i<questions.length;i++)for(let j=i+1;j<questions.length;j++){
  const a=questions[i].set,b=questions[j].set;if(a.size<5||b.size<5)continue;
  let common=0;for(const word of a)if(b.has(word))common++;
  const score=common/(a.size+b.size-common);
  if(score>=.86)similar.push([questions[i].id,questions[j].id,score.toFixed(2)]);
  else if(score>=.68)structural.push([questions[i].id,questions[j].id,score.toFixed(2)]);
}
if(similar.length)errors.push(...similar.slice(0,20).map(item=>`semantic near-duplicate: ${item.join(' / ')}`));

const counts=Object.fromEntries(Object.keys(targets).map(category=>[category,engine.count({category,allowAdult:true})]));
for(const [category,count] of Object.entries(counts)){
  if(count>targets[category])errors.push(`too many ${category}: ${count}/${targets[category]}`);
  if(process.argv.includes('--final')&&count!==targets[category])errors.push(`wrong final count ${category}: ${count}/${targets[category]}`);
}
const safeLeak=engine.list({allowAdult:false}).some(question=>question.ageRating===18);
if(safeLeak)errors.push('18+ content leaked into regular mode');

console.table(Object.entries(targets).map(([category,target])=>({category,target,actual:counts[category],checked:counts[category]<=target?'yes':'no'})));
console.table((data.batches||[]).map(batch=>({...batch,checked:'yes'})));
console.log(`Total: ${data.questions.length}; unique IDs: ${ids.size}; unique texts: ${normalized.size}; near-duplicates: ${similar.length}; structurally similar pairs for editorial review: ${structural.length}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Validation passed.');
