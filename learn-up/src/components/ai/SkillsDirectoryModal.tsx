"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, BookOpen, MessageSquare, Calendar, BrainCircuit, PenLine, Image as ImageIcon, BarChart3, User, GraduationCap, ChevronDown, CheckCircle2, SlidersHorizontal, Plus } from "lucide-react";
import { SKILL_CATEGORIES, SkillCategory } from "@/lib/ai-skills-data";

// Map lucide icons dynamically
const iconMap: Record<string, any> = {
  Calendar,
  MessageSquare,
  BookOpen,
  BrainCircuit,
  PenLine,
  ImageIcon,
  Search,
  BarChart3,
  User,
  GraduationCap
};

interface SkillsDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSkills: string[];
  onToggleSkill: (skillId: string) => void;
}

export default function SkillsDirectoryModal({
  isOpen,
  onClose,
  activeSkills,
  onToggleSkill
}: SkillsDirectoryModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"skills" | "connectors" | "plugins">("skills");

  const filteredSkills = SKILL_CATEGORIES.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="text-2xl font-semibold text-white tracking-tight">Directorio</h2>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className="w-64 border-r border-white/5 p-4 flex flex-col gap-2">
                <button 
                  onClick={() => setActiveTab("skills")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${activeTab === "skills" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                >
                  <BookOpen className="w-4 h-4" />
                  Skills
                </button>
                <button 
                  onClick={() => setActiveTab("connectors")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${activeTab === "connectors" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                >
                  <BookOpen className="w-4 h-4" />
                  Conectores
                </button>
                <button 
                  onClick={() => setActiveTab("plugins")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${activeTab === "plugins" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                >
                  <BookOpen className="w-4 h-4" />
                  Plugins
                </button>
              </div>

              {/* Main Content */}
              <div className="flex-1 flex flex-col bg-[#161616]">
                {/* Topbar: Search & Filters */}
                <div className="p-6 pb-2 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                      type="text" 
                      placeholder="Buscar habilidades..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#242424] text-white border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all placeholder:text-gray-500"
                    />
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <span className="text-white px-3 py-1.5 rounded-md bg-white/5">Learn Up</span>
                    <button className="flex items-center gap-2 text-gray-300 hover:text-white bg-[#242424] border border-white/10 rounded-xl px-4 py-2.5 transition-colors">
                      Filtrar por <ChevronDown className="w-4 h-4" />
                    </button>
                    <button className="flex items-center gap-2 text-gray-300 hover:text-white bg-[#242424] border border-white/10 rounded-xl px-4 py-2.5 transition-colors">
                      Ordenar por <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6 pt-4">
                  {activeTab === "skills" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                      {filteredSkills.map(skill => {
                        const IconComponent = iconMap[skill.icon] || BookOpen;
                        const isActive = activeSkills.includes(skill.id);
                        
                        return (
                          <div 
                            key={skill.id}
                            className={`group relative bg-[#242424] border rounded-2xl p-5 flex flex-col transition-all hover:bg-[#2a2a2a] ${isActive ? 'border-brand-gold/50 shadow-[0_0_15px_rgba(255,215,0,0.1)]' : 'border-white/5'}`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${skill.color} bg-opacity-10 text-white`}>
                                  <IconComponent className="w-5 h-5" />
                                </div>
                                <div>
                                  <h3 className="text-white font-medium text-[15px]">/{skill.id}</h3>
                                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                    <span>Learn Up</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <BookOpen className="w-3 h-3" /> {skill.skillCount} tools
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button 
                                onClick={() => onToggleSkill(skill.id)}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-brand-gold text-black hover:bg-yellow-400' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                              >
                                {isActive ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                              </button>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">
                              {skill.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeTab !== "skills" && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                      <SlidersHorizontal className="w-12 h-12 opacity-20" />
                      <p>Próximamente disponible</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
