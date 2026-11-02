/* Smart party sequencing: difficulty curve, variety and persistent-history avoidance. */
(() => {
  const PRESETS=Object.freeze({
    random:{categories:null,adult:false},
    friends:{categories:['people','cringe','secrets','unexpected','hard'],adult:false},
    couple:{categories:['relationships','psychology','secrets','flirt'],adult:false},
    company:{categories:['people','cringe','morality','unexpected','uncomfortable'],adult:false},
    uncensored:{categories:['flirt','hard','relationships','secrets','psychology'],adult:true}
  });
  const IMPACT=Object.freeze({
    psychology:'psychological',secrets:'psychological',cringe:'fun',unexpected:'fun',
    hard:'provocative',uncomfortable:'provocative',relationships:'romantic',flirt:'romantic',
    morality:'dilemma',people:'social'
  });
  const secureRandom=()=>{
    if(globalThis.crypto?.getRandomValues){const value=new Uint32Array(1);globalThis.crypto.getRandomValues(value);return value[0]/4294967296;}
    return Math.random();
  };

  class QuestionSelector {
    constructor(engine,{random=secureRandom}={}){this.engine=engine;this.random=random;}
    getPreset(id){return PRESETS[id]||PRESETS.random;}
    impactOf(question){return IMPACT[question.category]||question.category;}
    pool({category=null,maxLevel=3,allowAdult=false,answerMode=null,preset='random',ids=null,lang='ru'}={}){
      const profile=this.getPreset(preset);
      const mixed=!category||category==='mixed';
      return this.engine.list({
        category:mixed?null:category,maxLevel,
        allowAdult:profile.adult||allowAdult,mode:answerMode,ids,lang
      }).filter(question=>!mixed||!profile.categories||profile.categories.includes(question.category));
    }
    targetLevel(maxLevel,position,total){
      if(maxLevel<=1)return 1;
      const progress=total<=1?1:position/(total-1);
      return Math.max(1,Math.min(maxLevel,1+Math.floor(progress*maxLevel)));
    }
    weightedPick(candidates,context){
      const {targetLevel,lastCategory,lastImpact,recentRank}=context;
      const weights=candidates.map(question=>{
        let weight=6/(1+Math.abs(question.level-targetLevel)*1.7);
        if(question.category===lastCategory)weight*=.08;
        if(this.impactOf(question)===lastImpact)weight*=.22;
        const rank=recentRank.get(question.id);
        if(rank!==undefined)weight*=Math.max(.03,(rank+1)/(recentRank.size+1));
        return Math.max(.0001,weight);
      });
      let cursor=this.random()*weights.reduce((sum,weight)=>sum+weight,0);
      for(let index=0;index<candidates.length;index++){cursor-=weights[index];if(cursor<=0)return candidates[index];}
      return candidates[candidates.length-1];
    }
    createSession(options={}){
      const source=this.pool(options);
      if(!source.length)return {order:[],cycleReset:false,available:0};
      const history=[...(options.history||[])].filter(id=>this.engine.byId.has(id));
      const recentLimit=Math.min(40,Math.max(0,source.length-1));
      const recent=history.slice(-recentLimit);
      const recentSet=new Set(recent);
      const fresh=source.filter(question=>!recentSet.has(question.id));
      const limit=Math.min(options.limit||60,source.length);
      const cycleReset=fresh.length<limit;
      const candidates=[...source];
      const order=[];
      const recentRank=new Map(recent.map((id,index)=>[id,index]));
      let lastCategory=null,lastImpact=null;
      while(order.length<limit&&candidates.length){
        const targetLevel=this.targetLevel(Number(options.maxLevel)||3,order.length,limit);
        const freshRemaining=candidates.filter(question=>!recentSet.has(question.id));
        const cyclePool=freshRemaining.length?freshRemaining:candidates;
        const levelFit=cyclePool.filter(question=>question.level<=targetLevel);
        const bounded=levelFit.length?levelFit:cyclePool;
        const varied=bounded.filter(question=>question.category!==lastCategory&&this.impactOf(question)!==lastImpact);
        const selected=this.weightedPick(varied.length?varied:bounded,{targetLevel,lastCategory,lastImpact,recentRank});
        order.push(selected.id);
        candidates.splice(candidates.indexOf(selected),1);
        lastCategory=selected.category;
        lastImpact=this.impactOf(selected);
      }
      return {order,cycleReset,available:source.length};
    }
    alternativeIndex(order,currentIndex){
      const current=this.engine.byId.get(order[currentIndex]);
      if(!current)return currentIndex+1;
      const rest=order.slice(currentIndex+1);
      const index=rest.findIndex(id=>{
        const question=this.engine.byId.get(id);
        return question&&question.category!==current.category&&this.impactOf(question)!==this.impactOf(current);
      });
      return index<0?currentIndex+1:currentIndex+1+index;
    }
  }
  window.QUESTION_PRESETS=PRESETS;
  window.QuestionSelector=QuestionSelector;
})();
