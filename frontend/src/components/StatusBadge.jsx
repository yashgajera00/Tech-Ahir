export default function StatusBadge({ status }) {
  const normalized = status === 'closed' ? 'ended' : status;

  return (
    <span className={`status-badge status-${normalized}`}>
      {normalized}
    </span>
  );
}
