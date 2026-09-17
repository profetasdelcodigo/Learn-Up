"use client";

// Keep every existing Library server action available to client components,
// but send the large public-library file upload through a dedicated Route Handler.
// This avoids relying on the Server Action multipart transport for binary uploads.
import {
  approveLibraryItem,
  rejectLibraryItem,
  deleteOwnLibraryItem,
  getUserIndexedDocuments,
  deleteAiDocument,
  uploadAndIndexAiDocument,
} from "../actions/library";

export {
  approveLibraryItem,
  rejectLibraryItem,
  deleteOwnLibraryItem,
  getUserIndexedDocuments,
  deleteAiDocument,
  uploadAndIndexAiDocument,
};

export async function uploadLibraryFile(formData: FormData): Promise<{ success: boolean; error?: string; itemId?: string }> {
  const response = await fetch("/api/library/upload", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new Error(body?.error || `No se pudo subir el material (HTTP ${response.status})`);
  }

  return {
    success: true,
    itemId: body.itemId,
  };
}
