export function LoadingIndicator({
  label,
  progress,
}: {
  label: string;
  progress?: number;
}) {
  if (progress !== undefined) {
    const safeProgress = Math.min(100, Math.max(0, Math.round(progress)));
    return (
      <div className="loading-progress" role="status">
        <div className="loading-progress-heading">
          <span>{label}</span>
          <strong>{safeProgress}%</strong>
        </div>
        <div
          className="loading-progress-track"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safeProgress}
        >
          <span
            className="loading-progress-fill"
            aria-hidden="true"
            style={{ width: `${safeProgress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="loading-indicator" role="status" aria-label={label}>
      <span className="loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
