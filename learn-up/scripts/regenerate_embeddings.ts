import { createClient } from "@supabase/supabase-js";
import { getAIEmbedding } from "../src/lib/ai";
import * as dotenv from "dotenv";

// Load environment variables from .env.local or .env
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function regenerateEmbeddings() {
  console.log("Fetching knowledge nodes...");
  
  // Fetch all nodes that might need embedding updates
  const { data: nodes, error } = await supabase
    .from("knowledge_nodes")
    .select("id, title, description");

  if (error) {
    console.error("Error fetching knowledge nodes:", error);
    process.exit(1);
  }

  if (!nodes || nodes.length === 0) {
    console.log("No knowledge nodes found to update.");
    return;
  }

  console.log(`Found ${nodes.length} nodes to process.`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const node of nodes) {
    try {
      const textToEmbed = `${node.title}\n${node.description || ""}`.trim();
      if (!textToEmbed) continue;
      
      console.log(`Generating embedding for node ${node.id} ("${node.title}")...`);
      
      const newEmbedding = await getAIEmbedding(textToEmbed);
      
      const { error: updateError } = await supabase
        .from("knowledge_nodes")
        .update({ embedding: newEmbedding })
        .eq("id", node.id);
        
      if (updateError) {
        console.error(`Failed to update node ${node.id}:`, updateError);
        errorCount++;
      } else {
        updatedCount++;
        console.log(`Successfully updated node ${node.id}`);
      }
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e: any) {
      console.error(`Error processing node ${node.id}:`, e.message);
      errorCount++;
    }
  }

  console.log(`\n--- Finished Regeneration ---`);
  console.log(`Total processed: ${nodes.length}`);
  console.log(`Successfully updated: ${updatedCount}`);
  console.log(`Errors: ${errorCount}`);
}

regenerateEmbeddings().catch(console.error);
