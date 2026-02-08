"use client";

import { useState, useRef } from "react";
import { X, Users, Upload, Check, Camera } from "lucide-react";
import { createGroup, updateGroup, uploadChatMedia } from "@/actions/chat";

interface Friend {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: Friend[];
  onGroupCreated: (roomId: string) => void;
}

export default function CreateGroupModal({
  isOpen,
  onClose,
  friends,
  onGroupCreated,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const toggleFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId],
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedFriends.length === 0) return;

    setIsCreating(true);
    try {
      // 1. Create Group first to get ID
      const roomId = await createGroup(groupName.trim(), selectedFriends);

      // 2. If photo selected, upload and update
      if (selectedFile) {
        try {
          const avatarUrl = await uploadChatMedia(selectedFile, roomId);
          await updateGroup(roomId, groupName.trim(), avatarUrl);
        } catch (uploadError) {
          console.error("Error uploading group photo:", uploadError);
          // Continue even if photo fails, just warn or ignore
        }
      }

      onGroupCreated(roomId);
      onClose();
      // Reset state
      setGroupName("");
      setSelectedFriends([]);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("Error creating group:", error);
      alert("Error al crear el grupo");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-brand-black border border-brand-gold/30 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-gold" />
            Crear Nuevo Grupo
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Photo Upload */}
          <div className="flex flex-col items-center justify-center">
            <div
              className="relative w-24 h-24 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center cursor-pointer hover:border-brand-gold hover:bg-gray-800/50 transition-all overflow-hidden group"
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center text-gray-400 group-hover:text-brand-gold">
                  <Camera className="w-8 h-8 mb-1" />
                  <span className="text-[10px]">Foto</span>
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            <p className="text-xs text-gray-500 mt-2">
              Opcional: Elige una foto
            </p>
          </div>

          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Nombre del Grupo
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ej: Estudio de Matemáticas"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white focus:outline-none focus:border-brand-gold/50"
              maxLength={50}
            />
          </div>

          {/* Friend Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Seleccionar Amigos ({selectedFriends.length} seleccionados)
            </label>
            <div className="space-y-2">
              {friends.map((friend) => {
                const isSelected = selectedFriends.includes(friend.id);
                return (
                  <div
                    key={friend.id}
                    onClick={() => toggleFriend(friend.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "bg-brand-gold/20 border border-brand-gold/50"
                        : "bg-gray-900 border border-gray-800 hover:bg-gray-800"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center">
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt={friend.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">
                        {friend.full_name || friend.username}
                      </p>
                      <p className="text-xs text-gray-400">
                        @{friend.username}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-brand-gold" />
                    )}
                  </div>
                );
              })}
              {friends.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No tienes amigos para agregar
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={
              !groupName.trim() || selectedFriends.length === 0 || isCreating
            }
            className="flex-1 px-4 py-3 bg-brand-gold text-brand-black rounded-xl hover:bg-white transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creando..." : "Crear Grupo"}
          </button>
        </div>
      </div>
    </div>
  );
}
