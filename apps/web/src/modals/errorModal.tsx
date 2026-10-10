export type NoticeType = "Error" | "Info" | "Warning";

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

function ExclamationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 6.5v8" />
      <circle cx="12" cy="17.75" r="1.15" />
    </svg>
  );
}

const notices = {
  Error: {
    title: "Error",
    icon: <CrossIcon />,
    className: "is-error",
  },
  Info: {
    title: "Info",
    icon: <ExclamationIcon />,
    className: "is-info",
  },
  Warning: {
    title: "Warning",
    icon: <ExclamationIcon />,
    className: "is-warning",
  },
} as const;

export default function ErrorModal({
  type,
  message,
  onClose,
}: {
  type: NoticeType;
  message: string;
  onClose: () => void;
}) {
  const notice = notices[type];

  return (
    <div className="eon-modal" role="presentation" onClick={onClose}>
      <div
        className={`eon-modal-card eon-notice ${notice.className}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="notice-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="eon-notice-icon" aria-hidden="true">
          {notice.icon}
        </span>
        <h2 id="notice-title">{notice.title}</h2>
        <p>{message}</p>
        <button type="button" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}
