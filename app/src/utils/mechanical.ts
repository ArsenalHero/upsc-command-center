export type MechanicalReviewStatus = "verified" | "corrected" | "disputed" | "needs-review";
export type MechanicalOutcome = "correct" | "incorrect" | "skipped" | "ungraded";
export interface MechanicalFigure { url?: string; alt: string; placement: "question" | "explanation"; page?: number; bbox?: number[] }
export interface MechanicalQuestion {
  id: string; number: number; subjectId: string; subject: string; topic: string; subtopic: string;
  question: string; options: Record<string,string>; answer: string | null; sourceAnswer: string | null;
  explanation: string; sourceExplanation?: string; optionsUnavailable?: boolean;
  source: { file: string; page: number; pageEnd?: number; printedPage: number; sha256: string };
  review: { status: MechanicalReviewStatus; note: string; references: { title: string; url: string; section?: string }[] };
  figures?: MechanicalFigure[]; transcriptionIssues?: string[]; parseIssues?: string[];
}
export interface MechanicalSubject {
  id: string; title: string; url: string; count: number; reviewed: number; corrected: number; disputed: number;
  auditUrl?: string;
  topics: { name: string; count: number; subtopics: { name: string; count: number }[] }[];
}
export interface MechanicalCatalog {
  version: string; total: number; reviewed: number; corrected: number; disputed: number;
  subjects: MechanicalSubject[]; sources: { file: string; sha256: string; pages: number }[]; auditUrl?: string; auditDataUrl?: string;
}
export interface MechanicalFilters {
  subjectId: string; topic: string; subtopic: string; query: string;
  status: "all" | "unattempted" | "correct" | "incorrect" | "skipped" | "flagged" | "ungraded";
  quality: "all" | "reviewed" | "corrected" | "disputed" | "needs-review";
}
export interface MechanicalResponse { option: string; outcome: MechanicalOutcome; checkedAt: string; key: string | null; reviewStatus: MechanicalReviewStatus }
export interface MechanicalSession {
  id: string; subjectId: string; subject: string; topic: string; subtopic: string; questionIds: string[];
  index: number; responses: Record<string,MechanicalResponse>; startedAt: string; completedAt?: string;
}
export interface MechanicalWorkspace {
  version: 1; filters: MechanicalFilters; flags: string[]; latest: Record<string,MechanicalResponse>;
  session?: MechanicalSession; history: MechanicalSession[];
}
export const emptyMechanical = (): MechanicalWorkspace => ({version:1,filters:{subjectId:"",topic:"",subtopic:"",query:"",status:"all",quality:"all"},flags:[],latest:{},history:[]});
export const reviewLabel = (status: MechanicalReviewStatus) => ({verified:"Reference-reviewed",corrected:"Corrected",disputed:"Answer disputed","needs-review":"Verification pending"})[status];
export const isMechanicalReviewed = (q: MechanicalQuestion) => q.review.status === "verified" || q.review.status === "corrected";
export const canGradeMechanical = (q: MechanicalQuestion) => isMechanicalReviewed(q) && !!q.answer && !!q.options[q.answer]
  && !(q.parseIssues?.length || q.transcriptionIssues?.length) && !(q.figures || []).some(f => !f.url);
