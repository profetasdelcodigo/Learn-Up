import { atom } from "jotai";

export interface SharePayload {
  title: string;
  text: string;
  url?: string;
  type: "event" | "recipe" | "library" | "text" | "link";
}

export const shareModalOpenAtom = atom<boolean>(false);

const sharePayloadBaseAtom = atom<SharePayload | null>(null);

export const sharePayloadAtom = atom(
  (get) => get(sharePayloadBaseAtom),
  (_get, set, next: SharePayload | null) => set(sharePayloadBaseAtom, next),
);
