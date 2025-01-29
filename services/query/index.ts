import { Embedder } from "../index/embedder";
import { milvus } from "../index/milvus-client";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  systemInstruction:
    "You are a corporate lawyer assistant helping a lawyer to make some analysis of documents. You're given a set of texts from these documents and a question from the lawyer. Based on ground truth from these texts try to answer the question. You should return a JSON object with the following properties: text (the answer to the question), references (indexes of most relevant texts that you used to answer the question). Do not include justification for your answer. Do not include text indexes references in your answer.",
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
        type: "string",
      },
      references: {
        type: "array",
        items: {
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

    const { query } = await request.json();

    console.log(`Querying for ${query}`);

    const embedder = await Embedder.getInstance();
    const { data: embeddingsRaw } = await embedder(query, {
      pooling: "mean",
      normalize: true,
    });

    console.log(`Query was embedded`);

    const searchResults = await milvus.search({
      collection_name: "documents",
      vector: embeddingsRaw,
      topk: 5,
    });

    // Start chat session and send message
    const context =
      searchResults?.results
        .map((r, index) => `Text #${index + 1}. ${r.$meta.chunk_text}`)
        .join("\n\n") ?? "";
    const prompt = `Context: ${context}\n\nQuestion: ${query}`;

    console.log(`Sending prompt to Gemini: ${prompt}`);
    const llmResponse = await model.generateContent(prompt);
    console.log("Received response from Gemini");

    const text = llmResponse.response.text();
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    const structuredResponse = match ? JSON.parse(match[1]) : text;

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
