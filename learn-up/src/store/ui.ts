import { atom } from "jotai";

export type Toast = {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
};

export const toastsAtom = atom<Toast[]>([]);

export const addToastAtom = atom(
  null,
  (get, set, toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { ...toast, id };
    set(toastsAtom, (prev) => [...prev, newToast]);
    
    // Auto remove
    setTimeout(() => {
      set(toastsAtom, (prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }
);

export const removeToastAtom = atom(
  null,
  (get, set, id: string) => {
    set(toastsAtom, (prev) => prev.filter((t) => t.id !== id));
  }
);
