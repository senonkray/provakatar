/* Local-first social layer. It is deterministic and serializable for future room sync. */
(() => {
  const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
  const METRICS=['trust','attraction','jealousy','protection','conflict','curiosity'];
  const ROUND_TREE=Object.freeze({
    question:{on:{player_picker:'await_player_choice',free_text:'await_acknowledgement'}},
    await_player_choice:{on:{answer:'record_relationship',skip:'next_question'}},
    await_acknowledgement:{on:{answer:'next_question',skip:'next_question'}},
    record_relationship:{on:{saved:'next_question'}},
    next_question:{on:{advance:'question'}}
  });

  class SocialGameEngine {
    playerId(name,index=0){
      let hash=2166136261;
      for(const char of String(name).toLocaleLowerCase())hash=Math.imul(hash^char.codePointAt(0),16777619);
      return `player-${index+1}-${(hash>>>0).toString(36)}`;
    }
    players(names=[]){return names.map((name,index)=>({id:this.playerId(name,index),name,index,initial:String(name).trim().charAt(0).toLocaleUpperCase()||'?'}));}
    emptyEdge(){return {trust:.5,attraction:.1,jealousy:0,protection:.25,conflict:0,curiosity:.25,confidence:0,evidence:[]};}
    createSession(names=[],savedGraph={}){
      const players=this.players(names),ids=new Set(players.map(player=>player.id)),graph={};
      for(const actor of players){graph[actor.id]={};for(const target of players){if(actor.id===target.id)continue;const saved=savedGraph?.[actor.id]?.[target.id];graph[actor.id][target.id]={...this.emptyEdge(),...(saved||{}),evidence:[...(saved?.evidence||[])].slice(-30)};}}
      return {version:1,players,graph,events:[],answeredQuestions:[],treeNode:'question',validPlayerIds:[...ids]};
    }
    classifyQuestion(question){
      const text=String(question?.text||question?.text?.ru||'');
      const directPerson=/^(?:кого|кому|кто|чья|чьё|чье|чью|чей|чьему|с кем)\b/i.test(text.trim());
      const groupMention=/(?:из|среди)\s+присутствующих|кто\s+здесь|кого\s+здесь|кому\s+здесь|в\s+этой\s+компании/i.test(text);
      const picker=groupMention||(question?.category==='people'&&directPerson);
      let metric='curiosity';
      if(/довер|тайн|секрет/i.test(text))metric='trust';
      else if(/влеч|симпат|поцел|флирт|свидан/i.test(text))metric='attraction';
      else if(/ревн/i.test(text))metric='jealousy';
      else if(/защит|поддерж|помо|спас/i.test(text))metric='protection';
      else if(/спор|конфликт|раздраж|предат/i.test(text))metric='conflict';
      return {answerType:picker?'player_picker':'free_text',metric,private:false};
    }
    requiresPlayerChoice(question,mode,players=[]){return mode==='turns'&&players.length>1&&this.classifyQuestion(question).answerType==='player_picker';}
    recordPlayerChoice(session,{actorId,targetId,question}){
      if(!session?.validPlayerIds?.includes(actorId)||!session.validPlayerIds.includes(targetId)||actorId===targetId)throw new Error('Invalid social choice');
      const meta=this.classifyQuestion(question),edge=session.graph[actorId][targetId],delta=meta.metric==='conflict'?0.07:0.09;
      edge[meta.metric]=clamp(edge[meta.metric]+delta);
      edge.confidence=clamp(edge.confidence+.1);
      edge.evidence=[...edge.evidence,{questionId:question.id,metric:meta.metric,at:Date.now()}].slice(-30);
      session.events=[...session.events,{type:'player_choice',actorId,targetId,questionId:question.id,metric:meta.metric,at:Date.now()}].slice(-200);
      session.answeredQuestions=[...new Set([...session.answeredQuestions,question.id])].slice(-120);
      session.treeNode='next_question';
      return {metric:meta.metric,edge:{...edge}};
    }
    skip(session,questionId){session.events=[...session.events,{type:'skip',questionId,at:Date.now()}].slice(-200);session.treeNode='next_question';}
  }
  window.SOCIAL_ROUND_TREE=ROUND_TREE;
  window.SocialGameEngine=SocialGameEngine;
})();
