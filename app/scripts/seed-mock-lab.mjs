import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { originalBank,questionById } from '../src/data/questionBank.ts';
import { suppliedExplanationsFor } from '../src/data/suppliedExplanations.ts';
import { studyExplanation,englishStudyText } from '../src/utils/explanationReview.ts';
import { sourceHTMLText } from './import-supplied-explanations.mjs';
const uuid=(value)=>{const h=createHash('sha256').update(value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const specs=[];
for(const paper of ['GS-I','CSAT']){
 const qs=originalBank.filter(q=>q.stage===(paper==='CSAT'?'CSAT':'Prelims'));
 specs.push({code:`PYQ-2025-${paper}-FULL`,name:`2025 ${paper==='GS-I'?'GS Paper I':'CSAT Paper II'} · PYQ Simulation`,paper,kind:'Full Length',duration:120,qs});
 const category=paper==='CSAT'?'topic':'subject';
 for(const subject of [...new Set(qs.map(q=>q[category]))]){const subset=qs.filter(q=>q[category]===subject);if(subset.length<5)continue;specs.push({code:`PYQ-2025-${paper}-${subject.toUpperCase().replace(/[^A-Z0-9]+/g,'-')}`,name:`${subject} · 2025 PYQ Sectional`,paper,kind:'Sectional',duration:Math.max(10,Math.ceil(subset.length*1.5)),qs:subset});}
}
const tests=specs.map(spec=>{const positive=spec.paper==='GS-I'?2:2.5,negative=positive/3;
 const questions=spec.qs.map(raw=>{const q=questionById.get(raw.id),entries=suppliedExplanationsFor(q),e=studyExplanation(q);const explanation=entries.length&&!q.explanationReview?.preferReviewedExplanation?englishStudyText(sourceHTMLText(entries[0].explanation)):e?.justification||q.explanation?.justification;
 if(!explanation||!q.answer)throw Error(`Missing official key/explanation: ${q.id}`);
 return {id:uuid(spec.code+q.id),question:q.question,blocks:q.blocks,options:q.options,correct:raw.answer,explanation,subject:q.subject,topic:q.topic,subtopic:q.subtopic,difficulty:q.difficultyLabel||'Moderate',positive,negative};});
 return {id:uuid(spec.code),code:spec.code,name:spec.name,series:'2025 Official PYQ Simulations',year:2025,paper:spec.paper,kind:spec.kind,subjects:[...new Set(questions.map(q=>q.subject))],topics:[...new Set(questions.map(q=>q.topic))],syllabus:`Practice simulation using published 2025 UPSC ${spec.paper} questions. These are PYQs, not a fresh coaching paper. ${spec.qs.length} questions with official answer keys.`,difficulty:'Moderate',duration:spec.duration,positive,negative,questions,maximum:positive*questions.length};});
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const sql=[];
for(const name of ['VISION IAS','FORUM IAS','VAJIRAM & RAVI IAS','NEXT IAS','INSIGHTS IAS','DRISHTI IAS',"RAU'S IAS",'SHANKAR IAS'])sql.push(`insert into mock_private.coaching(canonical_name,display_name) values(${quote(name)},mock_private.reverse_name(${quote(name)})) on conflict(canonical_name) do nothing;`);
for(const t of tests)sql.push(`insert into mock_private.tests(id,code,name,series,year,paper,kind,subjects,topics,syllabus,difficulty,duration,positive,negative,status,questions,question_count,maximum) values(${quote(t.id)},${quote(t.code)},${quote(t.name)},${quote(t.series)},${t.year},${quote(t.paper)},${quote(t.kind)},array(select jsonb_array_elements_text(${quote(JSON.stringify(t.subjects))}::jsonb)),array(select jsonb_array_elements_text(${quote(JSON.stringify(t.topics))}::jsonb)),${quote(t.syllabus)},${quote(t.difficulty)},${t.duration},${t.positive},${t.negative},'active',${quote(JSON.stringify(t.questions))}::jsonb,${t.questions.length},${t.maximum}) on conflict(code) do nothing;`);
const output=process.argv[2];if(!output)throw Error('Provide an output path for trusted backend seed SQL');writeFileSync(output,sql.join('\n'));
console.log(JSON.stringify({tests:tests.length,gs:tests.filter(t=>t.paper==='GS-I').length,csat:tests.filter(t=>t.paper==='CSAT').length,sourceQuestions:180}));
