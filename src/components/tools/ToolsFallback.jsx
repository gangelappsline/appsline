/** Esqueleto mostrado mientras se descarga el bundle de una herramienta. */
const ToolsFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#080a0f]">
    <div className="flex flex-col items-center gap-4">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[#00A3FE]" />
      <p className="text-sm text-slate-500">Appsline</p>
    </div>
  </div>
);

export default ToolsFallback;
