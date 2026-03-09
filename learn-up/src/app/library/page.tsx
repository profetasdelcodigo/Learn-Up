"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  uploadLibraryFile,
  approveLibraryItem,
  rejectLibraryItem,
  deleteOwnLibraryItem,
} from "@/actions/library";
import { getUserRooms, sendMessage as sendMessageAction } from "@/actions/chat";
import { motion, AnimatePresence } from "framer-motion";
import {
  StaggerContainer,
  FadeUpItem,
} from "@/components/animations/StaggerReveal";
import BackButton from "@/components/BackButton";
import { SkeletonGrid } from "@/components/Skeleton";
import {
  BookOpen,
  Upload,
  X,
  Clock,
  Search,
  User,
  CheckCircle,
  XCircle,
  ChevronRight,
  Sparkles,
  FileBadge,
  Video,
  ImageIcon,
  Send,
  FileText,
  FileVideo2,
  Filter,
  Download,
  Share2,
  Star,
  Trash2,
  Loader2,
} from "lucide-react";
import PageLoader from "@/components/PageLoader";

interface LibraryItem {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  file_url: string;
  file_type?: string;
  is_approved: boolean;
  created_at: string;
  user_id: string;
  reviewer_id?: string;
  profiles?: { full_name: string | null; username: string | null };
}

