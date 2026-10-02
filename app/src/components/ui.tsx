import { useEffect, useRef, type ReactNode } from "react";
import {
  Plus,
  Info,
  X,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
export function DashboardCard({
  title,
  value,
  detail,
  icon,
  children,
  tone = "blue",
}: {
  title: string;
  value?: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <span>{title}</span>
        {icon && <span className={`icon-tile ${tone}`}>{icon}</span>}
      </div>
      <strong className="kpi-value">{value}</strong>
      {detail && <div className="kpi-detail">{detail}</div>}
      {children}
    </div>
  );
}
export function ProgressBar({
  value,
  label,
  color = "blue",
  detail,
}: {
  value: number;
  label?: string;
  color?: string;
  detail?: string;
}) {
  return (
    <div className="progress-block">
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          <strong>{detail ?? `${Math.round(value)}%`}</strong>
        </div>
      )}
      <div
        className={`progress-track ${color}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        aria-label={label || "Progress"}
      >
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
export function ProgressRing({
  value,
  size = 72,
  label,
  color = "var(--primary)",
}: {
  value: number;
  size?: number;
  label?: string;
  color?: string;
}) {
  const radius = 30,
    len = 2 * Math.PI * radius;
  return (
    <div
      className="progress-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label || `${Math.round(value)}% progress`}
    >
      <svg viewBox="0 0 72 72">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="var(--track)"
          strokeWidth="6"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(len * Math.min(100, Math.max(0, value))) / 100} ${len}`}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <strong>
        {Math.round(value)}
        <small>%</small>
      </strong>
    </div>
  );
}
export function TrendBadge({
  current,
  previous,
  unit = "",
  threshold = 0,
  percentage = false,
}: {
  current: number | null;
  previous: number | null;
  unit?: string;
  threshold?: number;
  percentage?: boolean;
}) {
  if (current === null || previous === null)
    return <span className="muted small">No comparison data</span>;
  const change = current - previous,
    stable = Math.abs(change) < threshold;
  const Icon = stable ? Minus : change >= 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={`trend ${stable ? "neutral" : change >= 0 ? "positive" : "negative"}`}
    >
      <Icon size={14} />
      {stable
        ? "Stable"
        : `${change > 0 ? "+" : ""}${Number(change.toFixed(1))}${percentage ? " pp" : unit}`}
    </span>
  );
}
export function ChartCard({
  title,
  description,
  children,
  action,
  className = "",
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card chart-card ${className}`}>
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          <Help text={description} />
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Help({ text }: { text: string }) {
  return (
    <details className="help">
      <summary aria-label="What does this mean?">
        <Info size={14} />
        <span>What does this mean?</span>
      </summary>
      <p>{text}</p>
    </details>
  );
}
export function EmptyState({
  title = "No study data yet.",
  text = "Add your first study session to see this analysis.",
  action,
  onAction,
}: {
  title?: string;
  text?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <BookOpen size={25} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {onAction && (
        <button className="btn primary" onClick={onAction}>
          <Plus size={16} />
          {action || "Add Study Session"}
        </button>
      )}
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    previous = useRef<Element | null>(null);
  useEffect(() => {
    previous.current = document.activeElement;
    ref.current?.showModal();
    return () => {
      if (previous.current instanceof HTMLElement) previous.current.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ConfirmDialog({
  title,
  text,
  onConfirm,
  onClose,
  label = "Confirm",
  danger = false,
}: {
  title: string;
  text: string;
  onConfirm: () => void;
  onClose: () => void;
  label?: string;
  danger?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-body">
        <p>{text}</p>
      </div>
      <div className="modal-foot">
        <button className="btn secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className={`btn ${danger ? "danger" : "primary"}`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {label}
        </button>
      </div>
    </Modal>
  );
}
export function StatusIcon({ status }: { status: string }) {
  return ["Strong", "Completed", "Mastered"].includes(status) ? (
    <CheckCircle2 size={16} />
  ) : status === "Weak" || status === "Overdue" ? (
    <AlertTriangle size={16} />
  ) : (
    <Info size={16} />
  );
}
export const statusTone = (status: string) =>
  ["Strong", "Completed", "Mastered", "On track"].includes(status)
    ? "green"
    : ["Weak", "Overdue"].includes(status)
      ? "red"
      : [
            "Needs attention",
            "In Progress",
            "Revision Due",
            "Due today",
          ].includes(status)
        ? "amber"
        : "neutral";
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
