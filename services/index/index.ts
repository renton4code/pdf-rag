import { Embedder } from "./embedder";
import { parsePDF } from "./marker-client";
import { milvus } from "./milvus-client";

const STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
};

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
      VALUES (${document_id}, ${Buffer.from(fileBuffer)}, ${fileEntry.name}, ${
      fileEntry.type
    }, ${STATUSES.PENDING})
    `;
    console.log("Inserted document into Postgres!");

    const url = new URL(request.url);
    const forceOCR = url.searchParams.get("force_ocr") === "true";

    spawnIndexJob(document_id, fileEntry, forceOCR);

    return new Response(JSON.stringify({ document_id }), { status: 200 });
  },
});

console.log(`Listening on localhost:${server.port}`);

async function spawnIndexJob(
  document_id: string,
  file: File,
  forceOCR: boolean
) {
  await Bun.sql`
    UPDATE documents 
    SET status = ${STATUSES.PROCESSING}
    WHERE id = ${document_id}
  `;

  // Forward file to marker server
  const { output, success } = await parsePDF(document_id, file, forceOCR);

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

  // Store parsed document pages in Postgres
  const pages = cleanedOutput.split(/\{\d+\}------------------------------------------------/g)
    .slice(1)
    .map((p, index) => ({
      id: `${Bun.randomUUIDv7()}`,
      document_id,
      page_number: index,
      content: p,
    }));
  
  await Bun.sql`INSERT INTO pages ${Bun.sql(pages)}`;

  // Split document into chunks
  const chunks = text2chunks(cleanedOutput);

  console.log(`Split into ${chunks.length} chunks`);

  // Extract embeddings for chunks
  const allEmbeddings = await chunks2vectors(chunks, document_id);

  console.log(
    `Generated embeddings for all chunks: length=${allEmbeddings.length}, dim=${allEmbeddings[0].chunk_embedding.length}`
  );

  // Insert embeddings into Milvus
  await milvus.batchInsert(allEmbeddings, 0);

  console.log("Inserted embeddings into Milvus!");

  await Bun.sql`
      UPDATE documents 
      SET status = ${STATUSES.COMPLETED}
      WHERE id = ${document_id}
    `;
}

function text2chunks(text: string) {
  // Split document into chunks
  const chunkSize = 512;
  const overlap = 30;
  const chunks: string[] = [];

  let startIndex = 0;
  while (startIndex < text.length) {
    console.log(`Processing chunk ${startIndex} to ${startIndex + chunkSize}`);
    // Find the end of the last complete word within or after chunk size
    let endIndex = Math.min(startIndex + chunkSize, text.length);
    if (endIndex < text.length) {
      // Limit the search for word boundary to prevent infinite loops
      const maxSearchDistance = 50; // Maximum characters to look ahead
      let searchCount = 0;
      while (
        endIndex < text.length &&
        text[endIndex] !== " " &&
        searchCount < maxSearchDistance
      ) {
        endIndex++;
        searchCount++;
      }
      // If we couldn't find a space, force a break
      if (searchCount >= maxSearchDistance) {
        endIndex = Math.min(startIndex + chunkSize, text.length);
      }
    }

    const chunk = text.slice(startIndex, endIndex);
    chunks.push(chunk);

    // Ensure we always make forward progress
    const newStart = startIndex + chunkSize - overlap;
    if (newStart <= startIndex) {
      startIndex += chunkSize; // Force progress if overlap would cause us to stay in place
    } else {
      startIndex = newStart;
      // Look for word boundary, but don't go backwards too far
      const maxBackwardSearch = 20;
      let backwardCount = 0;
      while (
        startIndex > 0 &&
        text[startIndex - 1] !== " " &&
        backwardCount < maxBackwardSearch
      ) {
        startIndex--;
        backwardCount++;
      }
    }
  }

  return chunks;
}

async function chunks2vectors(chunks: string[], document_id: string) {
  const embedder = await Embedder.getInstance();
  let lastPageNumber = 0;
  return Promise.all(
    chunks.map(async (chunk) => {
      // Extract page numbers from chunk text
      const pageNumbers = [
        ...chunk.matchAll(
          /\{(\d+)\}------------------------------------------------/g
        ),
      ]
        .map((match) => parseInt(match[1]))
        .sort((a, b) => a - b);
      const page_id =
        pageNumbers.length > 0 ? pageNumbers.join("-") : String(lastPageNumber);
      lastPageNumber = pageNumbers.at(-1) ?? lastPageNumber;

      // Remove page markers from chunk text
      const cleanedChunk = chunk
        .replace(/\{\d+\}------------------------------------------------/g, "")
        .trim();

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
      };
    })
  );
}