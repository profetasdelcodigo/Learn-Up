import { useState, useRef } from "react";
import {
  X,
  Users,
  Edit2,
  LogOut,
  Upload,
  Loader2,
  Camera,
  Lock,
  UserPlus,
  Search,
} from "lucide-react";
import { updateGroup, uploadChatMedia, addGroupMember } from "@/actions/chat";
import { searchUsers, sendFriendRequest, cancelFriendRequest } from "@/actions/friendship";
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
    description?: string | null;
    admins?: string[];
    only_admins_message?: boolean;
  };
  members: Array<{
    id: string;
    username?: string | null;
    full_name?: string | null;
    avatar_url: string | null;
    school?: string | null;
    grade?: string | null;
    section?: string | null;
    role?: string | null;
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
  const [description, setDescription] = useState(room.description || "");
  const [onlyAdminsMessage, setOnlyAdminsMessage] = useState(
    room.only_admins_message || false,
  );
  const [groupAdmins, setGroupAdmins] = useState<string[]>(room.admins || []);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    room.avatar_url || null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
    friendshipStatus?: string | null;
    isRequester?: boolean;
  }>>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [searchingMembers, setSearchingMembers] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!isOpen || room.type !== "group") return null;

  const isCurrentUserAdmin = groupAdmins.includes(currentUserId);

  const toggleAdmin = async (memberId: string) => {
    if (!isCurrentUserAdmin || memberId === currentUserId) return;

    const newAdmins = groupAdmins.includes(memberId)
      ? groupAdmins.filter((id) => id !== memberId)
      : [...groupAdmins, memberId];

    // Optimistic update
    setGroupAdmins(newAdmins);
    try {
      await updateGroup(
        room.id,
        undefined,
        undefined,
        undefined,
        undefined,
        newAdmins,
      );
    } catch (error) {
      console.error("Error updating admin status:", error);
      // Revert on error
      setGroupAdmins(groupAdmins);
      alert("Error al actualizar administrador");
    }
  };

  // Search friends for adding to group
  const handleMemberSearch = (query: string) => {
    setMemberSearch(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchingMembers(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchUsers(query);
      // Filtrar los que ya son miembros
      const filtered = results.filter((p: any) => !room.participants.includes(p.id));
      setSearchResults(filtered.slice(0, 5));
      setSearchingMembers(false);
    }, 300);
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await sendFriendRequest(userId);
      setSearchResults((prev: any[]) =>
        prev.map((u) => (u.id === userId ? { ...u, friendshipStatus: "pending", isRequester: true } : u))
      );
    } catch {
      alert("Error al enviar solicitud");
    }
  };

  const handleCancelRequest = async (userId: string) => {
    try {
      await cancelFriendRequest(userId);
      setSearchResults((prev: any[]) =>
        prev.map((u) => (u.id === userId ? { ...u, friendshipStatus: null, isRequester: false } : u))
      );
    } catch {
      alert("Error al cancelar solicitud");
    }
  };

  const handleAddMember = async (userId: string) => {
    setAddingMember(true);
    try {
      await addGroupMember(room.id, userId);
      setSearchResults(results => results.filter(r => r.id !== userId));
      setMemberSearch("");
      setShowAddMember(false);
      alert("✅ Miembro agregado exitosamente");
    } catch (error: any) {
      alert(error.message || "Error al agregar miembro");
    } finally {
      setAddingMember(false);
    }
  };

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

      await updateGroup(
        room.id,
        groupName.trim(),
        avatarUrl,
        description.trim() ? description.trim() : null,
        onlyAdminsMessage,
        groupAdmins,
      );
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
      <div className="sticky top-0 bg-brand-black/95 backdrop-blur-xl border-b border-white/6 p-4 z-10">
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
      <div className="p-6 flex flex-col items-center border-b border-white/6">
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
              className="w-full px-4 py-2 bg-surface-2 border border-white/6 rounded-xl text-white text-center focus:outline-none focus:border-brand-gold/50"
              maxLength={50}
              placeholder="Nombre del grupo"
              autoFocus
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-surface-2 border border-white/6 rounded-xl text-white text-sm focus:outline-none focus:border-brand-gold/50 resize-none"
              placeholder="Añade una descripción (Opcional)"
              rows={3}
              maxLength={200}
            />

            <label className="flex items-center gap-3 p-3 bg-surface-2 border border-white/6 rounded-xl cursor-pointer hover:border-brand-gold/50 transition-colors">
              <input
                type="checkbox"
                checked={onlyAdminsMessage}
                onChange={(e) => setOnlyAdminsMessage(e.target.checked)}
                className="w-5 h-5 accent-brand-gold rounded cursor-pointer"
              />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">
                  Solo administradores pueden enviar mensajes
                </p>
                <p className="text-gray-400 text-xs text-left">
                  Restringe el chat
                </p>
              </div>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setGroupName(room.name || "");
                  setDescription(room.description || "");
                  setOnlyAdminsMessage(room.only_admins_message || false);
                  setPreviewUrl(room.avatar_url || null);
                  setSelectedFile(null);
                }}
                className="flex-1 px-3 py-2 bg-surface-2 text-white rounded-lg text-sm"
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
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-white text-center">
                {room.name}
              </h3>
              {isCurrentUserAdmin && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors shrink-0"
                >
                  <Edit2 className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
            {room.description && (
              <p className="text-sm text-gray-300 text-center max-w-[90%] whitespace-pre-wrap">
                {room.description}
              </p>
            )}
            {room.only_admins_message && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-gold/10 text-brand-gold text-xs font-medium rounded-full mt-1">
                <Lock className="w-3 h-3" /> Solo Admins pueden escribir
              </span>
            )}
          </div>
        )}
        <p className="text-sm text-gray-400 mt-3">
          {members.length} {members.length === 1 ? "miembro" : "miembros"}
        </p>
      </div>

      {/* Members List */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-400 uppercase">
            Miembros
          </h4>
          {isCurrentUserAdmin && (
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-gold/10 text-brand-gold border border-brand-gold/30 rounded-lg text-xs font-semibold hover:bg-brand-gold hover:text-brand-black transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Agregar
            </button>
          )}
        </div>

        {/* Add Member Search */}
        {showAddMember && (
          <div className="mb-4 p-3 bg-surface-2/80 rounded-xl border border-brand-gold/20">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => handleMemberSearch(e.target.value)}
                placeholder="Buscar por nombre o @usuario..."
                className="w-full pl-9 pr-3 py-2 bg-brand-black border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-brand-gold/50"
                autoFocus
              />
            </div>
            {searchingMembers && (
              <div className="flex items-center gap-2 py-2 text-gray-400 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-surface-2 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                        {result.avatar_url ? (
                          <img src={result.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-gray-400">
                            {result.full_name?.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white truncate max-w-[120px]">
                          {result.full_name}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate max-w-[120px]">
                          @{result.username}
                        </p>
                      </div>
                    </div>

                    {result.friendshipStatus === "accepted" ? (
                      <button
                        onClick={() => handleAddMember(result.id)}
                        disabled={addingMember}
                        className="px-3 py-1.5 text-xs font-semibold bg-brand-gold text-brand-black rounded-lg hover:bg-white transition-all disabled:opacity-50"
                      >
                        Agregar
                      </button>
                    ) : result.friendshipStatus === "pending" && result.isRequester ? (
                      <button
                        onClick={() => handleCancelRequest(result.id)}
                        className="px-3 py-1.5 text-[10px] font-semibold bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all border border-red-500/30"
                      >
                        Cancelar Solicitud
                      </button>
                    ) : result.friendshipStatus === "pending" && !result.isRequester ? (
                      <span className="px-3 py-1.5 text-[10px] text-gray-400 font-medium">
                        Te envió solicitud
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(result.id)}
                        className="px-3 py-1.5 text-[10px] font-semibold bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all border border-gray-600"
                      >
                        Enviar Solicitud
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {memberSearch.length >= 2 && !searchingMembers && searchResults.length === 0 && (
              <p className="text-gray-500 text-xs text-center py-2">No se encontraron usuarios</p>
            )}
          </div>
        )}
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 bg-surface-2/50 rounded-xl"
            >
              <div className="w-10 h-10 rounded-full bg-surface-2 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.full_name || member.username || "Usuario"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate flex items-center gap-2">
                  {member.full_name || member.username || "Usuario"}
                  {member.id === currentUserId && (
                    <span className="text-xs text-brand-gold shrink-0">
                      (Tú)
                    </span>
                  )}
                  {groupAdmins.includes(member.id) && (
                    <span className="text-[10px] uppercase font-bold text-brand-gold border border-brand-gold px-1.5 rounded-sm shrink-0">
                      Admin
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  @{member.username || "usuario"}
                </p>
                {(member.school || member.grade || member.section) && (
                  <p className="text-[11px] text-gray-500 truncate">
                    {[member.school, member.grade, member.section]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>

              {isCurrentUserAdmin && member.id !== currentUserId && (
                <button
                  onClick={() => toggleAdmin(member.id)}
                  title={
                    groupAdmins.includes(member.id)
                      ? "Quitar admin"
                      : "Hacer admin"
                  }
                  className={`p-2 rounded-lg transition-colors shrink-0 ${
                    groupAdmins.includes(member.id)
                      ? "text-brand-gold hover:bg-brand-red hover:text-white"
                      : "text-gray-500 hover:text-brand-gold hover:bg-white/5"
                  }`}
                >
                  <Users className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-white/6">
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
