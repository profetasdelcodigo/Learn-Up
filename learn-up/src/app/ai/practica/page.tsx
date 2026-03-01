"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Loader2,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Upload,
  FileText,
  Clock,
  Star,
  AlertCircle,
  Bot,
  Menu,
  PlusCircle,
  Trash2,
  X,
} from "lucide-react";
import { generateRealExam, gradeExam, ExamData } from "@/actions/ai-tutor";
import BackButton from "@/components/BackButton";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  getAiSessions,
  deleteAiSession,
  createAiSession,
} from "@/actions/ai-history";

type Phase = "setup" | "taking" | "grading" | "results" | "review";

export default function ExamenIAPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<
    "básico" | "intermedio" | "avanzado"
  >("intermedio");
  const [exam, setExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gradingResult, setGradingResult] = useState<{
    feedback: string;
    score: number;
    maxScore: number;
  } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const [sessions, setSessions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const data = await getAiSessions("exam");
    setSessions(data);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteAiSession(id);
    loadSessions();
    router.refresh();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
  };

  const getMediaType = (file: File) => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  };

  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError("");
    setExam(null);
    setAnswers({});

    try {
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      if (file) {
        mediaType = getMediaType(file);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const filePath = `${user.id}/${Date.now()}_${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from("ai_media")
            .upload(filePath, file);
          if (!uploadErr) {
            const { data } = supabase.storage
              .from("ai_media")
              .getPublicUrl(filePath);
            mediaUrl = data.publicUrl;
          }
        }
      }

      const result = await generateRealExam(
        topic.trim(),
        difficulty,
        undefined, // context
        mediaUrl,
        mediaType,
      );
      if (result.error) {
        setError(result.error);
      } else if (result.exam) {
        setExam(result.exam);
        setPhase("taking");
      }
    } catch {
      setError("Error inesperado. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    try {
      setLoading(true);
      const { getAiMessages } = await import("@/actions/ai-history");
      const msgs = await getAiMessages(sessionId);
      if (msgs && msgs.length > 0) {
        const payload = JSON.parse(msgs[0].content);
        setExam(payload.exam);
        setAnswers(payload.answers || {});
        setGradingResult(payload.gradingResult || null);
        setPhase("results");
        setShowHistory(false);
      }
    } catch (err) {
      console.error("Error loading session:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitExam = async () => {
    if (!exam) return;
    setLoading(true);
    setPhase("grading");
    try {
      const result = await gradeExam(exam, answers);
      setGradingResult(result);
      setPhase("results");

      // Save the exam result into history
      const { session } = await createAiSession(
        "exam",
        `${exam.topic} - Nota: ${result.score}/${result.maxScore}`,
      );

      if (session) {
        const { addAiMessage } = await import("@/actions/ai-history");
        await addAiMessage(
          session.id,
          "assistant",
          JSON.stringify({
            exam,
            answers,
            gradingResult: result,
          }),
        );
      }

      loadSessions(); // Reload sessions to show the newly saved exam
      router.refresh(); // Refresh Next.js server components if needed
    } catch {
      setError("Error al calificar. Por favor intenta de nuevo.");
      setPhase("taking");
    } finally {
      setLoading(false);
    }
  };

  const resetExam = () => {
    setPhase("setup");
    setExam(null);
    setAnswers({});
    setGradingResult(null);
    setError("");
    setTopic("");
    setFile(null);
  };

  const getAnswerKey = (sectionTitle: string, qIndex: number) =>
    `${sectionTitle}-${qIndex}`;

  const allAnswered = exam
    ? exam.sections.every((section) =>
        section.questions.every(
          (_, i) => answers[getAnswerKey(section.title, i)] !== undefined,
        ),
      )
    : false;

  return (
    <div className="min-h-screen bg-brand-black flex flex-col md:flex-row">
      {/* Sidebar History (Desktop) */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 transform ${showHistory ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-brand-blue-glow" /> Historial
          </h3>
          <button
            className="md:hidden text-gray-400"
            onClick={() => setShowHistory(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <button
            onClick={resetExam}
            className="w-full py-2.5 bg-brand-blue-glow/10 text-brand-blue-glow border border-brand-blue-glow/30 rounded-xl hover:bg-brand-blue-glow hover:text-white transition-all flex items-center justify-center gap-2 mb-4 font-semibold text-sm"
          >
            <PlusCircle className="w-4 h-4" /> Nuevo Examen
          </button>
          <div className="space-y-2 max-h-[calc(100vh-140px)] overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4">
                No hay exámenes previos
              </p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => loadSessionDetails(s.id)}
                  className={`p-3 rounded-xl cursor-pointer flex justify-between items-center group transition-colors hover:bg-gray-800/50`}
                >
                  <div className="truncate pr-2">
                    <p className="text-sm text-white truncate font-medium">
                      {s.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(s.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-y-auto relative p-4 md:p-8">
        <div className="max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-4 mb-6">
            <button
              className="md:hidden text-gray-400 hover:text-white"
              onClick={() => setShowHistory(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <BackButton />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-brand-blue-glow/10 border border-brand-blue-glow">
              <GraduationCap className="w-8 h-8 text-brand-blue-glow" />
            </div>
            <h1 className="text-4xl font-black text-white mb-2">Examen IA</h1>
            <p className="text-gray-400">
              Exámenes reales con preguntas abiertas, opción múltiple, análisis
              y más. Evaluados por IA.
            </p>
          </div>

          {/* SETUP PHASE */}
          {phase === "setup" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900/80 border border-brand-blue-glow/40 rounded-3xl p-8"
            >
              <form onSubmit={handleGenerateExam} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    ¿Sobre qué tema quieres ser examinado?
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ej: Segunda Guerra Mundial, Álgebra Lineal, Ecosistemas..."
                    className="w-full px-4 py-3 bg-black/40 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue-glow transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Nivel de dificultad
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["básico", "intermedio", "avanzado"] as const).map(
                      (level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setDifficulty(level)}
                          className={`py-3 px-4 rounded-2xl font-semibold text-sm transition-all ${difficulty === level ? "bg-brand-blue-glow text-white shadow-lg shadow-brand-blue-glow/20" : "bg-black/40 border border-gray-700 text-gray-400 hover:border-brand-blue-glow/50"}`}
                        >
                          {level === "básico"
                            ? "🟢 Básico"
                            : level === "intermedio"
                              ? "🟡 Intermedio"
                              : "🔴 Avanzado"}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Subir material de referencia{" "}
                    <span className="text-gray-500 font-normal">
                      (Opcional — PDF, DOC, IMG)
                    </span>
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all text-center ${file ? "border-brand-blue-glow/50 bg-brand-blue-glow/5" : "border-gray-700 hover:border-brand-blue-glow/40 hover:bg-brand-blue-glow/5"}`}
                  >
                    {file ? (
                      <div className="flex items-center justify-center gap-2 text-brand-blue-glow">
                        <FileText className="w-5 h-5" />
                        <span className="text-sm font-medium">{file.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            if (fileInputRef.current)
                              fileInputRef.current.value = "";
                          }}
                          className="text-gray-400 hover:text-red-400 p-1"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        <Upload className="w-5 h-5" />
                        <span className="text-sm">
                          Click para subir archivo
                        </span>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.txt,.png,.jpg,.jpeg"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{" "}
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !topic.trim()}
                  className="w-full py-4 bg-brand-blue-glow text-white font-bold rounded-full hover:bg-brand-blue-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Generando tu
                      examen...
                    </>
                  ) : (
                    <>
                      <GraduationCap className="w-5 h-5" /> Generar Examen Real
                    </>
                  )}
                </button>
                {loading && (
                  <p className="text-center text-gray-500 text-sm">
                    La IA está formulando las preguntas. Esto puede tomar unos
                    segundos... ⏳
                  </p>
                )}
              </form>
            </motion.div>
          )}

          {/* TAKING EXAM PHASE */}
          {(phase === "taking" || phase === "review") && exam && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Exam Header */}
              <div className="bg-gray-900/80 border border-brand-blue-glow/30 rounded-3xl p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {exam.title}
                    </h2>
                    <p className="text-gray-400 text-sm">
                      {exam.topic} · Dificultad: {exam.difficulty}
                    </p>
                    {phase === "review" && (
                      <span className="inline-block mt-2 px-3 py-1 bg-brand-gold/20 text-brand-gold text-xs font-bold rounded-full border border-brand-gold/30">
                        MODO REVISIÓN
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-center">
                    <div className="px-4 py-2 bg-black/40 rounded-xl">
                      <p className="text-brand-gold font-bold text-lg">
                        {exam.totalPoints}
                      </p>
                      <p className="text-gray-500 text-xs">puntos</p>
                    </div>
                    <div className="px-4 py-2 bg-black/40 rounded-xl">
                      <div className="flex items-center gap-1 text-brand-gold font-bold text-lg">
                        <Clock className="w-4 h-4" />
                        {exam.timeMinutes}
                      </div>
                      <p className="text-gray-500 text-xs">minutos</p>
                    </div>
                  </div>
                </div>
                {exam.instructions && (
                  <div className="mt-4 p-3 bg-brand-blue-glow/10 border border-brand-blue-glow/20 rounded-xl text-sm text-gray-300">
                    📋 <strong>Instrucciones:</strong> {exam.instructions}
                  </div>
                )}
              </div>

              {/* Sections and Questions */}
              {exam.sections.map((section, sIdx) => (
                <div
                  key={sIdx}
                  className="bg-gray-900/80 border border-gray-800 rounded-3xl p-6 space-y-6"
                >
                  <h3 className="text-lg font-bold text-brand-blue-glow border-b border-gray-800 pb-3">
                    {section.title}
                  </h3>
                  {section.questions.map((q, qIdx) => {
                    const answerKey = getAnswerKey(section.title, qIdx);
                    const currentAnswer = answers[answerKey];
                    const isReview = phase === "review";

                    return (
                      <div key={qIdx} className="space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-blue-glow/10 border border-brand-blue-glow/30 flex items-center justify-center text-brand-blue-glow text-xs font-bold">
                            {qIdx + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-white font-medium leading-relaxed">
                              {q.question}
                            </p>
                            <span className="text-xs text-gray-500 mt-1 inline-block">
                              {q.points} pt{q.points !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>

                        {/* Multiple Choice */}
                        {(q.type === "multiple_choice" ||
                          q.type === "true_false") &&
                          q.options && (
                            <div className="ml-10 space-y-2">
                              {q.options.map((opt, optIdx) => {
                                let btnColor =
                                  "bg-black/20 border-gray-700 text-gray-300 hover:border-brand-blue-glow/40";
                                if (currentAnswer === optIdx)
                                  btnColor =
                                    "bg-brand-blue-glow/20 border-brand-blue-glow text-white font-medium";

                                if (isReview) {
                                  // Highlight correct and wrong answers in review mode
                                  if (q.correctAnswer === optIdx) {
                                    btnColor =
                                      "bg-green-500/20 border-green-500 text-green-300 font-bold";
                                  } else if (currentAnswer === optIdx) {
                                    btnColor =
                                      "bg-red-500/20 border-red-500 text-red-300 font-bold line-through";
                                  } else {
                                    btnColor =
                                      "bg-black/20 border-gray-800 text-gray-600";
                                  }
                                }

                                return (
                                  <button
                                    key={optIdx}
                                    disabled={isReview}
                                    onClick={() =>
                                      setAnswers({
                                        ...answers,
                                        [answerKey]: optIdx,
                                      })
                                    }
                                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${btnColor} ${isReview ? "cursor-default" : ""}`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                        {/* Open Question */}
                        {q.type === "open" && (
                          <div className="ml-10">
                            <textarea
                              value={(currentAnswer as string) || ""}
                              onChange={(e) =>
                                setAnswers({
                                  ...answers,
                                  [answerKey]: e.target.value,
                                })
                              }
                              disabled={isReview}
                              placeholder="Escribe tu respuesta aquí..."
                              className="w-[calc(100%-2.5rem)] px-4 py-3 bg-black/40 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue-glow transition-colors resize-none disabled:opacity-75 disabled:cursor-not-allowed"
                              rows={4}
                            />
                            {isReview && q.correctAnswer && (
                              <div className="mt-2 p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-sm">
                                <span className="text-gray-400 font-semibold block mb-1">
                                  Respuesta Esperada:
                                </span>
                                <span className="text-white whitespace-pre-wrap">
                                  {q.correctAnswer}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Fill in the Blank */}
                        {q.type === "fill_blank" && (
                          <div className="ml-10">
                            <input
                              type="text"
                              value={(currentAnswer as string) || ""}
                              onChange={(e) =>
                                setAnswers({
                                  ...answers,
                                  [answerKey]: e.target.value,
                                })
                              }
                              disabled={isReview}
                              placeholder="Completa el espacio..."
                              className="px-4 py-2.5 bg-black/40 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue-glow transition-colors w-64 disabled:opacity-75 disabled:cursor-not-allowed"
                            />
                            {isReview && q.correctAnswer && (
                              <div className="mt-2 text-sm text-gray-400">
                                <span className="font-semibold">
                                  Respuesta Correcta:
                                </span>{" "}
                                <span className="text-green-400 font-bold">
                                  {q.correctAnswer}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="flex gap-3">
                {phase === "review" ? (
                  <button
                    onClick={() => setPhase("results")}
                    className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-full hover:bg-gray-700 border border-gray-700 transition-all flex items-center justify-center gap-2"
                  >
                    Volver a Resultados
                  </button>
                ) : (
                  <>
                    <button
                      onClick={resetExam}
                      className="px-6 py-3 border border-gray-700 text-gray-400 rounded-full hover:bg-white/5 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmitExam}
                      disabled={!allAnswered || loading}
                      className="flex-1 py-3 bg-brand-blue-glow text-white font-bold rounded-full hover:bg-brand-blue-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                      {allAnswered
                        ? "Entregar Examen"
                        : "Responde todas las preguntas para entregar"}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* GRADING PHASE */}
          {phase === "grading" && (
            <div className="text-center py-16">
              <Loader2 className="w-16 h-16 text-brand-blue-glow animate-spin mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">
                La IA está corrigiendo tu examen...
              </h3>
              <p className="text-gray-400">
                Analizando tus respuestas y preparando retroalimentación
                detallada
              </p>
            </div>
          )}

          {/* RESULTS PHASE */}
          {phase === "results" && gradingResult && exam && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="bg-gray-900/80 border border-brand-blue-glow rounded-3xl p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-2xl bg-brand-blue-glow/20 border-2 border-brand-blue-glow">
                  <Star className="w-10 h-10 text-brand-blue-glow" />
                </div>
                <h2 className="text-3xl font-black text-white mb-2">
                  ¡Examen Completado!
                </h2>
                <div className="text-6xl font-black text-brand-blue-glow my-4">
                  {gradingResult.score}
                  <span className="text-3xl text-gray-500">
                    /{gradingResult.maxScore}
                  </span>
                </div>
                <p className="text-gray-400 text-lg">
                  puntos en respuestas objetivas
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Las preguntas abiertas se evalúan en la retroalimentación
                  detallada
                </p>
              </div>

              <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-brand-blue-glow" />{" "}
                  Retroalimentación del Profesor IA
                </h3>
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {gradingResult.feedback}
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <button
                  onClick={() => setPhase("review")}
                  className="w-full md:flex-1 py-3 bg-gray-800 text-white font-bold rounded-full hover:bg-gray-700 border border-gray-700 transition-all flex items-center justify-center gap-2"
                >
                  <FileText className="w-5 h-5" /> Ver Mis Respuestas
                </button>
                <button
                  onClick={resetExam}
                  className="w-full md:flex-1 py-3 bg-brand-blue-glow text-white font-bold rounded-full hover:bg-brand-blue-glow transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" /> Hacer Otro Examen
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
