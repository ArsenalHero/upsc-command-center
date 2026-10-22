import { fmtMock,mockMarkingGroups,mockPenaltyLabel,type MockAttempt } from "../../utils/mockLab";

export function MockScoring({attempt}:{attempt:MockAttempt}){
 const result=attempt.result;
 if(!result)return null;
 const groups=mockMarkingGroups(result.questions);
 return <section className="card mock-panel mock-marking-breakdown" aria-labelledby="mock-marking-title"><header><div><span className="eyebrow">MARKING CRITERIA</span><h3 id="mock-marking-title">How your marks are calculated</h3></div><span className="mock-server-score">Calculated on the server</span></header>
  {groups.map((g,i)=><div className="mock-marking-group" key={`${g.positive}:${g.negative}`}>
   {groups.length>1&&<h4>Scheme {i+1} · {g.correct+g.incorrect+g.unattempted} questions</h4>}
   <dl><div><dt>Correct answers</dt><dd>{g.correct} × {fmtMock(g.positive)} = <strong>+{fmtMock(g.gross)}</strong></dd></div><div><dt>Incorrect answers</dt><dd>{g.incorrect} × {mockPenaltyLabel(g.positive,g.negative)} = <strong>{g.deductions>0?"−":""}{fmtMock(g.deductions)}</strong></dd></div><div><dt>Unattempted</dt><dd>{g.unattempted} × 0 = <strong>0</strong></dd></div></dl>
  </div>)}
  <p className="mock-marking-total">Net score <strong>{fmtMock(result.gross)} − {fmtMock(result.negative)} = {fmtMock(result.score)} / {fmtMock(result.maximum)}</strong></p><p className="small muted">Each question uses its own configured marking scheme. One-third deductions use the full value, rather than 0.67 or 0.83 rounded per answer. Displayed marks are rounded to two decimal places.</p>
 </section>;
}
