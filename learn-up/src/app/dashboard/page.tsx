import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Brain,
  Heart,
  ChefHat,
  Calendar,
  MessageCircle,
  Camera,
  GraduationCap,
  User,
  Bell,
  ArrowRight,
} from "lucide-react";
import {
  StaggerContainer,
  FadeUpItem,
} from "@/components/animations/StaggerReveal";

const aiCards = [
  {
    href: "/ai/profesor",
    icon: BookOpen,
    title: "Profesor IA",
    desc: "Tu tutor que te enseña a pensar profundamente",
    color: "brand-gold",
    border: "border-brand-gold/15",
    hoverBorder: "hover:border-brand-gold/40",
    bg: "bg-brand-gold/5",
    hoverBg: "hover:bg-brand-gold/8",
    iconBg: "bg-brand-gold/10",
    iconBorder: "border-brand-gold/20",
    shadow: "hover:shadow-glow-gold",
  },
  {
    href: "/ai/practica",
    icon: GraduationCap,
    title: "Examen IA",
    desc: "Exámenes reales con preguntas abiertas y cerradas",
    color: "brand-blue-glow",
    border: "border-brand-blue-glow/15",
    hoverBorder: "hover:border-brand-blue-glow/40",
    bg: "bg-brand-blue-glow/5",
    hoverBg: "hover:bg-brand-blue-glow/8",
    iconBg: "bg-brand-blue-glow/10",
    iconBorder: "border-brand-blue-glow/20",
    shadow: "hover:shadow-glow-blue",
  },
  {
    href: "/ai/consejero",
    icon: Heart,
    title: "Consejero IA",
    desc: "Apoyo emocional e inteligencia para tu bienestar",
    color: "brand-pink",
    border: "border-brand-pink/15",
    hoverBorder: "hover:border-brand-pink/40",
    bg: "bg-brand-pink/5",
    hoverBg: "hover:bg-brand-pink/8",
    iconBg: "bg-brand-pink/10",
    iconBorder: "border-brand-pink/20",
    shadow: "hover:shadow-[0_0_20px_rgba(244,114,182,0.15)]",
  },
];

