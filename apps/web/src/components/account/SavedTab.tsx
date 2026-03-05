export function SavedTab() {
  return (
    <div className="saved-tab">
      <div className="saved-tab-empty">
        <svg
          className="saved-tab-icon"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <h3 className="saved-tab-empty-heading">Noch nichts gespeichert</h3>
        <p className="saved-tab-empty-text">
          Speichere Routen und Favoriten, um sie hier zu sehen.
        </p>
      </div>
    </div>
  );
}