export function mechanicalSummary(responses: Record<string,MechanicalResponse>, total = Object.keys(responses).length) {
  const values=Object.values(responses), correct=values.filter(r=>r.outcome==="correct").length, incorrect=values.filter(r=>r.outcome==="incorrect").length;
  return {total,answered:values.length,correct,incorrect,skipped:values.filter(r=>r.outcome==="skipped").length,ungraded:values.filter(r=>r.outcome==="ungraded").length,accuracy:correct+incorrect ? 100*correct/(correct+incorrect) : null};
}
export function filterMechanical(questions: MechanicalQuestion[], f: MechanicalFilters, w: MechanicalWorkspace) {
  const query=f.query.trim().toLocaleLowerCase();
  return questions.filter(q=>(!f.subjectId || q.subjectId===f.subjectId) && (!f.topic || q.topic===f.topic) && (!f.subtopic || q.subtopic===f.subtopic)
    && (!query || `${q.number} ${q.question} ${q.topic} ${q.subtopic}`.toLocaleLowerCase().includes(query))
    && (f.quality==="all" || f.quality==="reviewed" && isMechanicalReviewed(q) || f.quality===q.review.status)
    && (f.status==="all" || f.status==="flagged" && w.flags.includes(q.id) || f.status==="unattempted" && !w.latest[q.id] || w.latest[q.id]?.outcome===f.status));
}
export function startMechanical(w: MechanicalWorkspace, questions: MechanicalQuestion[], count: number, freshOnly=true, shuffle=true, now=new Date().toISOString()): MechanicalWorkspace {
  if(w.session && !w.session.completedAt) throw new Error("Resume or finish your current Mechanical set first.");
  if(!Number.isInteger(count) || count<1 || count>100) throw new Error("Choose a whole number from 1 to 100.");
  const pool=[...new Map(questions.filter(q=>!freshOnly || !w.latest[q.id]).map(q=>[q.id,q])).values()];
  if(count>pool.length) throw new Error(`Only ${pool.length} ${freshOnly ? "fresh " : ""}questions are available in this selection.`);
  if(shuffle) for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const selected=pool.slice(0,count), first=selected[0];
  return {...w,session:{id:crypto.randomUUID(),subjectId:first.subjectId,subject:first.subject,topic:w.filters.topic,subtopic:w.filters.subtopic,questionIds:selected.map(q=>q.id),index:0,responses:{},startedAt:now}};
}
function complete(w: MechanicalWorkspace): MechanicalWorkspace {
  return w.session?.completedAt ? {...w,history:[...w.history.filter(s=>s.id!==w.session!.id),structuredClone(w.session)]} : w;
}
export function answerMechanical(w: MechanicalWorkspace, q: MechanicalQuestion, option: string | null, now=new Date().toISOString()): MechanicalWorkspace {
  const current=w.session;
  if(!current || current.completedAt || !current.questionIds.includes(q.id)) throw new Error("This question is not in your active set.");
  if(current.responses[q.id]) return w;
  if(option===null && (!q.optionsUnavailable || Object.keys(q.options).length || canGradeMechanical(q))) throw new Error("Choose one of the supplied answer options.");
  if(option && !Object.hasOwn(q.options,option)) throw new Error("Choose one of the supplied answer options.");
  const response: MechanicalResponse={option:option || "",outcome:option===null ? "ungraded" : !option ? "skipped" : canGradeMechanical(q) ? option===q.answer ? "correct" : "incorrect" : "ungraded",checkedAt:now,key:q.answer,reviewStatus:q.review.status};
  const session={...current,responses:{...current.responses,[q.id]:response}};
  if(Object.keys(session.responses).length===session.questionIds.length) session.completedAt=now;
  return complete({...w,session,latest:{...w.latest,[q.id]:response}});
}
export function finishMechanical(w: MechanicalWorkspace, now=new Date().toISOString()): MechanicalWorkspace {
  const current=w.session;if(!current || current.completedAt)return w;
  const session={...current,responses:{...current.responses},completedAt:now},latest={...w.latest};
  for(const id of session.questionIds)if(!session.responses[id]){const r:MechanicalResponse={option:"",outcome:"skipped",checkedAt:now,key:null,reviewStatus:"needs-review"};session.responses[id]=r;latest[id]=r;}
  return complete({...w,session,latest});
}
export const flagMechanical=(w:MechanicalWorkspace,id:string):MechanicalWorkspace=>({...w,flags:w.flags.includes(id)?w.flags.filter(q=>q!==id):[...w.flags,id]});
const object=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==="object" && !Array.isArray(v);
export function validateMechanical(v:unknown):asserts v is MechanicalWorkspace {
  const fail=()=>{throw new Error("Mechanical practice data could not be saved. Check the imported backup.");};
  if(!object(v) || v.version!==1 || !object(v.filters) || !Array.isArray(v.flags) || !object(v.latest) || !Array.isArray(v.history))return fail();
  const f=v.filters;
  if(!["subjectId","topic","subtopic","query"].every(k=>typeof f[k]==="string" && String(f[k]).length<=500)
    || !["all","unattempted","correct","incorrect","skipped","flagged","ungraded"].includes(String(f.status))
    || !["all","reviewed","corrected","disputed","needs-review"].includes(String(f.quality)))return fail();
  const id=(s:unknown)=>typeof s==="string" && s.length>0 && s.length<180;
  const time=(s:unknown)=>typeof s==="string" && Number.isFinite(Date.parse(s));
  const response=(r:unknown)=>object(r) && typeof r.option==="string" && r.option.length<3 && ["correct","incorrect","skipped","ungraded"].includes(String(r.outcome))
    && time(r.checkedAt) && (r.key===null || typeof r.key==="string" && r.key.length<3) && ["verified","corrected","disputed","needs-review"].includes(String(r.reviewStatus));
  const session=(s:unknown)=>object(s) && id(s.id) && id(s.subjectId) && typeof s.subject==="string" && typeof s.topic==="string" && typeof s.subtopic==="string"
    && Array.isArray(s.questionIds) && s.questionIds.length>0 && s.questionIds.length<=100 && s.questionIds.every(id) && new Set(s.questionIds).size===s.questionIds.length
    && Number.isInteger(s.index) && Number(s.index)>=0 && Number(s.index)<s.questionIds.length && object(s.responses)
    && Object.entries(s.responses).every(([k,r])=>(s.questionIds as string[]).includes(k)&&response(r)) && time(s.startedAt)
    && (s.completedAt===undefined || time(s.completedAt)&&Object.keys(s.responses).length===s.questionIds.length);
  if(v.flags.length>30000 || !v.flags.every(id) || new Set(v.flags).size!==v.flags.length || Object.keys(v.latest).length>30000 || !Object.entries(v.latest).every(([k,r])=>id(k)&&response(r))
    || v.history.length>10000 || !v.history.every(session) || new Set(v.history.map(s=>(s as MechanicalSession).id)).size!==v.history.length || v.session!==undefined&&!session(v.session))return fail();
}
const cache=new Map<string,Promise<MechanicalQuestion[]>>();
export function loadMechanicalSubject(subject:MechanicalSubject):Promise<MechanicalQuestion[]> {
  const key=`${subject.id}:${subject.url}`;
  if(!cache.has(key))cache.set(key,(async()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{const r=await fetch(new URL(subject.url,document.baseURI),{signal:controller.signal});if(!r.ok)throw new Error("This Mechanical subject could not be loaded. Please try again.");
      const data=await r.json();if(data.subjectId!==subject.id || !Array.isArray(data.questions) || data.questions.length!==subject.count || new Set(data.questions.map((q:MechanicalQuestion)=>q.id)).size!==subject.count)throw new Error("The subject index is inconsistent. Reload to get its current version.");
      return data.questions.map((q:MechanicalQuestion)=>({...q,subjectId:subject.id,subject:subject.title}));
    }catch(e){cache.delete(key);if((e as Error).name==="AbortError")throw new Error("Loading the Mechanical questions took too long. Please try again.");throw e;}finally{clearTimeout(timeout);}
  })());return cache.get(key)!;
}
