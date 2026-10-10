/* eslint-disable react/prop-types */
import { cx } from "../../utils/format";

/** Bloque de carga genérico. */
export const Skeleton = ({ className = "" }) => (
  <div className={cx("animate-pulse rounded-lg bg-slate-200/80", className)} />
);

/** Esqueleto de tabla (para listas de usuarios, productos, tareas...). */
export const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <div className="divide-y divide-slate-100 px-6 py-2">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-4 py-4">
        <Skeleton className="h-10 w-10 !rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/4 !bg-slate-100" />
        </div>
        {Array.from({ length: Math.max(cols - 2, 0) }).map((_, c) => (
          <Skeleton key={c} className="hidden h-5 w-20 !rounded-full !bg-slate-100 sm:block" />
        ))}
      </div>
    ))}
  </div>
);

/** Esqueleto de tarjetas (para grids de proyectos, clientes...). */
export const CardsSkeleton = ({ count = 6, className = "" }) => (
  <div className={cx("grid gap-5 sm:grid-cols-2 xl:grid-cols-3", className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="admin-card space-y-3 p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 !rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3 !bg-slate-100" />
          </div>
        </div>
        <Skeleton className="h-3 w-full !bg-slate-100" />
        <Skeleton className="h-3 w-5/6 !bg-slate-100" />
      </div>
    ))}
  </div>
);

export default Skeleton;
