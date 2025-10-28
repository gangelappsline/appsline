import React from "react";

/**
 * UserAvatar
 * Props:
 *  - profile: object or string. If object, can contain { id, name, email, photo }
 *  - size: number (px) or string (e.g. "40px") - default 32
 *  - color: tailwind class (e.g. "bg-blue-500") or hex color (e.g. "#1f2937")
 *  - rounded: tailwind rounding class (default "rounded-full")
 *  - className: additional classes
 */
export default function UserAvatar({
  profile = null,
  size = 32,
  color = "bg-gray-600",
  rounded = "rounded-full",
  className = "",
}) {
  const obj = typeof profile === "object" && profile !== null ? profile : null;
  const name =
    (obj && (obj.name || obj.full_name)) ||
    (typeof profile === "string" ? profile : obj?.email) ||
    "";
  const email = obj?.email || "";
  const photo = obj?.photo || obj?.avatar || obj?.image || null;

  const s = typeof size === "number" ? `${size}px` : size;
  const initials = (name || email || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2) || "?";

  const useHex = typeof color === "string" && color.startsWith("#");
  const bgClass = useHex ? "" : color;

  const style = {
    width: s,
    height: s,
    lineHeight: s,
    fontSize: `calc(${s} / 2.4)`,
    ...(useHex ? { backgroundColor: color } : {}),
  };

  const title = name || email || "Usuario";

  if (photo) {
    return (
      <div
        className={`inline-block overflow-hidden ${rounded} ${className}`}
        style={{ width: s, height: s }}
        title={title}
        aria-hidden={false}
      >
        <img
          src={photo}
          alt={title}
          className={`w-full h-full object-cover ${rounded}`}
          onError={(e) => {
            // fallback to initials if image fails
            e.currentTarget.style.display = "none";
            const p = e.currentTarget.parentNode;
            if (p) {
              p.querySelector?.("span")?.classList?.remove?.("hidden");
            }
          }}
        />
        {/* fallback initials (hidden by default, shown if img fails via onError) */}
        <span
          className={`hidden w-full h-full inline-flex items-center justify-center text-white font-semibold`}
          style={style}
        >
          {initials}
        </span>
      </div>
    );
  }

  // no photo -> show initials block
  return (
    <div
      className={`inline-flex items-center justify-center text-white font-semibold ${rounded} ${bgClass} ${className}`}
      style={style}
      title={title}
      role="img"
      aria-label={title}
    >
      {initials}
    </div>
  );
}