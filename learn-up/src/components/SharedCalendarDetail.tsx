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
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
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

  // Calendar logic
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<SharedEvent[]>([]);

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
    return format(startOfWeek(date, { weekStartsOn: 0 }), "yyyy-MM-dd");
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
    try {
      const { data, error } = await supabase
        .from("shared_calendar_events")
        .select("*")
        .eq("calendar_id", calendar.id)
        .order("start_time", { ascending: true });
      if (error) throw error;
      if (data) setEvents(data as any);
    } catch (e) {
      console.error(e);
    }
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
    try {
      const weekStart = getWeekStart(currentHabitWeek);
      const { data, error } = await supabase
        .from("shared_habit_tracker")
        .select("habits")
        .eq("calendar_id", calendar.id)
        .eq("week_start", weekStart)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("Shared habits load error:", error);
      }
      setHabits((data?.habits as HabitActivity[]) || []);
    } catch (err) {
      console.error("Fetch shared habits error:", err);
    }
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
      console.error("Backend error creating event:", result.error);
      alert("Error al crear el evento: " + result.error);
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

  const handleDayClick = (day: Date) => {
    const dayEvts = getEventsForDay(day);
    setSelectedDay(day);
    setSelectedDayEvents(dayEvts);
    setShowDayModal(true);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) =>
    events.filter((event) => isSameDay(new Date(event.start_time), day));

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

      {/* Events Tab - Unificado al grid de Calendario Personal */}
      {activeSubTab === "events" && (
        <div className="flex-1 flex flex-col bg-gray-900/80 backdrop-blur-xl border border-brand-gold/30 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-full border border-gray-700 text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 cursor-pointer select-none group">
              <h2 className="text-xl font-bold text-white group-hover:text-brand-gold transition-colors">
                {format(currentMonth, "MMMM yyyy", { locale: es }).replace(
                  /^\w/,
                  (c) => c.toUpperCase(),
                )}
              </h2>
            </div>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-full border border-gray-700 text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3 bg-gray-900/50 p-2 rounded-2xl w-fit mb-4">
            <button
              onClick={() => {
                const head = document.head.innerHTML;
                const printWindow = window.open("", "_blank");
                if (printWindow) {
                  printWindow.document.write(
                    "<html><head>" + head + "</head><body>",
                  );
                  const calendarHtml = document.querySelector(
                    ".pointer-events-auto",
                  )?.innerHTML;
                  printWindow.document.write("<h1>" + calendar.name + "</h1>");
                  if (calendarHtml) printWindow.document.write(calendarHtml);
                  printWindow.document.write("</body></html>");
                  printWindow.document.close();
                  setTimeout(() => {
                    printWindow.print();
                  }, 500);
                }
              }}
              className="px-4 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded-xl hover:bg-gray-700 hover:text-white transition-all text-sm font-semibold flex items-center gap-2"
            >
              Imprimir
            </button>
            <button
              onClick={() => setShowEventModal(true)}
              className="px-4 py-2 bg-brand-gold text-brand-black rounded-xl hover:bg-white transition-all text-sm font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Evento
            </button>
          </div>

          <div className="flex-1 min-h-[500px] flex flex-col pointer-events-auto">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {DAY_KEYS.map((d) => (
                <div
                  key={d}
                  className="text-center font-bold text-gray-500 text-sm"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2 flex-1">
              {Array.from({ length: monthStart.getDay() }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="p-2 bg-gray-900/30 rounded-2xl border border-gray-800/50"
                />
              ))}

              {daysInMonth.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const isCurrentDay = isSameDay(day, new Date());

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    className={`min-h-[100px] p-2 rounded-2xl transition-all cursor-pointer border flex flex-col gap-1 
                      ${isCurrentDay ? "bg-brand-gold/10 border-brand-gold" : "bg-black/40 border-gray-800 hover:border-gray-600"}
                      ${isSelected ? "ring-2 ring-brand-gold" : ""}
                    `}
                  >
                    <div className="flex justify-between items-start">
                      <span
                        className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full
                        ${isCurrentDay ? "bg-brand-gold text-brand-black" : "text-gray-300"}`}
                      >
                        {format(day, "d")}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((event: any) => (
                        <div
                          key={event.id}
                          className="text-[10px] px-1 rounded truncate font-medium bg-blue-600/30 text-blue-400 border border-blue-500/20"
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[9px] text-gray-500">
                          +{dayEvents.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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

      {/* Modal de Detalle de Día de Grupo */}
      <AnimatePresence>
        {showDayModal && selectedDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDayModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border border-brand-gold/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {format(selectedDay, "d 'de' MMMM, yyyy", { locale: es })}
                  </h2>
                  <p className="text-brand-gold font-medium mt-1">
                    {selectedDayEvents.length}{" "}
                    {selectedDayEvents.length === 1
                      ? "evento programado"
                      : "eventos programados"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEventData({
                        ...eventData,
                        start: format(selectedDay, "yyyy-MM-dd'T'12:00"),
                        end: format(selectedDay, "yyyy-MM-dd'T'13:00"),
                      });
                      setShowDayModal(false);
                      setShowEventModal(true);
                    }}
                    className="p-2.5 text-brand-black bg-brand-gold hover:bg-white rounded-full transition-colors flex items-center justify-center w-10 h-10"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowDayModal(false)}
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors self-start w-10 h-10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto pr-2 space-y-4 flex-1 custom-scrollbar">
                {selectedDayEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay eventos programados en este día.
                  </div>
                ) : (
                  selectedDayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="bg-blue-900/10 border-blue-500/20 border p-5 rounded-2xl flex flex-col"
                    >
                      <div className="flex justify-between items-start mb-3 gap-4">
                        <h3 className="font-bold text-lg text-white leading-tight">
                          {ev.title}
                        </h3>
                        {ev.created_by === currentUserId && (
                          <button
                            onClick={async () => {
                              if (confirm("¿Eliminar evento grupal?")) {
                                await deleteSharedEvent(ev.id);
                                await loadEvents();
                                setShowDayModal(false);
                              }
                            }}
                            className="text-gray-500 hover:text-red-400 p-1 bg-gray-800 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {ev.description && (
                        <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                          {ev.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-sm font-semibold mt-auto flex-wrap gap-2">
                        <div className="px-3 py-1.5 rounded-lg flex items-center gap-2 bg-blue-400 text-blue-950">
                          <Clock className="w-4 h-4" />
                          {new Date(ev.start_time).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" - "}
                          {new Date(ev.end_time).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <span className="text-gray-400 text-xs">
                          Por{" "}
                          {ev.created_by === currentUserId
                            ? "ti"
                            : "un miembro"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
