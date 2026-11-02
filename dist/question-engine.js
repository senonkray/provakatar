(() => {
  class QuestionEngine {
    constructor(data) {
      if (!data?.questions?.length) throw new Error('Question catalogue is empty');
      this.categories=data.categories.map(category=>({...category}));
      this.byId=new Map();
      data.questions.forEach(question=>{
        if (!question.id || this.byId.has(question.id)) throw new Error(`Duplicate question id: ${question.id}`);
        if (!this.categories.some(category=>category.id===question.category)) throw new Error(`Unknown category: ${question.category}`);
        if (!Number.isInteger(question.level)||question.level<1||question.level>5) throw new Error(`Invalid level: ${question.id}`);
        if (![12,16,18].includes(question.ageRating)) throw new Error(`Invalid age rating: ${question.id}`);
        if (!Array.isArray(question.modes)||!question.modes.length||question.modes.some(mode=>!['everyone','turns'].includes(mode))) throw new Error(`Invalid modes: ${question.id}`);
        if (!question.text?.ru) throw new Error(`Missing Russian text: ${question.id}`);
        this.byId.set(question.id,Object.freeze({...question,modes:Object.freeze([...question.modes]),text:Object.freeze({...question.text})}));
      });
      this.all=Object.freeze([...this.byId.values()]);
    }
    localize(question,lang='ru') {
      if (!question) return null;
      return {...question,text:question.text[lang]||question.text.ru};
    }
    get(id,lang='ru') { return this.localize(this.byId.get(id),lang); }
    list({category=null,level=null,maxLevel=null,allowAdult=false,mode=null,ids=null,lang='ru'}={}) {
      const idSet=ids?new Set(ids):null;
      return this.all.filter(question=>
        (!idSet||idSet.has(question.id))&&
        (!category||question.category===category)&&
        (!level||question.level===Number(level))&&
        (!maxLevel||question.level<=Number(maxLevel))&&
        (allowAdult||question.ageRating<18)&&
        (!mode||question.modes.includes(mode))
      ).map(question=>this.localize(question,lang));
    }
    shuffle(items) {
      const result=[...items];
      for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
      return result;
    }
    createDeck(filters={}) { return this.shuffle(this.list(filters).map(question=>question.id)); }
    availableCategories(filters={}) {
      return this.categories.filter(category=>this.list({...filters,category:category.id}).length>0);
    }
    count(filters={}) { return this.list(filters).length; }
  }
  window.QuestionEngine=QuestionEngine;
})();
