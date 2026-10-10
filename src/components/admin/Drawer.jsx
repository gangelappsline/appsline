/* eslint-disable react/prop-types */
import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { cx } from "../../utils/format";

/**
 * Panel lateral deslizante (para detalles, editores, filtros avanzados).
 * @example <Drawer open={!!task} onClose={close} wide>...</Drawer>
 */
const Drawer = ({ open, onClose, children, wide = false, labelledBy }) => (
  <Transition appear show={open} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={onClose} aria-labelledby={labelledBy}>
      <Transition.Child
        as={Fragment}
        enter="ease-out duration-200"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-150"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]" />
      </Transition.Child>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-y-0 right-0 flex max-w-full">
          <Transition.Child
            as={Fragment}
            enter="transform transition ease-out duration-200"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="transform transition ease-in duration-200"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <Dialog.Panel
              className={cx(
                "pointer-events-auto flex h-full w-screen flex-col overflow-hidden bg-white shadow-2xl",
                wide ? "max-w-4xl" : "max-w-xl"
              )}
            >
              {children}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);

export default Drawer;
