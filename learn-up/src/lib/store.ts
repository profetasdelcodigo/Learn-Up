import { atom, type WritableAtom } from "jotai";

export interface SharePayload {
  title: string;
  text: string;
  url?: string;
  type: "event" | "recipe" | "library" | "text" | "link";
}

export const shareModalOpenAtom = atom<boolean>(false);

// Jotai's inference can expose a nullable primitive atom as read-only when the
// project keeps strictNullChecks disabled. Keep the runtime atom unchanged and
// make its writable contract explicit for consumers using useSetAtom/useAtom.
export const sharePayloadAtom = atom<SharePayload | null>(null) as WritableAtom<
  SharePayload | null,
  [SharePayload | null],
  void
>;