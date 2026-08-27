import { atom } from "jotai";

export interface SharePayload {
  title: string;
  text: string;
  url?: string;
  type: "event" | "recipe" | "library" | "text" | "link";
}

export const shareModalOpenAtom = atom<boolean>(false);
export const sharePayloadAtom = atom<SharePayload | null>(null);
