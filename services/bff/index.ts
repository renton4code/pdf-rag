import { milvus } from "../index/milvus-client";


const server = Bun.serve({
  port: 3023,
  async fetch(request) {
    try {
      const url = new URL(request.url);
      
      // CORS headers for development
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      // List documents
      if (url.pathname === "/documents" && request.method === "GET") {
        const documents = await Bun.sql(`
          SELECT id, name, status, format 
          FROM documents 
          ORDER BY name ASC
        `);
        
        return new Response(JSON.stringify(documents), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      // Get single document
      if (url.pathname.startsWith("/documents/") && request.method === "GET") {
        const id = url.pathname.split("/")[2];
        const [document] = await Bun.sql`
          SELECT content, name, format 
          FROM documents 
          WHERE id = ${id}
        `;

        if (!document || !document.content || document.content.length === 0) {
          return new Response("Document not found", { status: 404, headers: corsHeaders });
        }


        return new Response(document.content, {
          headers: {
            ...corsHeaders,
            "Content-Type": document.format,
            "Content-Disposition": `attachment; filename="${document.name}"`,
          },
        });
      }

      // Delete document
      if (url.pathname.startsWith("/documents/") && request.method === "DELETE") {
        const id = url.pathname.split("/")[2];
        
        // Delete from Postgres
        await Bun.sql(`DELETE FROM documents WHERE id = $1`, [id]);
        
        // Delete from Milvus
        const res = await milvus.getClient()?.delete({
          collection_name: "documents",
          filter: `document_id == '${id}'`,
        });

        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // Upload document
      if (url.pathname === "/documents" && request.method === "POST") {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
          return new Response("No file provided", { status: 400, headers: corsHeaders });
        }

        const forceOCR = url.searchParams.get("force_ocr") === "true";

        // Forward to indexing service
        const indexResponse = await fetch(`http://localhost:3021${forceOCR ? "?force_ocr=true" : ""}`, {
          method: "POST",
          body: formData,
        });

        if (!indexResponse.ok) {
          return new Response("Failed to process document", { 
            status: 500, 
            headers: corsHeaders 
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      return new Response("Not found", { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error("Error processing request:", error);
      return new Response("Internal server error", { status: 500 });
    }
  },
});

console.log(`BFF service listening on http://localhost:${server.port}`); 