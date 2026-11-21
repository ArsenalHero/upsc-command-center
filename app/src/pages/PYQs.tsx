import { Component, lazy, Suspense, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, Wrench } from "lucide-react";
import { PageHeader } from "../components/ui";

const CivilServicesBank = lazy(() => import("./PYQBank"));
const MechanicalPractice = lazy(() => import("./MechanicalPractice"));

class CollectionBoundary extends Component<{ children: ReactNode; fallback: ReactNode }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function MCQPractice() {
  const [params] = useSearchParams();
  const mechanical = params.get("collection") === "mechanical";
  const collectionSwitch = mechanical ? (
    <Link className="btn secondary small-btn" to="/pyqs">
      <BookOpen size={16} aria-hidden="true" /> Civil Services
    </Link>
  ) : (
    <Link className="btn secondary small-btn" to="/pyqs?collection=mechanical">
      <Wrench size={16} aria-hidden="true" /> Mechanical
    </Link>
  );
  const header = (
    <PageHeader
      eyebrow={mechanical ? "MCQ PRACTICE" : "CIVIL SERVICES · UPSC & STATE PSC"}
      title={mechanical ? "Mechanical Engineering" : "MCQ Practice"}
      action={collectionSwitch}
    />
  );

  return (
    <CollectionBoundary key={mechanical ? "mechanical" : "civil-services"} fallback={
      <>
        {header}
        <section className="card">
          <p role="alert">This collection could not be opened. Check your connection and try again.</p>
          <button className="btn secondary" onClick={() => window.location.reload()}>Reload collection</button>
        </section>
      </>
    }>
      <Suspense fallback={
        <>
          {header}
          <p className="page-loading" role="status">
            {mechanical ? "Opening Mechanical practice…" : "Opening Civil Services questions…"}
          </p>
        </>
      }>
        {mechanical
          ? <MechanicalPractice collectionSwitch={collectionSwitch} />
          : <CivilServicesBank collectionSwitch={collectionSwitch} />}
      </Suspense>
    </CollectionBoundary>
  );
}
