'use client';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b1220] px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-violet-300">Error</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">La pantalla no pudo cargar</h1>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        {error.message || 'Probá recargar. Si sigue, cerrá sesión y volvé a entrar.'}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
      >
        Reintentar
      </button>
    </div>
  );
}
