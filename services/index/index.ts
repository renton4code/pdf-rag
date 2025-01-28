import { Embedder } from "./embedder";
import { ParsePDF } from "./marker-client";
import { milvus } from "./milvus-client";

const STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
}

const server = Bun.serve({
  port: 3021,
  fetch: async (request) => {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Accept a POST request with a single file in the body
    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!fileEntry || !(fileEntry instanceof File)) {
      return new Response("No file provided", { status: 400 });
    }

    const document_id = Bun.randomUUIDv7();
    const fileBuffer = await fileEntry.arrayBuffer();

    await Bun.sql`
    INSERT INTO documents (id, content, name, format, status) 
      VALUES (${document_id}, ${Buffer.from(fileBuffer)}, ${fileEntry.name}, ${fileEntry.type}, ${STATUSES.PENDING})
    `;
    console.log("Inserted document into Postgres!");

    const url = new URL(request.url);
    const forceOCR = url.searchParams.get("force_ocr") === "true";

    spawnIndexJob(document_id, fileEntry, forceOCR);

    return new Response(JSON.stringify({ document_id }), { status: 200 });
  },
});

console.log(`Listening on localhost:${server.port}`);


async function spawnIndexJob(document_id: string, file: File, forceOCR: boolean) {
  await Bun.sql`
    UPDATE documents 
    SET status = ${STATUSES.PROCESSING}
    WHERE id = ${document_id}
  `;

  // Forward file to marker server
  const { output, success } = await ParsePDF(document_id, file, forceOCR);

  if (!success) {
    await Bun.sql`
      UPDATE documents 
      SET status = ${STATUSES.FAILED}
      WHERE id = ${document_id}
    `;
    return;
  }

  const cleanedOutput = output
      .split("\n")
      .filter((line: string) => line.trim() !== "")
      .filter((line: string) => !line.startsWith("![]")) // Remove images
      .join("\n");

    console.log("Document was parsed");

    // Split document into chunks
    const chunkSize = 512;
    const overlap = 30;
    const chunks: string[] = [];
    
    let startIndex = 0;
    while (startIndex < cleanedOutput.length) {
      const chunk = cleanedOutput.slice(
        startIndex,
        Math.min(startIndex + chunkSize, cleanedOutput.length)
      );
      chunks.push(chunk);
      startIndex += chunkSize - overlap;
    }

    console.log(`Split into ${chunks.length} chunks`);

    // Extract embeddings for each chunk
    const embedder = await Embedder.getInstance();
    let lastPageNumber = 0;
    const allEmbeddings = await Promise.all(
      chunks.map(async (chunk) => {
        // Extract page numbers from chunk text
        const pageNumbers = [...chunk.matchAll(/\{(\d+)\}------------------------------------------------/g)]
          .map(match => parseInt(match[1]))
          .sort((a,b) => a - b);
        const page_id = pageNumbers.length > 0 ? pageNumbers.join('-') : String(lastPageNumber);
        lastPageNumber = pageNumbers.at(-1) ?? lastPageNumber;

        // Remove page markers from chunk text
        const cleanedChunk = chunk.replace(/\{\d+\}------------------------------------------------/g, '').trim();

        const { data: embeddingsRaw } = await embedder(cleanedChunk, {
          pooling: "mean",
          normalize: true,
        });
        return {
          document_id,
          chunk_id: `${document_id}_${Bun.randomUUIDv7()}`,
          page_id,
          chunk_text: cleanedChunk,
          chunk_embedding: Array.from(embeddingsRaw) as number[],
        }
      })
    );

    console.log(`Generated embeddings for all chunks: length=${allEmbeddings.length}, dim=${allEmbeddings[0].chunk_embedding.length}`);

    // Insert embeddings into Milvus
    await milvus.batchInsert(allEmbeddings, 0);

    console.log("Inserted embeddings into Milvus!");

    await Bun.sql`
      UPDATE documents 
      SET status = ${STATUSES.COMPLETED}
      WHERE id = ${document_id}
    `;
}