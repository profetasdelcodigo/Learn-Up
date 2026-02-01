"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Loader2, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { generateQuiz, Quiz, QuizQuestion } from "@/actions/ai-tutor";

export default function PracticePage() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"fácil" | "medio" | "difícil">(
    "medio",
  );
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;

    setLoading(true);
    setError("");
    setQuiz(null);
    setCurrentQuestion(0);
    setScore(0);

    try {
      const result = await generateQuiz(topic.trim(), difficulty);

      if (result.error) {
        setError(result.error);
      } else if (result.quiz) {
        setQuiz(result.quiz);
      }
    } catch (err) {
      setError("Ocurrió un error inesperado. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (optionIndex: number) => {
    if (showResult || !quiz) return;

    setSelectedAnswer(optionIndex);

    const isCorrect =
      quiz.questions[currentQuestion].correctAnswer === optionIndex;
    if (isCorrect) {
      setScore(score + 1);
    }

    setTimeout(() => {
      if (currentQuestion < quiz.questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedAnswer(null);
      } else {
        setShowResult(true);
      }
    }, 1500);
  };

  const handleRestart = () => {
    setQuiz(null);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setTopic("");
  };

  const currentQ = quiz?.questions[currentQuestion];

  return (
    <div className="min-h-screen bg-brand-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-purple-500/10 border border-purple-500">
            <Brain className="w-8 h-8 text-purple-500" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Modo Práctica</h1>
          <p className="text-gray-400">
            Genera quizzes personalizados para poner a prueba tus conocimientos
          </p>
        </div>

        {/* Quiz Generator Form */}
        {!quiz && !showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-brand-black/80 backdrop-blur-xl border border-purple-500 rounded-3xl p-8"
          >
            <form onSubmit={handleGenerateQuiz} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ¿Sobre qué tema quieres practicar?
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ej: Matemáticas - Fracciones, Historia del Perú, etc."
                  disabled={loading}
                  className="w-full px-4 py-3 bg-brand-black border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Dificultad
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(["fácil", "medio", "difícil"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDifficulty(level)}
                      className={`py-3 px-4 rounded-2xl font-medium transition-all ${
                        difficulty === level
                          ? "bg-purple-500 text-white"
                          : "bg-brand-black border border-gray-700 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !topic.trim()}
                className="w-full py-4 bg-purple-500 text-white font-bold rounded-full hover:bg-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generando Quiz...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5" />
                    Generar Quiz
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* Quiz Questions */}
        {quiz && !showResult && currentQ && (
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-brand-black/80 backdrop-blur-xl border border-purple-500 rounded-3xl p-8"
          >
            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">
                  Pregunta {currentQuestion + 1} de {quiz.questions.length}
                </span>
                <span className="text-sm text-purple-500 font-medium">
                  Puntuación: {score}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%`,
                  }}
                  className="h-full bg-purple-500"
                />
              </div>
            </div>

            {/* Question */}
            <h2 className="text-2xl font-bold text-white mb-8">
              {currentQ.question}
            </h2>

            {/* Options */}
            <div className="space-y-3">
              {currentQ.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = currentQ.correctAnswer === index;
                const showFeedback = selectedAnswer !== null;

                return (
                  <motion.button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={selectedAnswer !== null}
                    whileHover={{ scale: selectedAnswer === null ? 1.02 : 1 }}
                    whileTap={{ scale: selectedAnswer === null ? 0.98 : 1 }}
                    className={`w-full p-4 rounded-2xl text-left font-medium transition-all flex items-center justify-between ${
                      showFeedback
                        ? isCorrect
                          ? "bg-green-500/20 border-2 border-green-500 text-green-400"
                          : isSelected
                            ? "bg-red-500/20 border-2 border-red-500 text-red-400"
                            : "bg-brand-black border border-gray-700 text-gray-500"
                        : "bg-brand-black border-2 border-gray-700 text-white hover:border-purple-500"
                    } disabled:cursor-not-allowed`}
                  >
                    <span>{option}</span>
                    {showFeedback && isCorrect && (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    )}
                    {showFeedback && isSelected && !isCorrect && (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Results */}
        {showResult && quiz && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-brand-black/80 backdrop-blur-xl border border-purple-500 rounded-3xl p-8 text-center"
          >
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-full bg-purple-500/20 border-2 border-purple-500">
                <CheckCircle className="w-10 h-10 text-purple-500" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">
                ¡Quiz Completado!
              </h2>
              <p className="text-gray-400">Aquí están tus resultados</p>
            </div>

            <div className="mb-8">
              <div className="text-6xl font-bold text-purple-500 mb-2">
                {score} / {quiz.questions.length}
              </div>
              <p className="text-xl text-gray-300">
                {score === quiz.questions.length
                  ? "¡Perfecto! 🎉"
                  : score >= quiz.questions.length / 2
                    ? "¡Buen trabajo! 👏"
                    : "Sigue practicando 💪"}
              </p>
            </div>

            <button
              onClick={handleRestart}
              className="px-8 py-4 bg-purple-500 text-white font-bold rounded-full hover:bg-purple-600 transition-all flex items-center justify-center gap-2 mx-auto"
            >
              <RotateCcw className="w-5 h-5" />
              Nuevo Quiz
            </button>
          </motion.div>
        )}

        {/* Back to Dashboard */}
        <div className="mt-6 text-center">
          <a
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
          >
            ← Volver al Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
