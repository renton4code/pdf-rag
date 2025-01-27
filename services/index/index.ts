import { Embedder } from "./embedder";
import { milvus } from "./milvus-client";

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

    // Forward file to marker server
    const markerFormData = new FormData();
    // TODO: solve timeout issue when OCR is enabled
    markerFormData.append("force_ocr", "false");
    markerFormData.append("paginate_output", "true");
    markerFormData.append("output_format", "markdown");
    markerFormData.append("file", fileEntry);

    const markerResponse = await fetch("http://localhost:8001/marker/upload", {
      method: "POST",
      body: markerFormData
    });

    const { output, success } = await markerResponse.json();
    if (!success) {
      return new Response("Failed to parse file", { status: 200 });
    }

    const cleanedOutput = output
      .split("\n")
      .filter((line: string) => line.trim() !== "")
      .filter((line: string) => !line.startsWith("![]")) // Remove images
      .join("\n");

    console.log("Parsed document:", cleanedOutput);
    const document_id = Bun.randomUUIDv7();

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

    console.log("Generated embeddings for all chunks:", allEmbeddings.map(e => e.chunk_id));

    // Insert embeddings into Milvus
    await milvus.batchInsert(allEmbeddings, 0);

    console.log("Inserted embeddings into Milvus!");

    // Insert document into Postgres
    const fileBuffer = await fileEntry.arrayBuffer();
    await Bun.sql`
      INSERT INTO documents (content, name, format) 
      VALUES (${Buffer.from(fileBuffer)}, ${fileEntry.name}, ${fileEntry.type})
    `;

    console.log("Inserted document into Postgres!");

    return new Response(JSON.stringify(allEmbeddings), { status: 200 });
  },
});

console.log(`Listening on localhost:${server.port}`);
