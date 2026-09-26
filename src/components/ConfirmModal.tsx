import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

/** Confirmation dialog rendered via a portal into `document.body`. */
export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  // Render into body via a portal (centered in the viewport)
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <button
        type="button"
        aria-label={t("cancel")}
        className="absolute inset-0 bg-black/50 border-0 p-0 cursor-default"
        onClick={onCancel}
      />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
          {title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition"
          >
            {t("delete")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
