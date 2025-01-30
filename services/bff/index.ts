import { milvus } from "../index/milvus-client";

// Endpoint handlers
async function listDocuments(corsHeaders: Record<string, string>) {
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

async function getDocument(id: string, corsHeaders: Record<string, string>) {
  const [document] = await Bun.sql`
    SELECT content, name, format 
    FROM documents 
    WHERE id = ${id}
  `;

  if (!document || !document.content || document.content.length === 0) {
    return new Response("Document not found", {
      status: 404,
      headers: corsHeaders,
    });
  }

  return new Response(document.content, {
    headers: {
      ...corsHeaders,
      "Content-Type": document.format,
      "Content-Disposition": `attachment; filename="${document.name}"`,
    },
  });
}

async function deleteDocument(id: string, corsHeaders: Record<string, string>) {
  // Delete from Postgres
  await Bun.sql(`DELETE FROM documents WHERE id = $1`, [id]);

  // Delete from Milvus
  await milvus.getClient()?.delete({
    collection_name: "documents",
    filter: `document_id == '${id}'`,
  });

  return new Response(null, { status: 204, headers: corsHeaders });
}

async function uploadDocument(
  formData: FormData,
  forceOCR: boolean,
  corsHeaders: Record<string, string>
) {
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return new Response("No file provided", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Forward to indexing service
  const indexResponse = await fetch(
    `http://localhost:3021${forceOCR ? "?force_ocr=true" : ""}`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!indexResponse.ok) {
    return new Response("Failed to process document", {
      status: 500,
      headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function getChats(corsHeaders: Record<string, string>) {
  const chats = await Bun.sql(`
    SELECT id, name, created_at 
    FROM chats 
    ORDER BY created_at DESC
  `);

  return new Response(JSON.stringify(chats), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function getMessages(
  chatId: string,
  corsHeaders: Record<string, string>
) {
  let messages = [];
  if (chatId !== "new") {
    messages = await Bun.sql(`
      SELECT id, role, content, created_at 
      FROM messages 
      WHERE chat_id = '${chatId}'
      ORDER BY created_at ASC
    `);
  }

  return new Response(JSON.stringify(messages), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function postMessage(
  message: string,
  chatId: string,
  documents: string[],
  corsHeaders: Record<string, string>
) {
  if (chatId === "new") {
    const chatRowData = {
      id: Bun.randomUUIDv7(),
      name: `${message.slice(0, 30)}...`,
    };
    chatId = chatRowData.id;
    await Bun.sql`INSERT INTO chats ${Bun.sql(chatRowData)}`;
  }

  const userMessageRowData = {
    id: Bun.randomUUIDv7(),
    chat_id: chatId,
    content: message,
    role: "user",
  };

  await Bun.sql`INSERT INTO messages ${Bun.sql(userMessageRowData)}`;

  const queryResponse = await makeQuery(message, documents, corsHeaders);

  const assistantMessageRowData = {
    id: Bun.randomUUIDv7(),
    chat_id: chatId,
    content: JSON.stringify(queryResponse),
    role: "assistant",
  };

  console.log(JSON.stringify(assistantMessageRowData));

  const [assistantMessage] = await Bun.sql`INSERT INTO messages ${Bun.sql(
    assistantMessageRowData
  )} RETURNING *`;

  return new Response(JSON.stringify(assistantMessage), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function makeQuery(
  query: string,
  documents: string[],
  corsHeaders: Record<string, string>
) {
  const response = await fetch("http://localhost:3022", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, documents }),
  });
  return response.json();
}

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

      // Route requests to handlers
      if (url.pathname === "/documents" && request.method === "GET") {
        return listDocuments(corsHeaders);
      }

      if (url.pathname.startsWith("/documents/") && request.method === "GET") {
        const id = url.pathname.split("/")[2];
        return getDocument(id, corsHeaders);
      }

      if (
        url.pathname.startsWith("/documents/") &&
        request.method === "DELETE"
      ) {
        const id = url.pathname.split("/")[2];
        return deleteDocument(id, corsHeaders);
      }

      if (url.pathname === "/documents" && request.method === "POST") {
        const formData = await request.formData();
        const forceOCR = url.searchParams.get("force_ocr") === "true";
        return uploadDocument(formData, forceOCR, corsHeaders);
      }

      if (url.pathname === "/chats" && request.method === "GET") {
        return getChats(corsHeaders);
      }

      if (url.pathname.startsWith("/messages/") && request.method === "GET") {
        const chatId = url.pathname.split("/")[2];
        return getMessages(chatId, corsHeaders);
      }

      if (url.pathname === "/messages" && request.method === "POST") {
        const { message, chatId, documents } = await request.json();
        return postMessage(message, chatId, documents, corsHeaders);
      }

      return new Response("Not found", { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error("Error processing request:", error);
      return new Response("Internal server error", { status: 500 });
    }
  },
});

console.log(`BFF service listening on http://localhost:${server.port}`);
