import { Embedder } from "../index/embedder";
import { milvus } from "../index/milvus-client";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  systemInstruction: "You are a corporate lawyer assistant helping a lawyer to make some analysis of various documents. You're given a set of text passages from such documents and a question from the lawyer. Based on the text passages try to answer the question based on ground truth from the document passages.",
});

// Configure generation parameters
const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
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
    const context = searchResults?.results.map(r => r.$meta.chunk_text).join('\n\n') ?? '';
    const prompt = `Context:\n${context}\n\nQuestion: ${query}`;

    console.log(`Sending prompt to Gemini: ${prompt}`);
    const llmResponse = await model.generateContent(prompt);
    console.log('Received response from Gemini');

    return new Response(
      JSON.stringify({
        searchResults: searchResults?.results.map(({ score, $meta }) => ({ score, $meta })) ?? [],
        llmResponse: llmResponse.response.text(),
      }),
      { status: 200 }
    );
  },
});

console.log(`Listening on localhost:${server.port}`);
