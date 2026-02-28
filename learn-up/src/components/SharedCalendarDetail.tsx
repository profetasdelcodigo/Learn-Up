"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarIcon,
  MessageCircle,
  Users,
  Plus,
  X,
  Send,
  Loader2,
  Trash2,
  Mic,
  Square,
  Clock,
  Target,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  addSharedEvent,
  sendSharedMessage,
  deleteSharedEvent,
} from "@/actions/shared-calendars";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { es } from "date-fns/locale";

interface SharedCalendar {
  id: string;
  name: string;
  created_by: string;
  members: string[];
}

interface SharedEvent {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  created_by: string;
  profiles?: { full_name: string; username: string };
}

interface Message {
  id: string;
  user_id: string;
  content: string;
  type: "text" | "audio" | "system";
  created_at: string;
  profiles?: { full_name: string; username: string; avatar_url: string };
}

interface HabitActivity {
  id: string;
  name: string;
  days: Record<string, boolean>; // "Mon", "Tue", etc.
}

const DAY_KEYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function SharedCalendarDetail({
  calendar,
  onBack,
  currentUserId,
}: {
  calendar: SharedCalendar;
  onBack: () => void;
  currentUserId: string;
}) {
  const [activeSubTab, setActiveSubTab] = useState<
    "events" | "chat" | "habits"
  >("events");
  const [events, setEvents] = useState<SharedEvent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat state
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Audio Recording (Simplified for chat)
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Event creation
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventData, setEventData] = useState({
    title: "",
    description: "",
    start: "",
    end: "",
  });
  const [eventSubmitting, setEventSubmitting] = useState(false);

  // Group Habit Tracker
  const [currentHabitWeek, setCurrentHabitWeek] = useState(new Date());
  const [habits, setHabits] = useState<HabitActivity[]>([]);
  const [newHabitName, setNewHabitName] = useState("");

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return format(d, "yyyy-MM-dd");
  };

  useEffect(() => {
    loadData();

    const messagesSubscription = supabase
      .channel(`shared_calendar_messages_${calendar.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "shared_calendar_messages",
          filter: `calendar_id=eq.${calendar.id}`,
        },
        () => {
          loadMessages();
        },
      )
      .subscribe();

    const eventsSubscription = supabase
      .channel(`shared_calendar_events_${calendar.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shared_calendar_events",
          filter: `calendar_id=eq.${calendar.id}`,
        },
        () => {
          loadEvents();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesSubscription);
      supabase.removeChannel(eventsSubscription);
    };
  }, [calendar.id]);

  useEffect(() => {
    loadHabits();
  }, [currentHabitWeek, calendar.id]);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadEvents(), loadMessages()]);
    setLoading(false);
  }

  async function loadEvents() {
    const { data } = await supabase
      .from("shared_calendar_events")
      .select("*, profiles(full_name, username)")
      .eq("calendar_id", calendar.id)
      .order("start_time", { ascending: true });
    if (data) setEvents(data as any);
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("shared_calendar_messages")
      .select("*, profiles(full_name, username, avatar_url)")
      .eq("calendar_id", calendar.id)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data as any);
      setTimeout(
        () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    }
  }

  async function loadHabits() {
    const weekStart = getWeekStart(currentHabitWeek);
    const { data } = await supabase
      .from("shared_habit_tracker")
      .select("habits")
      .eq("calendar_id", calendar.id)
      .eq("week_start", weekStart)
      .maybeSingle();
    setHabits((data?.habits as HabitActivity[]) || []);
  }

  const saveHabits = async (newHabits: HabitActivity[]) => {
    const weekStart = getWeekStart(currentHabitWeek);
    await supabase.from("shared_habit_tracker").upsert(
      {
        calendar_id: calendar.id,
        week_start: weekStart,
        habits: newHabits,
        updated_by: currentUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "calendar_id,week_start" },
    );
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventData.title || !eventData.start || !eventData.end) return;
    setEventSubmitting(true);
    const result = await addSharedEvent(
      calendar.id,
      eventData.title,
      eventData.description,
      eventData.start,
      eventData.end,
    );
    if (result.success) {
      setShowEventModal(false);
      setEventData({ title: "", description: "", start: "", end: "" });
      loadEvents();
    } else {
      alert("Error al crear el evento");
    }
    setEventSubmitting(false);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    const result = await sendSharedMessage(calendar.id, newMessage, "text");
    if (result.success) {
      setNewMessage("");
      loadMessages();
    }
    setSending(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());

        // Upload audio
        const fileExt = "webm";
        const fileName = `${calendar.id}_${Date.now()}.${fileExt}`;
        const filePath = `shared_audios/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat_files")
          .upload(filePath, audioBlob);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from("chat_files")
            .getPublicUrl(filePath);
          await sendSharedMessage(
            calendar.id,
            publicUrlData.publicUrl,
            "audio",
          );
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing mic:", err);
      alert("No se pudo acceder al micrófono.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const addHabit = async () => {
    if (!newHabitName.trim()) return;
    const newHabit: HabitActivity = {
      id: crypto.randomUUID(),
      name: newHabitName.trim(),
      days: {},
    };
    const updated = [...habits, newHabit];
    setHabits(updated);
    setNewHabitName("");
    await saveHabits(updated);
  };

  const toggleHabitDay = async (habitId: string, dayKey: string) => {
    const updated = habits.map((h) =>
      h.id === habitId
        ? { ...h, days: { ...h.days, [dayKey]: !h.days[dayKey] } }
        : h,
    );
    setHabits(updated);
    await saveHabits(updated);
  };

  const deleteHabit = async (habitId: string) => {
    const updated = habits.filter((h) => h.id !== habitId);
    setHabits(updated);
    await saveHabits(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gray-900/80 backdrop-blur-xl border border-brand-gold/30 rounded-3xl p-6 min-h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-gray-800 text-gray-400 rounded-full hover:text-white"
          >
            ←
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-brand-gold" /> {calendar.name}
            </h2>
            <p className="text-sm text-gray-400">
              {calendar.members.length} miembros compartiendo eventos
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex gap-2 p-1 bg-black/40 rounded-2xl mb-6 w-fit border border-gray-800">
        <button
          onClick={() => setActiveSubTab("events")}
          className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${activeSubTab === "events" ? "bg-brand-gold text-brand-black shadow-lg" : "text-gray-400 hover:text-white"}`}
        >
          <CalendarIcon className="w-4 h-4" /> Eventos
        </button>
        <button
          onClick={() => setActiveSubTab("chat")}
          className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${activeSubTab === "chat" ? "bg-brand-gold text-brand-black shadow-lg" : "text-gray-400 hover:text-white"}`}
        >
          <MessageCircle className="w-4 h-4" /> Chat Grupal
        </button>
        <button
          onClick={() => setActiveSubTab("habits")}
          className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${activeSubTab === "habits" ? "bg-brand-blue-glow text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
        >
          <Target className="w-4 h-4" /> Hábitos de Grupo
        </button>
      </div>

      {/* Events Tab */}
      {activeSubTab === "events" && (
        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">Próximos Eventos</h3>
            <button
              onClick={() => setShowEventModal(true)}
              className="px-4 py-2 bg-brand-gold/10 text-brand-gold border border-brand-gold/30 rounded-xl font-semibold hover:bg-brand-gold hover:text-brand-black transition-all flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> Nuevo Evento Grupal
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                No hay eventos próximos en este calendario.
              </p>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  className="bg-black/40 border border-gray-800 p-4 rounded-2xl flex items-start gap-4 hover:border-brand-gold/40 transition-colors"
                >
                  <div className="bg-brand-gold/10 px-3 py-2 rounded-xl text-center min-w-[70px]">
                    <div className="text-brand-gold font-bold text-lg">
                      {new Date(ev.start_time).getDate()}
                    </div>
                    <div className="text-gray-400 text-xs uppercase">
                      {new Date(ev.start_time).toLocaleString("es-ES", {
                        month: "short",
                      })}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white">{ev.title}</h4>
                    {ev.description && (
                      <p className="text-sm text-gray-400 mt-1">
                        {ev.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{" "}
                        {new Date(ev.start_time).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span>Por: @{ev.profiles?.username || "anónimo"}</span>
                    </div>
                  </div>
                  {ev.created_by === currentUserId && (
                    <button
                      onClick={async () => {
                        if (confirm("¿Eliminar evento grupal?")) {
                          await deleteSharedEvent(ev.id);
                          loadEvents();
                        }
                      }}
                      className="p-2 text-gray-500 hover:text-red-400 bg-gray-800 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Chat Tab */}
      {activeSubTab === "chat" && (
        <div className="flex-1 flex flex-col bg-black/40 rounded-2xl border border-gray-800 overflow-hidden min-h-[400px]">
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, i) => {
              if (msg.type === "system") {
                return (
                  <div key={msg.id} className="text-center">
                    <span className="text-xs text-brand-gold bg-brand-gold/10 px-3 py-1 rounded-full">
                      @{msg.profiles?.username || "Alguien"} {msg.content}
                    </span>
                  </div>
                );
              }
              const isMe = msg.user_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] ${isMe ? "bg-brand-gold text-brand-black" : "bg-gray-800 text-white"} p-3 rounded-2xl ${isMe ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                  >
                    {!isMe && (
                      <div className="text-xs text-brand-gold mb-1 font-bold">
                        @{msg.profiles?.username}
                      </div>
                    )}
                    {msg.type === "audio" ? (
                      <audio
                        src={msg.content}
                        controls
                        className="h-8 max-w-full"
                      />
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                    <div
                      className={`text-[10px] mt-1 ${isMe ? "text-brand-black/60" : "text-gray-400"} text-right`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div className="p-4 bg-gray-900 border-t border-gray-800">
            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-black/60 border border-gray-700 rounded-full px-4 py-3 text-white focus:outline-none focus:border-brand-gold text-sm"
                placeholder="Escribe a los miembros del calendario..."
              />
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-3 rounded-full flex items-center justify-center transition-all ${isRecording ? "bg-red-500/10 text-red-500 animate-pulse" : "bg-gray-800 text-gray-400 hover:text-brand-gold"}`}
              >
                {isRecording ? (
                  <Square className="w-5 h-5 fill-current" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
              <button
                disabled={sending || (!newMessage.trim() && !isRecording)}
                type="submit"
                className="p-3 bg-brand-gold text-brand-black rounded-full hover:bg-white disabled:opacity-50 transition-all flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Habits Tab */}
      {activeSubTab === "habits" && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6 bg-black/40 p-3 rounded-xl border border-gray-800">
            <div>
              <h3 className="font-bold text-white text-sm">Hábitos Grupales</h3>
              <p className="text-xs text-gray-400">
                Semana del{" "}
                {format(startOfWeek(currentHabitWeek), "d MMM", { locale: es })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setCurrentHabitWeek(subWeeks(currentHabitWeek, 1))
                }
                className="p-1.5 rounded-lg bg-gray-800 text-gray-400"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setCurrentHabitWeek(addWeeks(currentHabitWeek, 1))
                }
                className="p-1.5 rounded-lg bg-gray-800 text-gray-400"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addHabit()}
              placeholder="Nuevo hábito grupal (Enter para agregar)"
              className="flex-1 px-4 py-2 bg-black/40 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-brand-blue-glow text-sm"
            />
            <button
              onClick={addHabit}
              className="px-4 py-2 bg-brand-blue-glow text-white font-semibold rounded-xl text-sm"
            >
              Agregar
            </button>
          </div>

          <div className="flex-1 overflow-x-auto bg-black/40 p-4 rounded-2xl border border-gray-800">
            {habits.length === 0 ? (
              <p className="text-sm text-gray-500 text-center mt-10">
                Agreguen metas para cumplir como grupo esta semana.
              </p>
            ) : (
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 text-gray-400 text-xs font-bold uppercase w-1/3">
                      Actividad
                    </th>
                    {DAY_KEYS.map((d) => (
                      <th
                        key={d}
                        className="py-2 px-2 text-gray-400 text-[10px] font-bold uppercase text-center"
                      >
                        {d}
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="space-y-1">
                  {habits.map((habit) => (
                    <tr key={habit.id} className="border-t border-gray-800/50">
                      <td className="py-3 px-3 text-white text-sm font-medium">
                        {habit.name}
                      </td>
                      {DAY_KEYS.map((dayKey) => (
                        <td key={dayKey} className="py-3 px-2 text-center">
                          <button
                            onClick={() => toggleHabitDay(habit.id, dayKey)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto transition-all ${
                              habit.days[dayKey]
                                ? "bg-brand-blue-glow text-white"
                                : "border border-gray-600 text-transparent"
                            }`}
                          >
                            {habit.days[dayKey] && (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      ))}
                      <td className="py-3 pr-2">
                        <button
                          onClick={() => deleteHabit(habit.id)}
                          className="p-1 text-gray-600 hover:text-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      <AnimatePresence>
        {showEventModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEventModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-brand-black border border-brand-gold rounded-3xl p-8 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Evento Grupal</h2>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="text-gray-400 hover:text-brand-gold"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Título
                  </label>
                  <input
                    type="text"
                    value={eventData.title}
                    onChange={(e) =>
                      setEventData({ ...eventData, title: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-brand-gold outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={eventData.description}
                    onChange={(e) =>
                      setEventData({
                        ...eventData,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-brand-gold outline-none resize-none"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      Inicio
                    </label>
                    <input
                      type="datetime-local"
                      value={eventData.start}
                      onChange={(e) =>
                        setEventData({ ...eventData, start: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-brand-gold outline-none text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      Fin
                    </label>
                    <input
                      type="datetime-local"
                      value={eventData.end}
                      onChange={(e) =>
                        setEventData({ ...eventData, end: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-brand-gold outline-none text-sm"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={eventSubmitting}
                  className="w-full py-3 bg-brand-gold text-brand-black font-bold rounded-xl mt-4"
                >
                  {eventSubmitting ? "Creando..." : "Guardar Evento"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