const FILE_ICON_MAP: Record<string, React.ReactNode> = {
  pdf: <FileBadge className="w-6 h-6 text-red-400" />,
  video: <Video className="w-6 h-6 text-blue-400" />,
  image: <ImageIcon className="w-6 h-6 text-green-400" />,
  document: <FileText className="w-6 h-6 text-brand-gold" />,
};

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [pendingItems, setPendingItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDocente, setIsDocente] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingItem, setSharingItem] = useState<LibraryItem | null>(null);
  const [userRooms, setUserRooms] = useState<any[]>([]);
  const [sharingToRooms, setSharingToRooms] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<
    "all" | "favorites" | "recents"
  >("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("library_recents") || "[]");
    }
    return [];
  });
  const [docentes, setDocentes] = useState<
    { id: string; full_name: string; username: string }[]
  >([]);
  const [reviewItem, setReviewItem] = useState<LibraryItem | null>(null); // docente review panel
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "",
    reviewer_username: "",
    file: null as File | null,
  });

  const supabase = createClient();

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role === "docente" || profile?.role === "admin") {
        setIsDocente(true);
        await loadPendingItems(user.id);
      }
      await loadFavorites(user.id);
    }
    await loadItems();
    await loadDocentes();

    // Check URL for review param
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const reviewId = params.get("review");
      if (reviewId) {
        // Load that specific pending item
        const { data } = await supabase
          .from("library_items")
          .select("*, profiles(full_name, username)")
          .eq("id", reviewId)
          .single();
        if (data) setReviewItem(data as LibraryItem);
      }
    }
  };

  const loadItems = async () => {
    try {
      const { data } = await supabase
        .from("library_items")
        .select(
          "id, title, description, subject, file_url, file_type, is_approved, created_at, user_id, profiles(full_name, username)",
        )
        .eq("is_approved", true)
        .order("created_at", { ascending: false });
      if (data) setItems(data as any);
    } catch (err) {
      console.error("Error loading library:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingItems = async (userId: string) => {
    const { data } = await supabase
      .from("library_items")
      .select("*, profiles(full_name, username)")
      .eq("reviewer_id", userId)
      .eq("is_approved", false)
      .order("created_at", { ascending: false });
    if (data) setPendingItems(data as any);
  };

  const loadDocentes = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .in("role", ["docente", "admin"]);
    if (data) setDocentes(data as any);
  };

  const loadFavorites = async (userId: string) => {
    const { data } = await supabase
      .from("library_favorites")
      .select("item_id")
      .eq("user_id", userId);
    if (data) setFavorites(data.map((f: any) => f.item_id));
  };

  const toggleFavorite = async (itemId: string) => {
    if (!currentUserId) return;
    if (favorites.includes(itemId)) {
      await supabase
        .from("library_favorites")
        .delete()
        .match({ user_id: currentUserId, item_id: itemId });
      setFavorites((f) => f.filter((id) => id !== itemId));
    } else {
      await supabase
        .from("library_favorites")
        .insert({ user_id: currentUserId, item_id: itemId });
      setFavorites((f) => [...f, itemId]);
    }
  };

  const openItem = (item: LibraryItem) => {
    const updated = [item.id, ...recents.filter((id) => id !== item.id)].slice(
      0,
      10,
    );
    setRecents(updated);
    localStorage.setItem("library_recents", JSON.stringify(updated));

    if (
      item.file_type === "document" ||
      item.file_url.endsWith(".pdf") ||
      item.file_url.endsWith(".doc") ||
      item.file_url.endsWith(".docx") ||
      item.file_url.endsWith(".ppt") ||
      item.file_url.endsWith(".pptx")
    ) {
      const encodedUrl = encodeURIComponent(item.file_url);
      window.open(
        `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`,
        "_blank",
      );
    } else {
      window.open(item.file_url, "_blank");
    }
  };

  const downloadItem = async (item: LibraryItem) => {
    try {
      const res = await fetch(item.file_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.title || "archivo";
      a.click();
      URL.revokeObjectURL(url);

      if (currentUserId) {
        await supabase.from("user_media").insert({
          user_id: currentUserId,
          file_url: item.file_url,
          file_type: item.file_type || "document",
          source: "library",
          title: item.title,
        });
      }
    } catch (err) {
      console.error("Error al descargar:", err);
    }
  };

  const handleShareClick = async (item: LibraryItem) => {
    setSharingItem(item);
    setShowShareModal(true);
    if (userRooms.length === 0) {
      const rooms = await getUserRooms();
      setUserRooms(rooms);
    }
  };

  const confirmShareToRoom = async (roomId: string) => {
    if (!sharingItem || !currentUserId) return;
    setSharingToRooms(true);
    try {
      const msg = `📚 Te he compartido un material de la Biblioteca:\n\n*${sharingItem.title}*\n${sharingItem.file_url}`;
      await sendMessageAction(roomId, msg);
      alert("Enviado al chat con éxito");
      setShowShareModal(false);
      setSharingItem(null);
    } catch (err) {
      alert("Error al compartir material");
    } finally {
      setSharingToRooms(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file || !formData.title || !formData.reviewer_username)
      return;
    setUploading(true);
    try {
      const data = new FormData();
      data.append("file", formData.file);
      data.append("title", formData.title);
      data.append("description", formData.description);
      data.append("subject", formData.subject);
      data.append("reviewer_username", formData.reviewer_username);
      const result = await uploadLibraryFile(data);
      if (result.success) {
        setShowModal(false);
        setFormData({
          title: "",
          description: "",
          subject: "",
          reviewer_username: "",
          file: null,
        });
        alert(
          "¡Aporte enviado! El docente revisará tu material antes de publicarlo.",
        );
      } else {
        alert(result.error || "Error al subir");
      }
    } catch (err) {
      alert("Error inesperado");
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async (item: LibraryItem) => {
    const result = await approveLibraryItem(item.id);
    if (result.success) {
      setPendingItems((p) => p.filter((i) => i.id !== item.id));
      setReviewItem(null);
      await loadItems();
      alert("✅ Material aprobado y publicado.");
    } else {
      alert(result.error);
    }
  };

  const handleReject = async (item: LibraryItem) => {
    const reason = prompt("¿Motivo del rechazo? (Opcional)");
    const result = await rejectLibraryItem(item.id, reason || undefined);
    if (result.success) {
      setPendingItems((p) => p.filter((i) => i.id !== item.id));
      setReviewItem(null);
      alert("❌ Material rechazado. El autor fue notificado.");
    } else {
      alert(result.error);
    }
  };

  // Filter items
  const filteredItems = items
    .filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.subject?.toLowerCase().includes(q) ||
        item.profiles?.username?.toLowerCase().includes(q) ||
        item.profiles?.full_name?.toLowerCase().includes(q);

      if (activeSection === "favorites")
        return matchesSearch && favorites.includes(item.id);
      if (activeSection === "recents")
        return matchesSearch && recents.includes(item.id);
      return matchesSearch;
    })
    .sort((a, b) => {
      if (activeSection === "recents")
        return recents.indexOf(a.id) - recents.indexOf(b.id);
      return 0;
    });

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-brand-black p-6">
        <BackButton className="mb-6" />
        <div className="h-12 bg-gray-900 rounded-2xl w-64 animate-pulse mb-8" />
        <SkeletonGrid count={6} />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-brand-black">
      <div className="w-full max-w-none">
        <StaggerContainer delayOffset={0.1}>
          <FadeUpItem>
            <BackButton className="mb-6" />

            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-brand-gold" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">
                    Biblioteca
                  </h1>
                  <p className="text-gray-400 text-sm">
                    Comparte y descubre recursos educativos aprobados por
                    docentes
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-brand-gold text-brand-black font-bold rounded-full hover:bg-white transition-all flex items-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Subir Aporte
              </button>
            </div>
          </FadeUpItem>

          {/* Docente Pending Review Panel */}
          {isDocente && pendingItems.length > 0 && (
            <FadeUpItem>
              <div className="mb-8 bg-brand-gold/5 border border-brand-gold/30 rounded-3xl p-6">
                <h2 className="text-lg font-bold text-brand-gold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Materiales pendientes de
                  revisión ({pendingItems.length})
                </h2>
                <div className="space-y-3">
                  {pendingItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-brand-black/60 rounded-2xl border border-gray-800"
                    >
                      <div>
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="text-sm text-gray-400">
                          Por: {item.profiles?.full_name || "Anónimo"} ·{" "}
                          {new Date(item.created_at).toLocaleDateString(
                            "es-ES",
                          )}
                        </p>
                        {item.subject && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Materia: {item.subject}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setReviewItem(item)}
                          className="px-4 py-2 border border-brand-gold/50 text-brand-gold rounded-full text-sm hover:bg-brand-gold hover:text-black transition-all"
                        >
                          Revisar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeUpItem>
          )}

          {/* Search + Sections */}
          <FadeUpItem>
            <div className="mb-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por título, materia o @autor..."
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-900 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold transition-colors"
                />
              </div>
              <div className="flex gap-2">
                {(["all", "favorites", "recents"] as const).map((section) => (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${activeSection === section ? "bg-brand-gold text-brand-black" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"}`}
                  >
                    {section === "all" && <Sparkles className="w-3.5 h-3.5" />}
                    {section === "favorites" && (
                      <Star className="w-3.5 h-3.5" />
                    )}
                    {section === "recents" && <Clock className="w-3.5 h-3.5" />}
                    {section === "all"
                      ? "Todo"
                      : section === "favorites"
                        ? "Favoritos"
                        : "Recientes"}
                  </button>
                ))}
              </div>
            </div>
          </FadeUpItem>

          {/* Items Grid */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">
                {activeSection === "favorites"
                  ? "Aún no tienes favoritos"
                  : activeSection === "recents"
                    ? "No has visto nada aún"
                    : "No hay recursos disponibles"}
              </h3>
              <p className="text-gray-500 text-sm">
                {activeSection === "all"
                  ? "¡Sé el primero en compartir un recurso educativo!"
                  : "Explora la biblioteca y añade a favoritos o abre archivos para verlos aquí."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item, i) => (
                <FadeUpItem key={item.id}>
                  <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 hover:border-brand-gold/40 transition-all group flex flex-col h-full">
                    <div className="flex items-start gap-4 mb-4">
                      {/* Thumbnail / Icon Container */}
                      <div className="relative group/thumb">
                        <div className="w-16 h-16 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                          {item.file_type === "image" ? (
                            <img
                              src={item.file_url}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as any).src = ""; // Fallback logic if needed
                                (e.target as any).className = "hidden";
                              }}
                            />
                          ) : item.file_type === "video" ? (
                            <div className="relative w-full h-full bg-black flex items-center justify-center">
                              <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                              <FileVideo2 className="w-6 h-6 text-brand-gold relative z-10" />
                            </div>
                          ) : (
                            FILE_ICON_MAP[item.file_type || "document"] ||
                            FILE_ICON_MAP.document
                          )}
                        </div>
                        {/* Status tag inside thumbnail if pending */}
                        {!item.is_approved && (
                          <div className="absolute top-0 left-0 w-full h-full bg-black/60 flex items-center justify-center">
                            <span className="text-[8px] font-bold text-brand-gold bg-black/80 px-1 rounded uppercase tracking-tighter">
                              Pendiente
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white leading-tight mb-1 line-clamp-2">
                          {item.title}
                        </h3>
                        {item.subject && (
                          <span className="text-[10px] text-brand-gold bg-brand-gold/10 px-2 py-0.5 rounded-full border border-brand-gold/20">
                            {item.subject}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleFavorite(item.id)}
                        className={`p-1.5 rounded-lg transition-all ${favorites.includes(item.id) ? "text-yellow-400" : "text-gray-600 hover:text-yellow-400"}`}
                      >
                        <Star
                          className={`w-4 h-4 ${favorites.includes(item.id) ? "fill-current" : ""}`}
                        />
                      </button>
                    </div>

                    {/* Contenedor flexible para alinear el pie hacia abajo */}
                    <div className="flex-1 flex flex-col">
                      {item.description ? (
                        <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                          {item.description}
                        </p>
                      ) : (
                        <div className="mb-3 h-[40px]" /> /* Espaciador si no hay descripción para mantener el nivel */
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 mt-auto">
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        @{item.profiles?.username || "anónimo"}
                      </span>
                      <span>·</span>
                      <span className="shrink-0">
                        {new Date(item.created_at).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openItem(item)}
                        className="flex-1 py-2 bg-brand-gold/10 text-brand-gold border border-brand-gold/30 rounded-xl text-xs font-semibold hover:bg-brand-gold hover:text-black transition-all flex items-center justify-center gap-1"
                      >
                        <ChevronRight className="w-3.5 h-3.5" /> Ver
                      </button>
                      <button
                        onClick={() => handleShareClick(item)}
                        className="p-2 bg-gray-800 text-brand-blue-glow rounded-xl hover:bg-brand-blue-glow hover:text-white transition-all flex items-center justify-center"
                        title="Compartir en Chat"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => downloadItem(item)}
                        className="p-2 bg-gray-800 text-gray-400 rounded-xl hover:bg-gray-700 hover:text-white transition-all flex items-center justify-center"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {item.user_id === currentUserId && (
                        <button
                          onClick={async () => {
                            if (
                              confirm(
                                "¿Estás seguro de que quieres eliminar este recurso?",
                              )
                            ) {
                              const res = await deleteOwnLibraryItem(item.id);
                              if (res.success) {
                                // Simple refresh
                                window.location.reload();
                              } else {
                                alert(res.error || "Error al eliminar");
                              }
                            }
                          }}
                          className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </FadeUpItem>
              ))}
            </div>
          )}
        </StaggerContainer>

        {/* Review Modal (Docente) */}
        <AnimatePresence>
          {reviewItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top)+1rem)]"
              onClick={() => setReviewItem(null)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gray-900 border border-brand-gold rounded-3xl p-8 max-w-lg w-full"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">
                    Revisar Material
                  </h2>
                  <button
                    onClick={() => setReviewItem(null)}
                    className="p-2 rounded-full border border-gray-700 text-gray-400 hover:border-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 bg-brand-black/60 rounded-2xl mb-4">
                  <h3 className="font-bold text-white mb-1">
                    {reviewItem.title}
                  </h3>
                  {reviewItem.subject && (
                    <p className="text-sm text-brand-gold mb-1">
                      Materia: {reviewItem.subject}
                    </p>
                  )}
                  {reviewItem.description && (
                    <p className="text-sm text-gray-300 mb-2">
                      {reviewItem.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Por: {reviewItem.profiles?.full_name} (@
                    {reviewItem.profiles?.username})
                  </p>
                </div>
                <a
                  href={reviewItem.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 mb-4 border border-brand-gold/50 text-brand-gold rounded-xl text-sm font-medium hover:bg-brand-gold/10 transition-all flex items-center justify-center gap-2"
                >
                  <ChevronRight className="w-4 h-4" /> Abrir y revisar el
                  archivo
                </a>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleReject(reviewItem)}
                    className="flex-1 py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" /> Rechazar
                  </button>
                  <button
                    onClick={() => handleApprove(reviewItem)}
                    className="flex-1 py-2.5 bg-green-500/10 text-green-400 border border-green-500/30 rounded-xl font-bold hover:bg-green-500 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Aprobar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share Modal */}
        <AnimatePresence>
          {showShareModal && sharingItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top)+1rem)]"
              onClick={() => setShowShareModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-brand-black border border-brand-gold rounded-3xl p-8 max-w-md w-full max-h-[80vh] flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-brand-gold" /> Compartir en
                    Chat
                  </h2>
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="text-gray-400 hover:text-brand-gold"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-3 bg-gray-900 rounded-xl mb-4 border border-gray-800">
                  <p className="text-sm text-white font-bold truncate">
                    {sharingItem.title}
                  </p>
                </div>
                <h3 className="text-sm text-gray-400 mb-2 font-semibold">
                  Tus Chats:
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {userRooms.length === 0 ? (
                    <p className="text-gray-500 text-center text-sm py-4">
                      No tienes chats activos.
                    </p>
                  ) : (
                    userRooms.map((room) => (
                      <button
                        key={room.id}
                        onClick={() => confirmShareToRoom(room.id)}
                        disabled={sharingToRooms}
                        className="w-full text-left p-3 bg-black/40 border border-gray-800 rounded-xl hover:border-brand-gold flex items-center justify-between group disabled:opacity-50 transition-colors"
                      >
                        <span className="text-white text-sm font-medium pr-2 truncate">
                          {room.type === "group"
                            ? room.name
                            : room.participants_profiles?.filter(
                                (p: any) => p.id !== currentUserId,
                              )[0]?.full_name || "Chat Privado"}
                        </span>
                        <Send className="w-4 h-4 text-gray-600 group-hover:text-brand-gold shrink-0 transition-colors" />
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top)+1rem)]"
              onClick={() => setShowModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-brand-black border border-brand-gold rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    Subir Aporte
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mb-4 p-3 bg-brand-gold/10 border border-brand-gold/30 rounded-2xl text-sm text-gray-300">
                  ℹ️ Tu aporte será revisado por el docente que selecciones
                  antes de publicarse.
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Título *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-black/40 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold"
                      placeholder="Ej: Resumen de Álgebra Cap. 1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Descripción
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-black/40 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold resize-none"
                      placeholder="Breve descripción del material..."
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Materia
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData({ ...formData, subject: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-black/40 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold"
                      placeholder="Matemáticas, Historia, ..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Docente Revisor *{" "}
                      <span className="text-brand-gold text-xs">
                        (Obligatorio)
                      </span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        value={formData.reviewer_username}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            reviewer_username: e.target.value,
                          })
                        }
                        className="w-full pl-10 pr-4 py-3 bg-black/40 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold"
                        placeholder="@usuario_del_docente"
                        required
                      />
                    </div>
                    {docentes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {docentes.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                reviewer_username: d.username || "",
                              })
                            }
                            className="px-3 py-1 text-xs bg-gray-800 text-gray-300 rounded-full hover:bg-brand-gold hover:text-black transition-all border border-gray-700"
                          >
                            @{d.username} ({d.full_name})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Archivo *{" "}
                      <span className="text-xs text-gray-500">
                        (No se permiten audios)
                      </span>
                    </label>

                    {/* Preview Area */}
                    {formData.file && (
                      <div className="mb-4">
                        <p className="text-sm text-brand-gold mb-2">
                          Vista Previa:
                        </p>
                        {formData.file.type.startsWith("image/") ? (
                          <img
                            src={URL.createObjectURL(formData.file)}
                            alt="Preview"
                            className="w-full h-40 object-cover rounded-xl border border-gray-700"
                          />
                        ) : formData.file.type.startsWith("video/") ? (
                          <video
                            src={URL.createObjectURL(formData.file)}
                            controls
                            className="w-full h-40 object-cover rounded-xl border border-gray-700 bg-black"
                          />
                        ) : (
                          <div className="w-full h-24 bg-gray-800 rounded-xl flex items-center justify-center border border-gray-700 text-gray-400">
                            <div className="flex items-center gap-3">
                              <FileText className="w-8 h-8 text-brand-gold" />
                              <span className="text-sm font-semibold truncate max-w-xs">
                                {formData.file.name}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <input
                      type="file"
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          file: e.target.files?.[0] || null,
                        })
                      }
                      className="w-full px-4 py-3 bg-black/40 border border-gray-700 rounded-2xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-gold file:text-brand-black hover:file:bg-white focus:outline-none focus:border-brand-gold"
                      accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.mp4,.webm,.png,.jpg,.jpeg,.gif"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Formatos: PDF, DOC, DOCX, TXT, PPT, MP4, WEBM, PNG, JPG.
                      No se permiten audios.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={
                      uploading ||
                      !formData.file ||
                      !formData.title ||
                      !formData.reviewer_username
                    }
                    className="w-full py-3 bg-brand-gold text-brand-black font-bold rounded-full hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Subiendo...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" /> Enviar para Revisión
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