const spaceCards = [
  {
    href: "/calendar",
    icon: Calendar,
    title: "Hora de Actuar",
    desc: "Calendarios, habit tracker y planes compartidos",
    color: "brand-gold",
    border: "border-brand-gold/15",
    hoverBorder: "hover:border-brand-gold/40",
    iconBg: "bg-brand-gold/10",
    iconBorder: "border-brand-gold/20",
    shadow: "hover:shadow-glow-gold",
  },
  {
    href: "/chat",
    icon: MessageCircle,
    title: "Aprendamos Juntos",
    desc: "Chat en tiempo real con videollamadas",
    color: "brand-cyan",
    border: "border-brand-cyan/15",
    hoverBorder: "hover:border-brand-cyan/40",
    iconBg: "bg-brand-cyan/10",
    iconBorder: "border-brand-cyan/20",
    shadow: "hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]",
  },
  {
    href: "/library",
    icon: BookOpen,
    title: "Biblioteca",
    desc: "Material educativo revisado por docentes",
    color: "brand-purple",
    border: "border-brand-purple/15",
    hoverBorder: "hover:border-brand-purple/40",
    iconBg: "bg-brand-purple/10",
    iconBorder: "border-brand-purple/20",
    shadow: "hover:shadow-glow-purple",
  },
  {
    href: "/ai/recetas",
    icon: ChefHat,
    title: "Nutrirecetas",
    desc: "Recetas saludables y deliciosas con IA",
    color: "brand-orange",
    border: "border-brand-orange/15",
    hoverBorder: "hover:border-brand-orange/40",
    iconBg: "bg-brand-orange/10",
    iconBorder: "border-brand-orange/20",
    shadow: "hover:shadow-[0_0_20px_rgba(251,146,60,0.15)]",
  },
  {
    href: "/album",
    icon: Camera,
    title: "Álbum del Saber",
    desc: "Tu cámara y galería de recuerdos educativos",
    color: "brand-emerald",
    border: "border-brand-emerald/15",
    hoverBorder: "hover:border-brand-emerald/40",
    iconBg: "bg-brand-emerald/10",
    iconBorder: "border-brand-emerald/20",
    shadow: "hover:shadow-glow-emerald",
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .limit(1);

  const profile = data?.[0] || null;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="w-full page-bg">

      <div className="page-inner relative z-10">
        <StaggerContainer className="w-full max-w-none space-y-8">
          {/* Header Card */}
          <FadeUpItem>
            <div className="glass border border-white/6 rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/5 via-transparent to-brand-purple/3 pointer-events-none" />
              <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <p className="text-brand-gold/60 text-xs font-semibold uppercase tracking-[0.2em] mb-2 font-body">
                    {greeting()},
                  </p>
                  <h1 className="text-4xl md:text-5xl font-black text-white mb-2 truncate max-w-full font-display">
                    {profile?.full_name || "Estudiante"}
                  </h1>
                  <p className="text-gray-500 text-sm font-body">
                    {profile?.school && `${profile.school} · `}
                    {profile?.grade || ""}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/dashboard/notifications"
                    className="p-3 bg-surface-2 border border-white/6 rounded-xl text-gray-400 hover:text-brand-gold hover:border-brand-gold/30 hover:shadow-glow-gold transition-all duration-300"
                  >
                    <Bell className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center gap-3 px-4 py-3 bg-surface-2 border border-white/6 rounded-xl text-gray-400 hover:text-brand-gold hover:border-brand-gold/30 hover:shadow-glow-gold transition-all duration-300"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        className="w-7 h-7 rounded-lg object-cover"
                        alt="Avatar"
                      />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                    <span className="text-sm font-medium hidden md:block font-body">
                      Mi Perfil
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </FadeUpItem>

          {/* AI Section */}
          <FadeUpItem>
            <section>
              <div className="section-heading">
                <div className="section-heading-icon bg-brand-purple/10 border-brand-purple/20">
                  🧠
                </div>
                <span>Potencia tu Mente</span>
              </div>
              <StaggerContainer
                delayOffset={0.2}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {aiCards.map((card) => (
                  <Link key={card.href} href={card.href} className="block h-full">
                    <div
                      className={`glass border ${card.border} ${card.hoverBorder} rounded-2xl p-6 h-full ${card.shadow} transition-all duration-500 cursor-pointer group`}
                    >
                      <div
                        className={`w-12 h-12 mb-4 rounded-xl ${card.iconBg} border ${card.iconBorder} flex items-center justify-center group-hover:scale-110 transition-all duration-300`}
                      >
                        <card.icon className={`w-6 h-6 text-${card.color}`} />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1 font-display">
                        {card.title}
                      </h3>
                      <p className="text-gray-500 text-sm font-body">
                        {card.desc}
                      </p>
                    </div>
                  </Link>
                ))}
              </StaggerContainer>
            </section>
          </FadeUpItem>

          {/* Space Section */}
          <FadeUpItem>
            <section>
              <div className="section-heading">
                <div className="section-heading-icon bg-brand-gold/10 border-brand-gold/20">
                  📚
                </div>
                <span>Mi Espacio</span>
              </div>
              <StaggerContainer
                delayOffset={0.3}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {spaceCards.map((card) => (
                  <Link key={card.href} href={card.href} className="block h-full">
                    <div
                      className={`glass border ${card.border} ${card.hoverBorder} rounded-2xl p-6 h-full ${card.shadow} transition-all duration-500 cursor-pointer group`}
                    >
                      <div
                        className={`w-12 h-12 mb-4 rounded-xl ${card.iconBg} border ${card.iconBorder} flex items-center justify-center group-hover:scale-110 transition-all duration-300`}
                      >
                        <card.icon className={`w-6 h-6 text-${card.color}`} />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1 font-display">
                        {card.title}
                      </h3>
                      <p className="text-gray-500 text-sm font-body">
                        {card.desc}
                      </p>
                    </div>
                  </Link>
                ))}
              </StaggerContainer>
            </section>
          </FadeUpItem>
        </StaggerContainer>
      </div>
    </div>
  );
}
