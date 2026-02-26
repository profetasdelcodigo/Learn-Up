"use client";

import { useState, useRef } from "react";
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
} from "lucide-react";
import { generateRealExam, gradeExam, ExamData } from "@/actions/ai-tutor";
import BackButton from "@/components/BackButton";

type Phase = "setup" | "taking" | "grading" | "results";

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
  const [uploadedFileContent, setUploadedFileContent] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const text = await file.text();
    setUploadedFileContent(text.slice(0, 3000)); // Limit context
  };

  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError("");
    setExam(null);
    setAnswers({});
    try {
      const result = await generateRealExam(
        topic.trim(),
        difficulty,
        uploadedFileContent || undefined,
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

  const handleSubmitExam = async () => {
    if (!exam) return;
    setLoading(true);
    setPhase("grading");
    try {
      const result = await gradeExam(exam, answers);
      setGradingResult(result);
      setPhase("results");
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
    setUploadedFileContent("");
    setUploadedFileName("");
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
    <div className="min-h-screen bg-brand-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <BackButton className="mb-6" />

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-purple-500/10 border border-purple-500">
            <GraduationCap className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-4xl font-black text-white mb-2">Examen IA</h1>
          <p className="text-gray-400">
            Exámenes reales con preguntas abiertas, opción múltiple, análisis y
            más. Evaluados por IA.
          </p>
        </div>

        {/* SETUP PHASE */}
        {phase === "setup" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/80 border border-purple-500/40 rounded-3xl p-8"
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
                  className="w-full px-4 py-3 bg-black/40 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
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
                        className={`py-3 px-4 rounded-2xl font-semibold text-sm transition-all ${difficulty === level ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20" : "bg-black/40 border border-gray-700 text-gray-400 hover:border-purple-500/50"}`}
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
                    (Opcional — la IA creará el examen basado en tu material)
                  </span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all text-center ${uploadedFileName ? "border-purple-500/50 bg-purple-500/5" : "border-gray-700 hover:border-purple-500/40 hover:bg-purple-500/5"}`}
                >
                  {uploadedFileName ? (
                    <div className="flex items-center justify-center gap-2 text-purple-400">
                      <FileText className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        {uploadedFileName}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFileName("");
                          setUploadedFileContent("");
                        }}
                        className="ml-2 text-gray-500 hover:text-red-400 text-xs"
                      >
                        ✕ Quitar
                      </button>
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        Arrastra o haz clic para subir un archivo de texto, PDF,
                        etc.
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.doc,.docx,.md"
                  className="hidden"
                  onChange={handleFileUpload}
                />
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
                className="w-full py-4 bg-purple-500 text-white font-bold rounded-full hover:bg-purple-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
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
        {phase === "taking" && exam && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Exam Header */}
            <div className="bg-gray-900/80 border border-purple-500/30 rounded-3xl p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {exam.title}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {exam.topic} · Dificultad: {exam.difficulty}
                  </p>
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
                <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-sm text-gray-300">
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
                <h3 className="text-lg font-bold text-purple-400 border-b border-gray-800 pb-3">
                  {section.title}
                </h3>
                {section.questions.map((q, qIdx) => {
                  const answerKey = getAnswerKey(section.title, qIdx);
                  const currentAnswer = answers[answerKey];
                  return (
                    <div key={qIdx} className="space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold">
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
                            {q.options.map((opt, optIdx) => (
                              <button
                                key={optIdx}
                                onClick={() =>
                                  setAnswers({
                                    ...answers,
                                    [answerKey]: optIdx,
                                  })
                                }
                                className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${currentAnswer === optIdx ? "bg-purple-500/20 border-purple-500 text-white font-medium" : "bg-black/20 border-gray-700 text-gray-300 hover:border-purple-500/40"}`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}

                      {/* Open Question */}
                      {q.type === "open" && (
                        <textarea
                          value={(currentAnswer as string) || ""}
                          onChange={(e) =>
                            setAnswers({
                              ...answers,
                              [answerKey]: e.target.value,
                            })
                          }
                          placeholder="Escribe tu respuesta aquí..."
                          className="ml-10 w-[calc(100%-2.5rem)] px-4 py-3 bg-black/40 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                          rows={4}
                        />
                      )}

                      {/* Fill in the Blank */}
                      {q.type === "fill_blank" && (
                        <input
                          type="text"
                          value={(currentAnswer as string) || ""}
                          onChange={(e) =>
                            setAnswers({
                              ...answers,
                              [answerKey]: e.target.value,
                            })
                          }
                          placeholder="Completa el espacio..."
                          className="ml-10 px-4 py-2.5 bg-black/40 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors w-64"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="flex gap-3">
              <button
                onClick={resetExam}
                className="px-6 py-3 border border-gray-700 text-gray-400 rounded-full hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitExam}
                disabled={!allAnswered || loading}
                className="flex-1 py-3 bg-purple-500 text-white font-bold rounded-full hover:bg-purple-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
            </div>
          </motion.div>
        )}

        {/* GRADING PHASE */}
        {phase === "grading" && (
          <div className="text-center py-16">
            <Loader2 className="w-16 h-16 text-purple-400 animate-spin mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">
              La IA está corrigiendo tu examen...
            </h3>
            <p className="text-gray-400">
              Analizando tus respuestas y preparando retroalimentación detallada
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
            <div className="bg-gray-900/80 border border-purple-500 rounded-3xl p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-2xl bg-purple-500/20 border-2 border-purple-500">
                <Star className="w-10 h-10 text-purple-400" />
              </div>
              <h2 className="text-3xl font-black text-white mb-2">
                ¡Examen Completado!
              </h2>
              <div className="text-6xl font-black text-purple-400 my-4">
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
                <GraduationCap className="w-5 h-5 text-purple-400" />{" "}
                Retroalimentación del Profesor IA
              </h3>
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {gradingResult.feedback}
                </p>
              </div>
            </div>

            <button
              onClick={resetExam}
              className="w-full py-3 bg-purple-500 text-white font-bold rounded-full hover:bg-purple-400 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" /> Nuevo Examen
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
