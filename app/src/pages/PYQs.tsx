import { lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Wrench } from "lucide-react";
import { PageHeader } from "../components/ui";
import "../mechanical.css";
const GeneralBank=lazy(()=>import("./PYQBank"));
const MechanicalPractice=lazy(()=>import("./MechanicalPractice"));
export default function MCQPractice(){
  const [params]=useSearchParams(), mechanical=params.get("collection")==="mechanical";
  const general=params.get("collection")==="pyqs" || !mechanical && params.has("section");
  return <><nav className="mcq-collections" aria-label="MCQ practice collections">
    <Link to="/pyqs?collection=pyqs" aria-current={general?"page":undefined}><BookOpen size={17}/>UPSC &amp; PSC PYQs</Link>
    <Link to="/pyqs?collection=mechanical" aria-current={mechanical?"page":undefined}><Wrench size={17}/>Mechanical</Link>
  </nav><Suspense fallback={<p className="page-loading" role="status">Opening your question collection…</p>}>
    {mechanical?<MechanicalPractice/>:general?<GeneralBank/>:<div className="mechanical-practice mcq-landing">
      <PageHeader eyebrow="PRACTISE · UNDERSTAND · REVISIT" title="MCQ Practice" description="Choose your question collection, then build a practice set around your next goal."/>
      <div className="mcq-collection-cards">
        <Link to="/pyqs?collection=pyqs"><BookOpen size={25}/><span className="eyebrow">CIVIL SERVICES</span><h2>UPSC &amp; State PSC</h2><p>Subjectwise PYQs, full papers, explanations and saved revision.</p><span>Open question bank<ArrowRight size={16}/></span></Link>
        <Link to="/pyqs?collection=mechanical"><Wrench size={25}/><span className="eyebrow">ENGINEERING</span><h2>Mechanical</h2><p>Engineering Mechanics by topic and subtopic, with complete reviewed explanations.</p><span>Open Mechanical<ArrowRight size={16}/></span></Link>
      </div></div>}
  </Suspense></>;
}
