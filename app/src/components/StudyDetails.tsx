import { useData } from "../hooks/useData";
import { aggregate } from "../utils/analytics";
import { prettyDate, number } from "../utils/date";
import { Modal, DashboardCard, EmptyState } from "./ui";
export function StudyDetails({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
}) {
  const { data, setEditor } = useData(),
    a = aggregate(data, date, date);
  return (
    <Modal
      title={prettyDate(date, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })}
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        <div className="stats-grid three">
          <DashboardCard title="Study hours" value={number(a.hours, "h")} />
          <DashboardCard title="Questions" value={a.attempted} />
          <DashboardCard title="Answers" value={a.answers} />
        </div>
        {a.sessions.length ? (
          <div className="daily-timeline">
            {a.sessions
              .slice()
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((s) => (
                <button
                  className="timeline-row"
                  key={s.id}
                  onClick={() => {
                    onClose();
                    setEditor({ collection: "sessions", record: s });
                  }}
                >
                  <span className="timeline-time">
                    {s.startTime || "—"}
                    <small>{s.endTime || ""}</small>
                  </span>
                  <span
                    className="timeline-mark"
                    style={{
                      background: data.subjects.find(
                        (x) => x.id === s.subjectId,
                      )?.color,
                    }}
                  />
                  <span className="timeline-content">
                    <strong>
                      {data.subjects.find((x) => x.id === s.subjectId)?.name}
                    </strong>
                    <small>
                      {data.topics.find((x) => x.id === s.topicId)?.name} ·{" "}
                      {s.activity}
                    </small>
                  </span>
                  <span>{s.actualMinutes} min</span>
                </button>
              ))}
          </div>
        ) : (
          <EmptyState
            onAction={() => {
              onClose();
              setEditor({ collection: "sessions", preset: { date } });
            }}
          />
        )}
      </div>
    </Modal>
  );
}
