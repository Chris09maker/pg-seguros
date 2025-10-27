export default function TopNav({ onLogoClick }) {
  return (
    <header className="bg-white border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <button onClick={onLogoClick} className="font-semibold tracking-wide">
          PG Seguros
        </button>
        <div className="text-sm text-slate-500">v0.1 • Local</div>
      </div>
    </header>
  );
}
