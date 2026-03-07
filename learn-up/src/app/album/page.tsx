"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Image as ImageIcon,
  Video,
  Download,
  Trash2,
  Play,
  Eye,
  Loader2,
  Upload,
} from "lucide-react";
import BackButton from "@/components/BackButton";

type MediaFile = {
  id: string;
  file_url: string;
  file_type: "photo" | "video" | "audio" | "document";
  source?: string;
  title?: string;
  created_at: string;
};

type ActiveTab = "camara" | "recuerdos";

export default function AlbumPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("recuerdos");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null,
  );
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  const [uploading, setUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadMedia();
    return () => {
      if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const loadMedia = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_media")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setMediaFiles(data as MediaFile[]);
    } catch (err) {
      console.error("Error loading media:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (capturing && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [capturing, cameraStream]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: cameraMode === "video",
      });
      setCameraStream(stream);
      setCapturing(true);
    } catch (err) {
      alert(
        "No se pudo acceder a la cámara. Verifica los permisos del navegador.",
      );
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStream(null);
    setCapturing(false);
    setIsRecording(false);
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraStream) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        await uploadMedia(
          blob,
          "photo",
          `foto-${Date.now()}.jpg`,
          "image/jpeg",
        );
      },
      "image/jpeg",
      0.9,
    );
  };

  const startRecording = () => {
    if (!cameraStream) return;
    const chunks: BlobPart[] = [];
    const options = { mimeType: "video/webm;codecs=vp8,opus" };

    // Check for browser support
    const recorder = MediaRecorder.isTypeSupported(options.mimeType)
      ? new MediaRecorder(cameraStream, options)
      : new MediaRecorder(cameraStream);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      await uploadMedia(
        blob,
        "video",
        `video-${Date.now()}.webm`,
        "video/webm",
      );
    };
    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
  };

  const uploadMedia = async (
    blob: Blob,
    fileType: MediaFile["file_type"],
    filename: string,
    mimeType: string,
  ) => {
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const filePath = `${user.id}/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from("user-media")
        .upload(filePath, blob, { contentType: mimeType });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("user-media").getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("user_media").insert({
        user_id: user.id,
        file_url: publicUrl,
        file_type: fileType,
        source: "camera",
        title: filename,
      });
      if (dbError) throw dbError;

      await loadMedia();
      stopCamera();
      setActiveTab("recuerdos");
    } catch (err) {
      console.error("Error uploading:", err);
      alert("Error al guardar el archivo");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileType = file.type.startsWith("image")
      ? "photo"
      : file.type.startsWith("video")
        ? "video"
        : file.type.startsWith("audio")
          ? "audio"
          : "document";
    await uploadMedia(file, fileType, file.name, file.type);
  };

  const downloadMedia = async (media: MediaFile) => {
    const res = await fetch(media.file_url);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = media.title || "archivo";
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteMedia = async (id: string) => {
    if (!confirm("¿Eliminar este archivo de tus recuerdos?")) return;
    await supabase.from("user_media").delete().eq("id", id);
    setMediaFiles((f) => f.filter((m) => m.id !== id));
  };

  const getFileIcon = (type: string) => {
    if (type === "photo")
      return <ImageIcon className="w-6 h-6 text-emerald-400" />;
    if (type === "video") return <Video className="w-6 h-6 text-blue-400" />;
    return <Download className="w-6 h-6 text-gray-400" />;
  };

  return (
    <div className="min-h-screen bg-brand-black p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <BackButton className="mb-6" />

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Camera className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">
                Álbum del Saber
              </h1>
              <p className="text-gray-400 text-sm">
                Tu cámara y galería de recuerdos educativos
              </p>
            </div>
          </div>
          <label className="px-5 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-full hover:border-emerald-500 hover:text-emerald-400 transition-all flex items-center gap-2 cursor-pointer text-sm">
            <Upload className="w-4 h-4" /> Subir archivo
            <input
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-gray-900 rounded-2xl mb-8 w-fit">
          <button
            onClick={() => {
              setActiveTab("camara");
              startCamera();
            }}
            className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === "camara" ? "bg-emerald-500 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
          >
            <Camera className="w-4 h-4" /> Cámara
          </button>
          <button
            onClick={() => {
              setActiveTab("recuerdos");
              stopCamera();
            }}
            className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === "recuerdos" ? "bg-emerald-500 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
          >
            <ImageIcon className="w-4 h-4" /> Recuerdos ({mediaFiles.length})
          </button>
        </div>

        {/* CAMERA TAB */}
        {activeTab === "camara" && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setCameraMode("photo")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${cameraMode === "photo" ? "bg-emerald-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                📷 Foto
              </button>
              <button
                onClick={() => setCameraMode("video")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${cameraMode === "video" ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                🎥 Video
              </button>
            </div>

            {capturing ? (
              <div className="space-y-4">
                <div className="relative bg-black rounded-3xl overflow-hidden aspect-4/3 md:aspect-video shadow-2xl shadow-emerald-900/20 border border-emerald-500/20 group">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Grid Overlay for 'Dark Room' feel */}
                  <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-30">
                    <div className="border-r border-b border-white/20" />
                    <div className="border-r border-b border-white/20" />
                    <div className="border-b border-white/20" />
                    <div className="border-r border-b border-white/20" />
                    <div className="border-r border-b border-white/20" />
                    <div className="border-b border-white/20" />
                    <div className="border-r border-white/20" />
                    <div className="border-r border-white/20" />
                    <div />
                  </div>

                  {/* Corner brackets */}
                  <div className="absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-emerald-500/50 pointer-events-none" />
                  <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-emerald-500/50 pointer-events-none" />
                  <div className="absolute bottom-24 left-8 w-8 h-8 border-b-2 border-l-2 border-emerald-500/50 pointer-events-none" />
                  <div className="absolute bottom-24 right-8 w-8 h-8 border-b-2 border-r-2 border-emerald-500/50 pointer-events-none" />

                  {isRecording && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 bg-black/50 backdrop-blur-md rounded-full text-white text-sm font-bold border border-red-500/50 shadow-lg shadow-red-500/20 mt-4 md:mt-0 md:top-6 md:left-6 md:translate-x-0">
                      <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]" />{" "}
                      REC
                    </div>
                  )}

                  {/* Camera Controls Overlay */}
                  <div className="absolute bottom-0 inset-x-0 p-6 bg-linear-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center gap-4">
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex gap-4 items-center justify-center w-full max-w-md mx-auto">
                      {cameraMode === "photo" ? (
                        <button
                          onClick={takePhoto}
                          disabled={uploading}
                          className="w-16 h-16 rounded-full bg-white border-4 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                        >
                          <div className="w-12 h-12 rounded-full border-2 border-black" />
                        </button>
                      ) : isRecording ? (
                        <button
                          onClick={stopRecording}
                          className="w-16 h-16 rounded-full bg-black border-4 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all animate-pulse"
                        >
                          <div className="w-6 h-6 bg-red-500 rounded-sm" />
                        </button>
                      ) : (
                        <button
                          onClick={startRecording}
                          className="w-16 h-16 rounded-full bg-white border-4 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                        >
                          <div className="w-4 h-4 rounded-full bg-red-500" />
                        </button>
                      )}
                    </div>
                  </div>

                  {uploading && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                      <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                      <p className="text-emerald-400 font-bold animate-pulse tracking-widest text-sm">
                        REVELANDO...
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex justify-center mt-2">
                  <button
                    onClick={stopCamera}
                    className="px-6 py-2 border border-gray-700 text-gray-400 rounded-full hover:bg-white/5 transition-all text-sm"
                  >
                    Apagar Cámara
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="text-center py-16 border-2 border-dashed border-gray-700 rounded-3xl hover:border-emerald-500/40 transition-all cursor-pointer"
                onClick={startCamera}
              >
                <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                  Activar Cámara
                </h3>
                <p className="text-gray-500 text-sm">
                  Haz clic para abrir la cámara y tomar fotos o grabar videos
                </p>
                <p className="text-gray-600 text-xs mt-2">
                  Se pedirán permisos de cámara/micrófono
                </p>
              </div>
            )}
          </div>
        )}

        {/* RECUERDOS TAB */}
        {activeTab === "recuerdos" && (
          <div>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
            ) : mediaFiles.length === 0 ? (
              <div className="text-center py-16">
                <ImageIcon className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-400 mb-2">
                  Sin recuerdos aún
                </h3>
                <p className="text-gray-500 text-sm">
                  Las fotos, videos y archivos que descargues o tomes aparecerán
                  aquí.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {mediaFiles.map((media) => (
                  <motion.div
                    key={media.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden hover:border-emerald-500/40 transition-all group"
                  >
                    <div
                      className="aspect-square bg-black/40 flex items-center justify-center relative cursor-pointer"
                      onClick={() => setSelectedMedia(media)}
                    >
                      {media.file_type === "photo" ? (
                        <img
                          src={media.file_url}
                          className="w-full h-full object-cover"
                          alt={media.title}
                        />
                      ) : media.file_type === "video" ? (
                        <div className="flex flex-col items-center gap-2">
                          <Play className="w-10 h-10 text-blue-400" />
                          <span className="text-xs text-gray-400">Video</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          {getFileIcon(media.file_type)}
                          <span className="text-xs text-gray-500 text-center px-2 truncate w-full">
                            {media.title}
                          </span>
                        </div>
                      )}
                      {media.source && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 text-gray-400 text-[10px] rounded-full capitalize">
                          {media.source}
                        </span>
                      )}
                    </div>
                    <div className="p-2 flex gap-1">
                      <button
                        onClick={() => downloadMedia(media)}
                        className="flex-1 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-all flex items-center justify-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Descargar
                      </button>
                      <button
                        onClick={() => deleteMedia(media.id)}
                        className="p-1.5 text-gray-600 hover:text-red-400 bg-gray-800 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Media Preview Modal */}
        <AnimatePresence>
          {selectedMedia && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedMedia(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="max-w-5xl w-full relative"
              >
                {selectedMedia.file_type === "photo" && (
                  <img
                    src={selectedMedia.file_url}
                    className="rounded-2xl max-h-[80vh] object-contain mx-auto"
                    alt="Recuerdo"
                  />
                )}
                {selectedMedia.file_type === "video" && (
                  <video
                    src={selectedMedia.file_url}
                    controls
                    className="rounded-2xl w-full max-h-[80vh]"
                  />
                )}
                <div className="mt-4 flex gap-3 justify-center">
                  <button
                    onClick={() => downloadMedia(selectedMedia)}
                    className="px-6 py-2.5 bg-emerald-500 text-white font-bold rounded-full hover:bg-emerald-400 transition-all flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Descargar
                  </button>
                  <button
                    onClick={() => setSelectedMedia(null)}
                    className="px-6 py-2.5 border border-gray-700 text-gray-400 rounded-full hover:bg-white/5 transition-all"
                  >
                    Cerrar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
