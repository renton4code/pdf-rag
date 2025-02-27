import { Embedder } from "../index/embedder";
import { milvus } from "../index/milvus-client";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  systemInstruction:
    "You are an AI assistant that can answer questions based on the provided texts. You're given a set of texts from documents and a question. Based on the provided texts, try to answer the question accurately and concisely. Do not include justification for your answer. Do not include text indexes references in your answer, but include them in the references array. You MUST follow the JSON structure: { text: 'The answer to the question', references: [1, 2, 3] }",
});

// Configure generation parameters
const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
  responseSchema: {
    type: "object",
    properties: {
      text: {
        description: "The answer to the question",
        type: "string",
      },
      references: {
        type: "array",
        items: {
          description: "Indexes of the most relevant texts that you used to answer the question",
          type: "number",
        },
      },
    },
    required: ["text", "references"],
  },
};

const server = Bun.serve({
  port: 3022,
  fetch: async (request) => {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { query, documents } = await request.json();

    console.log(`Querying for ${query}`);

    const embedder = await Embedder.getInstance();
    const { data: embeddingsRaw } = await embedder(query, {
      pooling: "mean",
      normalize: true,
    });

    console.log(`Query was embedded`);

    const searchParams = {
      collection_name: "documents",
      vector: embeddingsRaw,
      topk: 5,
      filter: documents?.length > 0 ? `document_id in [${documents.map(d => `'${d}'`).join(",")}]` : undefined,
    };

    const searchResults = await milvus.search(searchParams);

    // Start chat session and send message
    const context =
      searchResults?.results
        .map((r, index) => `Text #${index + 1}. ${r.$meta.chunk_text}`)
        .join("\n\n") ?? "";
    const prompt = `Context: ${context}\n\nQuestion: ${query}`;

    console.log(`Sending prompt to Gemini: ${prompt}`);
    const llmResponse = await model.generateContent(prompt);
    console.log("Received response from Gemini");

    const text = llmResponse.response.text().replace(/\n/g, "");
    const match = text.match(/```json(.*?)```/s);

    let structuredResponse = { text: text, references: [] };
    try {
      // Clean up all escaped characters that aren't valid JSON escapes
      const jsonText = match?.[1].replace(/\\([^"\\\/bfnrt])/g, '$1');
      console.log("JSON text", jsonText);
      console.log("Match 1", match?.[1]);
      structuredResponse = match && jsonText
        ? JSON.parse(jsonText)
        : { text: text, references: [] };
    } catch (e) {
      console.error("Error parsing response", e);
      console.error("Raw response", match?.[1]);
    }
    

    return new Response(
      JSON.stringify({
        searchResults:
          searchResults?.results.map(({ score, $meta }) => ({
            score,
            $meta,
          })) ?? [],
        llmResponse: structuredResponse,
      }),
      { status: 200 }
    );
  },
});

console.log(`Listening on localhost:${server.port}`);
