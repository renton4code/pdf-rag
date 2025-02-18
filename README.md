# ⚡️ PDF RAG Kickstart template

A production-ready template for building Retrieval-Augmented Generation (RAG) applications. This template provides a complete setup for document processing, vector storage, and AI-powered question answering and kickass UI.

## Features

- 📄 PDF document processing with OCR
- 📚 Multi-document conversation context with filtering
- 🎯 Click-to-view document references with highlighting
- 💾 Milvus DB with billions of vectors scale support
- 🌐 Slick web interface
- 🔄 Large documents processing and status updates


## Architecture

The application is built using a microservices architecture with the following components:

- **BFF (Backend for Frontend)**: API gateway handling client requests
- **Index Service**: Processes and indexes documents
- **Query Service**: Handles question answering using RAG
- **Marker Server**: Converts PDFs to markdown format
- **Web App**: React-based frontend interface
- **Milvus**: Vector DB for storing embeddings
- **PostgreSQL**: Relational DB for metadata storage

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind, Shadcn
- **Backend**: Bun, Node.js
- **Databases**: PostgreSQL, Milvus
- **AI/ML**: Google Gemini (LLM), HuggingFace Transformers (Embeddings)

## Getting Started

### Prerequisites

- Docker
- Google Cloud API key for Gemini

### Installation

1. Clone the repository:

```bash
git clone https://github.com/renton4code/pdf-rag.git
cd pdf-rag
```

2. Set up environment variables:

```bash
export GEMINI_API_KEY=<your-gemini-api-key>
```

3. Build and start the application:

```bash
docker compose up --build
```

4. Access the application at `http://localhost:5173`


## Usage

1. **Upload Documents**
   - Drag and drop PDF files into the web interface
   - Toggle OCR processing for scanned/handwritten documents
   - Monitor processing status in real-time

2. **Chat Interface**
   - Start new conversations
   - Filter documents for specific contexts
   - View document references in responses
   - Click references to view source documents

## Local Development

### Change the embedding model

- Change the embedding model in the `services/index/embedder.ts` file
- Change the vector dimensions in the `services/index/milvus-client.ts` file

### Change the LLM provider/model/prompt

- Change the LLM in the `services/query/index.ts` file



