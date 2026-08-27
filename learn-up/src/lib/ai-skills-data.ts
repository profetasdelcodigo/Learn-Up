export interface SkillCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  skillCount: number;
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    id: "calendar_pack",
    name: "Calendario y Habit Tracker",
    description: "Gestión de eventos, recordatorios, rutinas y calendarios compartidos con amigos.",
    icon: "Calendar",
    color: "bg-blue-500",
    skillCount: 27
  },
  {
    id: "chat_pack",
    name: "Chat Social y Grupos",
    description: "Interacción con amigos, grupos de estudio, encuestas y gestión de conversaciones.",
    icon: "MessageSquare",
    color: "bg-green-500",
    skillCount: 25
  },
  {
    id: "library_pack",
    name: "Biblioteca y Documentos",
    description: "Búsqueda semántica, resumen de PDFs, generación de citas y extracción de texto OCR.",
    icon: "BookOpen",
    color: "bg-amber-600",
    skillCount: 22
  },
  {
    id: "learning_pack",
    name: "Aprendizaje y Knowledge Graph",
    description: "Guarda conceptos, crea mapas mentales y rutas de estudio personalizadas.",
    icon: "BrainCircuit",
    color: "bg-purple-500",
    skillCount: 15
  },
  {
    id: "content_pack",
    name: "Generación de Contenido",
    description: "Creación de ensayos, resúmenes, presentaciones, flashcards y código funcional.",
    icon: "PenLine",
    color: "bg-pink-500",
    skillCount: 22
  },
  {
    id: "media_pack",
    name: "Multimedia",
    description: "Generación de imágenes, transcripción de audio/video y lectura visual.",
    icon: "ImageIcon",
    color: "bg-rose-500",
    skillCount: 15
  },
  {
    id: "research_pack",
    name: "Investigación y Búsqueda",
    description: "Búsqueda avanzada, fact-checking y recuperación de papers académicos.",
    icon: "Search",
    color: "bg-teal-500",
    skillCount: 18
  },
  {
    id: "stats_pack",
    name: "Análisis y Datos",
    description: "Estadísticas de estudio, rachas, gráficos de progreso y salud académica.",
    icon: "BarChart3",
    color: "bg-indigo-500",
    skillCount: 14
  },
  {
    id: "profile_pack",
    name: "Perfil y Social",
    description: "Actualización de bio, avatar, solicitudes de amistad y álbum de aprendizaje.",
    icon: "User",
    color: "bg-cyan-500",
    skillCount: 17
  },
  {
    id: "edu_pack",
    name: "Educación Especializada",
    description: "Resolución matemática paso a paso, análisis literario, traducción y debate socrático.",
    icon: "GraduationCap",
    color: "bg-orange-500",
    skillCount: 20
  }
];
