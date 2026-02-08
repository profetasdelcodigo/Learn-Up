import { useState, useRef } from "react";
import { X, Users, Edit2, LogOut, Upload, Loader2, Camera } from "lucide-react";
import { updateGroup, uploadChatMedia } from "@/actions/chat";
import { createClient } from "@/utils/supabase/client";

interface GroupInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  room: {
    id: string;
    name?: string;
    participants: string[];
    type: "group" | "private";
    avatar_url?: string | null;
  };
  members: Array<{
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  }>;
  currentUserId: string;
  onLeaveGroup: () => void;
}

export default function GroupInfoPanel({
  isOpen,
  onClose,
  room,
  members,
  currentUserId,
  onLeaveGroup,
}: GroupInfoPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [groupName, setGroupName] = useState(room.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    room.avatar_url || null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || room.type !== "group") return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      // Auto-enable edit mode if not already
      if (!isEditing) setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!groupName.trim()) return;
    setIsSaving(true);
    try {
      let avatarUrl = room.avatar_url;

      if (selectedFile) {
        avatarUrl = await uploadChatMedia(selectedFile, room.id);
      }

      await updateGroup(room.id, groupName.trim(), avatarUrl);
      setIsEditing(false);
      setSelectedFile(null);
      // Reload logic handled by page or realtime usually, but local state update:
      // In a real app we might want to update the parent's room list or rely on realtime.
    } catch (error) {
      console.error("Error upgrading group:", error);
      alert("Error al actualizar grupo");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-brand-black border-l border-brand-gold/30 z-40 shadow-2xl overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="sticky top-0 bg-brand-black/95 backdrop-blur-xl border-b border-gray-800 p-4 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Info del Grupo</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Group Photo */}
      <div className="p-6 flex flex-col items-center border-b border-gray-800">
        <div
          className="w-24 h-24 rounded-full bg-brand-gold/20 border-2 border-brand-gold/50 flex items-center justify-center mb-4 relative group cursor-pointer overflow-hidden"
          onClick={() => isEditing && fileInputRef.current?.click()}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              className="w-full h-full object-cover"
              alt="Group"
            />
          ) : (
            <Users className="w-12 h-12 text-brand-gold" />
          )}

          {isEditing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="hidden"
          disabled={!isEditing}
        />

        {/* Group Name */}
        {isEditing ? (
          <div className="w-full space-y-2">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-white text-center focus:outline-none focus:border-brand-gold/50"
              maxLength={50}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setGroupName(room.name || "");
                  setPreviewUrl(room.avatar_url || null);
                  setSelectedFile(null);
                }}
                className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-3 py-2 bg-brand-gold text-brand-black rounded-lg text-sm font-bold flex items-center justify-center"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Guardar"
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-white">{room.name}</h3>
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <Edit2 className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        )}
        <p className="text-sm text-gray-400 mt-1">
          {members.length} {members.length === 1 ? "miembro" : "miembros"}
        </p>
      </div>

      {/* Members List */}
      <div className="p-4">
        <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">
          Miembros
        </h4>
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-xl"
            >
              <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center">
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">
                  {member.full_name || member.username}
                  {member.id === currentUserId && (
                    <span className="text-xs text-brand-gold ml-2">(Tú)</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">@{member.username}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={onLeaveGroup}
          className="w-full px-4 py-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Salir del Grupo
        </button>
      </div>
    </div>
  );
}
