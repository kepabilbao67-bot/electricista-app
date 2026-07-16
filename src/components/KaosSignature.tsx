export function KaosSignature({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-[9px] text-slate-400 text-center no-print">
        KepatecnologIA · KAOS
      </p>
    );
  }

  return (
    <div className="no-print px-4 py-3 border-t border-slate-700/30 text-center space-y-0.5">
      <p className="text-[10px] font-medium text-blue-400/80">
        <span className="text-amber-400/70">&#9889;</span> Desarrollado por KepatecnologIA
      </p>
      <p className="text-[9px] text-slate-500">KAOS System</p>
    </div>
  );
}
