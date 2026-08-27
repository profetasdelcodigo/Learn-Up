import { createClient } from "@/utils/supabase/server";
import { getAIEmbedding } from "@/lib/ai";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface KnowledgeNode {
  id: string;
  title: string;
  description: string;
  confidence_level: number;
  source_type: string;
  created_at: string;
  similarity?: number;
}

export interface KnowledgeEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: string;
}

// ── Semantic Search: Find related concepts the student already knows ──────────
export async function findRelatedConcepts(
  userId: string,
  queryText: string,
  limit: number = 5,
  similarityThreshold: number = 0.65,
): Promise<KnowledgeNode[]> {
  try {
    const supabase = await createClient();
    const embedding = await getAIEmbedding(queryText);

    // Use pgvector's cosine distance operator via RPC
    const { data, error } = await supabase.rpc("match_knowledge_nodes", {
      query_embedding: `[${embedding.join(",")}]`,
      match_threshold: similarityThreshold,
      match_count: limit,
      p_user_id: userId,
    });

    if (error) {
      console.error("Error searching knowledge graph:", error);
      return [];
    }

    return (data || []) as KnowledgeNode[];
  } catch (e) {
    console.error("Knowledge graph search failed:", e);
    return [];
  }
}

// ── Build context string for the AI tutor ─────────────────────────────────────
export async function getLearnGraphContext(
  userId: string,
  currentQuestion: string,
): Promise<string> {
  const relatedNodes = await findRelatedConcepts(userId, currentQuestion, 5);

  if (relatedNodes.length === 0) {
    return "";
  }

  let context = "\n\n📊 MEMORIA DEL ESTUDIANTE (Learn Graph — conceptos que ya domina):\n";
  relatedNodes.forEach((node, i) => {
    const confidence = Math.round((node.confidence_level || 5) * 10); // confidence is integer, e.g. 1-10 or 1-5, let's normalize or handle it.
    const similarity = node.similarity ? Math.round(node.similarity * 100) : "?";
    context += `${i + 1}. "${node.title}" (confianza: ${confidence}%, relevancia: ${similarity}%) — ${node.description || "sin descripción"}\n`;
  });
  context += "\nUSA ESTA INFORMACIÓN para:\n";
  context += "- NO repetir explicaciones de conceptos que el estudiante ya domina (confianza ≥ 80%).\n";
  context += "- Conectar el nuevo tema con lo que ya sabe, usando analogías con conceptos familiares.\n";
  context += "- Si el concepto actual es NUEVO para el estudiante, usa la herramienta save_learned_concept al final.\n";

  return context;
}

// ── Create an edge between two concepts ───────────────────────────────────────
export async function linkConcepts(
  userId: string,
  fromNodeId: string,
  toNodeId: string,
  relationshipType: string = "related_to",
): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Avoid duplicate edges
    const { data: existing } = await supabase
      .from("knowledge_edges")
      .select("id")
      .eq("user_id", userId)
      .eq("source_node_id", fromNodeId)
      .eq("target_node_id", toNodeId)
      .maybeSingle();

    if (existing) return true;

    const { error } = await supabase.from("knowledge_edges").insert({
      user_id: userId,
      source_node_id: fromNodeId,
      target_node_id: toNodeId,
      relationship_type: relationshipType,
    });

    if (error) {
      console.error("Error linking concepts:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Link concepts failed:", e);
    return false;
  }
}

// ── Get a student's full graph stats ──────────────────────────────────────────
export async function getGraphStats(userId: string): Promise<{
  totalNodes: number;
  totalEdges: number;
  recentConcepts: string[];
}> {
  try {
    const supabase = await createClient();

    const [nodesResult, edgesResult, recentResult] = await Promise.all([
      supabase
        .from("knowledge_nodes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("knowledge_edges")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("knowledge_nodes")
        .select("title")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return {
      totalNodes: nodesResult.count || 0,
      totalEdges: edgesResult.count || 0,
      recentConcepts: (recentResult.data || []).map((n: any) => n.title),
    };
  } catch (e) {
    console.error("Graph stats failed:", e);
    return { totalNodes: 0, totalEdges: 0, recentConcepts: [] };
  }
}
