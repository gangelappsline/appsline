/* eslint-disable react/prop-types */
import { useState } from "react";
import { cx, initials } from "../../utils/format";

/** Paleta determinista para que cada usuario tenga siempre el mismo color. */
const PALETTE = [
  "from-brand-600 to-brand-400",
  "from-violet-600 to-violet-400",
  "from-sky-600 to-sky-400",
  "from-emerald-600 to-emerald-400",
  "from-amber-500 to-orange-400",
  "from-rose-500 to-pink-400",
];

const SIZES = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-16 w-16 text-lg",
};

const colorFor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
};

/**
 * Avatar de usuario con foto o iniciales.
 * @example <Avatar user={task.assigned_to} size="sm" />
 */
const Avatar = ({ user, size = "md", ring = false, className = "" }) => {
  const [broken, setBroken] = useState(false);
  const name = user?.name || user?.email || "Sin asignar";
  const photo = user?.photo || user?.avatar || user?.image;

  return (
    <span
      title={name}
      className={cx(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
        "bg-gradient-to-br font-bold text-white",
        SIZES[size] || SIZES.md,
        !photo || broken ? colorFor(name) : "bg-slate-200",
        ring && "ring-2 ring-white",
        className
      )}
    >
      {photo && !broken ? (
        <img
          src={photo}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initials(name, "–")
      )}
    </span>
  );
};

/** Pila de avatares superpuestos con contador "+N". */
export const AvatarStack = ({ users = [], max = 4, size = "sm" }) => {
  const visible = users.slice(0, max);
  const extra = users.length - visible.length;
  return (
    <div className="flex items-center">
      {visible.map((u, i) => (
        <Avatar key={u?.id || i} user={u} size={size} ring className={i > 0 ? "-ml-2" : ""} />
      ))}
      {extra > 0 && (
        <span
          className={cx(
            "-ml-2 inline-flex shrink-0 items-center justify-center rounded-full",
            "bg-slate-100 font-semibold text-slate-500 ring-2 ring-white",
            SIZES[size] || SIZES.sm
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
};

export default Avatar;
