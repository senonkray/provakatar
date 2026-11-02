import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context=vm.createContext({window:{},Date});
vm.runInContext(fs.readFileSync(new URL('../dist/social-game-engine.js',import.meta.url),'utf8'),context);
const Engine=context.window.SocialGameEngine;
const engine=new Engine();
const session=engine.createSession(['Аня','Богдан','Лера']);

assert.equal(session.players.length,3);
assert.equal(new Set(session.players.map(player=>player.id)).size,3,'player IDs must be unique');
assert.ok(context.window.SOCIAL_ROUND_TREE.await_player_choice,'round tree must expose player-choice state');

const peopleQuestion={id:'people-1',category:'people',text:'Кому из присутствующих ты доверишь свой секрет?'};
const peopleStory={id:'people-2',category:'people',text:'Расскажи про друга, перед которым тебе сложно быть честным.'};
const freeQuestion={id:'psych-1',category:'psychology',text:'Какой страх тебе сложнее признать?'};
assert.equal(engine.classifyQuestion(peopleQuestion).answerType,'player_picker');
assert.equal(engine.classifyQuestion(peopleQuestion).metric,'trust');
assert.equal(engine.classifyQuestion(peopleStory).answerType,'free_text','not every people-category question should force an avatar choice');
assert.equal(engine.classifyQuestion(freeQuestion).answerType,'free_text');
assert.equal(engine.requiresPlayerChoice(peopleQuestion,'turns',session.players),true);
assert.equal(engine.requiresPlayerChoice(peopleQuestion,'everyone',session.players),false);

const [actor,target,other]=session.players;
const reverseBefore=session.graph[target.id][actor.id].trust;
const result=engine.recordPlayerChoice(session,{actorId:actor.id,targetId:target.id,question:peopleQuestion});
assert.ok(result.edge.trust>.5,'explicit choice must update the relevant metric');
assert.equal(session.graph[target.id][actor.id].trust,reverseBefore,'relationship graph must remain directed');
assert.equal(session.graph[actor.id][other.id].trust,.5,'unrelated edge must not change');
assert.equal(session.events.at(-1).type,'player_choice');
assert.ok(session.answeredQuestions.includes(peopleQuestion.id));

const snapshot=JSON.stringify(session.graph);
engine.skip(session,freeQuestion.id);
assert.equal(JSON.stringify(session.graph),snapshot,'skip must not change relationships');
assert.throws(()=>engine.recordPlayerChoice(session,{actorId:actor.id,targetId:actor.id,question:peopleQuestion}),/Invalid social choice/);
assert.doesNotThrow(()=>JSON.parse(JSON.stringify(session)),'session must remain serializable for room sync');

console.log('Social game tests passed: classification, directed graph, choice, skip, validation and serialization.');
