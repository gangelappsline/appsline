/* eslint-disable react/prop-types */
import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { FiX } from "react-icons/fi";
import { cx } from "../../utils/format";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  "2xl": "max-w-4xl",
};

/**
 * Modal accesible y reutilizable (Headless UI + Tailwind).
 * @example
 * <Modal open={show} onClose={close} title="Nuevo proyecto" footer={<Button>Guardar</Button>}>
 *   ...
 * </Modal>
 */
const Modal = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "lg",
  dismissible = true,
}) => (
  <Transition appear show={open} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={dismissible ? onClose : () => {}}>
      <Transition.Child
        as={Fragment}
        enter="ease-out duration-200"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-150"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
      </Transition.Child>

      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95 translate-y-2"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100 translate-y-0"
            leaveTo="opacity-0 scale-95 translate-y-2"
          >
            <Dialog.Panel
              className={cx(
                "w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-card-lg",
                SIZES[size] || SIZES.lg
              )}
            >
              {(title || dismissible) && (
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                  <div>
                    {title && (
                      <Dialog.Title className="text-lg font-semibold tracking-tight text-slate-900">
                        {title}
                      </Dialog.Title>
                    )}
                    {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
                  </div>
                  {dismissible && (
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Cerrar"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                      <FiX className="text-lg" />
                    </button>
                  )}
                </div>
              )}

              <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>

              {footer && (
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
                  {footer}
                </div>
              )}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);

export default Modal;
