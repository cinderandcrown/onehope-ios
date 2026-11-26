export default function Loading() {
  return (
    <div className="grid" aria-busy="true" aria-live="polite">
      <div className="card">
        <div className="skeleton" />
      </div>
      <div className="card">
        <div className="skeleton" />
      </div>
      <div className="card">
        <div className="skeleton" />
      </div>
    </div>
  );
}
