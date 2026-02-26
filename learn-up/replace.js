const fs = require("fs");
let content = fs.readFileSync("src/app/calendar/page.tsx", "utf8");

content = content.replace(
  'import BackButton from "@/components/BackButton";',
  'import BackButton from "@/components/BackButton";\nimport SharedCalendarDetail from "@/components/SharedCalendarDetail";\nimport { createSharedCalendar } from "@/actions/shared-calendars";',
);

content = content.replace(
  "const [habitLoading, setHabitLoading] = useState(false);",
  'const [habitLoading, setHabitLoading] = useState(false);\n  const [sharedCalendars, setSharedCalendars] = useState<any[]>([]);\n  const [selectedSharedCalendar, setSelectedSharedCalendar] = useState<any | null>(null);\n  const [showCreateSharedModal, setShowCreateSharedModal] = useState(false);\n  const [newSharedName, setNewSharedName] = useState("");',
);

content = content.replace(
  "// ── Habit Tracker ─────────────────────────────────────────────────────────────",
  `const handleCreateShared = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newSharedName.trim()) return;
    const res = await createSharedCalendar(newSharedName, []);
    if(res.success) {
      setShowCreateSharedModal(false);
      setNewSharedName('');
      loadEvents(); // Reload everything
    } else {
      alert("Error al crear calendario compartido.");
    }
  };

  // ── Habit Tracker ─────────────────────────────────────────────────────────────`,
);

content = content.replace(
  /const loadEvents = async \(\) => \{\n([\s\S]*?)finally \{\n      setLoading\(false\);\n    \}\n  \};/,
  `const loadEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: personalEvents } = await supabase
        .from("events")
        .select("*")
        .order("start_time");

      const { data: sCalendars } = await supabase
        .from("shared_calendars")
        .select("*")
        .contains("members", [user.id]);

      let formattedSharedEvents: any[] = [];
      if (sCalendars) {
        setSharedCalendars(sCalendars);
        const cIds = sCalendars.map((c: any) => c.id);
        if (cIds.length > 0) {
           const { data: sEvents } = await supabase
             .from("shared_calendar_events")
             .select("*")
             .in("calendar_id", cIds);
           if(sEvents) {
              formattedSharedEvents = sEvents.map(se => ({
                 id: se.id,
                 title: \`👥 \${se.title}\`,
                 description: se.description,
                 start_time: se.start_time,
                 end_time: se.end_time,
                 user_id: se.created_by,
                 isShared: true
              }));
           }
        }
      }
      setEvents([...(personalEvents || []), ...formattedSharedEvents].sort((a,b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
    } catch (err) {
      console.error("Error loading events:", err);
    } finally {
      setLoading(false);
    }
  };`,
);

content = content.replace(
  /{activeTab === \"shared\" && \([\s\S]*?Próximamente disponible\\n            <\/p>\\n          <\/div>\\n        \)}/,
  `{activeTab === "shared" && (
          <div className="space-y-6">
             {selectedSharedCalendar ? (
               <SharedCalendarDetail 
                 calendar={selectedSharedCalendar} 
                 currentUserId={currentUserId!} 
                 onBack={() => { setSelectedSharedCalendar(null); loadEvents(); }} 
               />
             ) : (
               <div className="bg-gray-900/80 backdrop-blur-xl border border-brand-gold/30 rounded-3xl p-8">
                  <div className="flex justify-between items-center mb-8">
                     <div>
                        <h2 className="text-2xl font-bold text-white">Tus Calendarios Compartidos</h2>
                        <p className="text-gray-400">Gestiona eventos, hábitos y comunícate con tu grupo.</p>
                     </div>
                     <button onClick={() => setShowCreateSharedModal(true)} className="px-6 py-3 bg-brand-gold text-brand-black font-bold rounded-full hover:bg-white transition-all flex items-center gap-2">
                       <Plus className="w-5 h-5" /> Nuevo Grupo
                     </button>
                  </div>
                  {sharedCalendars.length === 0 ? (
                    <div className="text-center py-12">
                       <Users className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                       <h3 className="text-xl font-bold text-gray-300">Sin calendarios grupales</h3>
                       <p className="text-gray-500">Crea un calendario para empezar a compartir eventos y crear metas juntos.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       {sharedCalendars.map(c => (
                          <div key={c.id} onClick={() => setSelectedSharedCalendar(c)} className="bg-black/40 border border-gray-800 p-6 rounded-2xl hover:border-brand-gold/50 cursor-pointer transition-all flex items-start gap-4">
                             <div className="p-3 bg-brand-gold/10 rounded-full"><Users className="w-6 h-6 text-brand-gold"/></div>
                             <div>
                                <h3 className="font-bold text-white text-lg">{c.name}</h3>
                                <p className="text-sm text-gray-400">{c.members.length} Miembros</p>
                             </div>
                          </div>
                       ))}
                    </div>
                  )}
               </div>
             )}
          </div>
        )}`,
);

content = content.replace(
  "      </div>\n    </div>\n  );\n}",
  `      </div>

       <AnimatePresence>
          {showCreateSharedModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowCreateSharedModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-brand-black border border-brand-gold rounded-3xl p-8 max-w-md w-full"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Nuevo Calendario Compartido</h2>
                  <button onClick={() => setShowCreateSharedModal(false)} className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 hover:border-brand-gold hover:text-brand-gold">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateShared} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nombre del Grupo/Calendario *</label>
                    <input type="text" value={newSharedName} onChange={(e) => setNewSharedName(e.target.value)} className="w-full px-4 py-3 bg-brand-black border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold" placeholder="Ej: Grupo de Estudio" required />
                  </div>
                  <button type="submit" className="w-full py-3 bg-brand-gold text-brand-black font-bold rounded-full hover:bg-white transition-all">Crear Calendario</button>
                </form>
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}`,
);

fs.writeFileSync("src/app/calendar/page.tsx", content);
console.log("Successfully updated src/app/calendar/page.tsx");
