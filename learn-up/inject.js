const fs = require('fs');
const file = 'src/components/AIChatComponent.tsx';
let content = fs.readFileSync(file, 'utf8');

const newPackages = \
                        <button type="button" onClick={() => { setActiveSkill(activeSkill === "library_pack" ? "" : "library_pack"); setShowAttachMenu(false); }} className={\\\w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 group \\\\}>
                          <div className={\\\p-2 rounded-lg transition-transform \\\\}>
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className={\\\	ext-sm font-semibold flex items-center justify-between \\\\}>
                              Biblioteca & Documentos
                              <span className={\\\	ext-[9px] px-1.5 py-0.5 rounded-full \\\\}>25 Skills</span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">Análisis, resúmenes y extracción de conocimientos.</div>
                          </div>
                          {activeSkill === "library_pack" && <CheckCircle2 className="w-4 h-4 text-brand-gold self-center" />}
                        </button>

                        <button type="button" onClick={() => { setActiveSkill(activeSkill === "education_pack" ? "" : "education_pack"); setShowAttachMenu(false); }} className={\\\w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 group \\\\}>
                          <div className={\\\p-2 rounded-lg transition-transform \\\\}>
                            <BrainCircuit className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className={\\\	ext-sm font-semibold flex items-center justify-between \\\\}>
                              Educación Especializada
                              <span className={\\\	ext-[9px] px-1.5 py-0.5 rounded-full \\\\}>40 Skills</span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">Flashcards, mapas mentales, exámenes y tutorías.</div>
                          </div>
                          {activeSkill === "education_pack" && <CheckCircle2 className="w-4 h-4 text-brand-gold self-center" />}
                        </button>

                        <button type="button" onClick={() => { setActiveSkill(activeSkill === "media_pack" ? "" : "media_pack"); setShowAttachMenu(false); }} className={\\\w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 group \\\\}>
                          <div className={\\\p-2 rounded-lg transition-transform \\\\}>
                            <ImageIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className={\\\	ext-sm font-semibold flex items-center justify-between \\\\}>
                              Generador Multimedia
                              <span className={\\\	ext-[9px] px-1.5 py-0.5 rounded-full \\\\}>15 Skills</span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">Crear imágenes, esquemas Mermaid y scripts.</div>
                          </div>
                          {activeSkill === "media_pack" && <CheckCircle2 className="w-4 h-4 text-brand-gold self-center" />}
                        </button>
\;

const target = 'Investigador Web</div>\\n                            <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">Búsqueda en tiempo real en internet.</div>\\n                          </div>\\n                          {activeSkill === "web_search" && <CheckCircle2 className="w-4 h-4 text-brand-gold self-center" />}\\n                        </button>';

content = content.replace(target, target + '\\n\\n' + newPackages);
fs.writeFileSync(file, content);
console.log('Added packages');
