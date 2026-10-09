import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiX, FiUpload, FiCheck, FiAlertCircle } from "react-icons/fi";

const ContactModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    photo: null,
    message: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState("");

  // Resetear el estado cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setForm({ name: "", email: "", photo: null, message: "" });
      setErrors({});
      setSuccess(false);
      setServerError("");
      setLoading(false);
    }
  }, [isOpen]);

  // Cerrar con la tecla Escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, photo: file }));
    setErrors((prev) => ({ ...prev, photo: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = t("contact.errors.name");
    if (!form.email.trim()) {
      newErrors.email = t("contact.errors.emailRequired");
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      newErrors.email = t("contact.errors.emailInvalid");
    }
    if (!form.message.trim()) newErrors.message = t("contact.errors.message");

    if (form.photo) {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];
      if (form.photo.size > maxSize) {
        newErrors.photo = t("contact.errors.photoSize");
      } else if (!allowedTypes.includes(form.photo.type)) {
        newErrors.photo = t("contact.errors.photoType");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!validate()) return;

    setLoading(true);

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const response = await fetch(`${apiUrl}/contact`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json", // 👈 esto faltaba
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Error al enviar el mensaje");
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err) {
      setServerError(err.message || t("contact.errors.server"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1017] p-6 text-white shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 transition hover:text-white"
          aria-label="Cerrar"
        >
          <FiX size={22} />
        </button>

        {success ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 text-green-400">
              <FiCheck size={28} />
            </div>
            <h3 className="text-xl font-semibold">
              {t("contact.successTitle")}
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              {t("contact.successMessage")}
            </p>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-semibold">{t("contact.title")}</h3>
            <p className="mt-1 text-sm text-slate-400">
              {t("contact.subtitle")}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  {t("contact.fields.name")}
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-[#080a0f] px-4 py-2.5 text-white outline-none transition focus:border-[#002EFD] ${
                    errors.name ? "border-red-500" : "border-white/10"
                  }`}
                  placeholder={t("contact.placeholders.name")}
                />
                {errors.name && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                    <FiAlertCircle size={12} /> {errors.name}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  {t("contact.fields.email")}
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className={`w-full rounded-lg border bg-[#080a0f] px-4 py-2.5 text-white outline-none transition focus:border-[#002EFD] ${
                    errors.email ? "border-red-500" : "border-white/10"
                  }`}
                  placeholder={t("contact.placeholders.email")}
                />
                {errors.email && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                    <FiAlertCircle size={12} /> {errors.email}
                  </p>
                )}
              </div>

              {/* Photo */}
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  {t("contact.fields.photo")}{" "}
                  <span className="text-slate-500">
                    ({t("contact.optional")})
                  </span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-[#080a0f] px-4 py-2.5 transition hover:border-[#002EFD] ${
                    errors.photo ? "border-red-500" : "border-white/10"
                  }`}
                >
                  <span className="truncate text-sm text-slate-400">
                    {form.photo
                      ? form.photo.name
                      : t("contact.placeholders.photo")}
                  </span>
                  <FiUpload className="shrink-0 text-slate-400" />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {errors.photo && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                    <FiAlertCircle size={12} /> {errors.photo}
                  </p>
                )}
              </div>

              {/* Message */}
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  {t("contact.fields.message")}
                </label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={4}
                  className={`w-full resize-none rounded-lg border bg-[#080a0f] px-4 py-2.5 text-white outline-none transition focus:border-[#002EFD] ${
                    errors.message ? "border-red-500" : "border-white/10"
                  }`}
                  placeholder={t("contact.placeholders.message")}
                />
                {errors.message && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                    <FiAlertCircle size={12} /> {errors.message}
                  </p>
                )}
              </div>

              {serverError && (
                <p className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  <FiAlertCircle size={14} /> {serverError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#002EFD] py-3 font-medium text-white transition hover:bg-[#0026d6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? t("contact.sending") : t("contact.send")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ContactModal;
