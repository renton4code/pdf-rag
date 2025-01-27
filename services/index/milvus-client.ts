import {
  type InsertReq,
  MilvusClient,
  type MutationResult,
  type QueryReq,
  type SearchSimpleReq,
} from "@zilliz/milvus2-sdk-node";

const DIM = 384; // model Supabase/gte-small embedding dimension
export const COLLECTION_NAME = "documents";
export const VECTOR_FIELD_NAME = "vector";
export const METRIC_TYPE = "COSINE";
export const INDEX_TYPE = "AUTOINDEX";

export enum COLLECTION_KEYS {
  DOCUMENT_ID = "document_id",
  CHUNK_ID = "chunk_id",
  PAGE_ID = "page_id",
  CHUNK_TEXT = "chunk_text",
  CHUNK_EMBEDDING = "chunk_embedding",
}

class Milvus {
  private _client: MilvusClient | undefined;
  private _MAX_INSERT_COUNT = 100;
  private _insert_progress = 0;
  private _is_inserting = false;
  private _error_msg = "";

  constructor() {
    if (!this._client) {
      this.init(); // Initialize the Milvus client
    }
  }

  // Get the Milvus client
  public getClient() {
    return this._client;
  }

  // Check if a collection exists
  public async hasCollection() {
    return await this._client?.hasCollection({
      collection_name: COLLECTION_NAME,
    });
  }

  // Initialize the Milvus client
  public async init() {
    // URI is required to connect to Milvus, TOKEN is optional
    if (!process.env.URI) {
      throw new Error("URI is required, please check your .env file.");
    }

    try {
      // Create a new Milvus client
      this._client = new MilvusClient({
        address: process.env.URI || "",
        token: process.env.TOKEN,
        channelOptions: {
          // starter cluster will throw rejected by server because of excess ping, so we need to adjust the ping interval
          "grpc.keepalive_time_ms": 40000, // Adjust the time interval between pings
          "grpc.keepalive_timeout_ms": 5000, // Adjust the time to wait for a response to a ping
        },
      });
      // Create a new collection
      return await this.createCollection();
    } catch (error) {
      throw error;
    }
  }

  // Create a new collection
  public async createCollection() {
    try {
      // Check if the collection exists
      const res = await this.hasCollection();
      if (res?.value) {
        return res;
      }
      // Create a new collection
      const collectionRes = await this._client?.createCollection({
        collection_name: COLLECTION_NAME,
        dimension: DIM,
        metric_type: METRIC_TYPE,
        auto_id: true,
      });

      return collectionRes;
    } catch (error) {
      throw error;
    }
  }

  // List all collections
  public async listCollections() {
    const res = await this._client?.listCollections();
    return res;
  }

  // Query data from a collection
  public async query(data: QueryReq) {
    return await this._client?.query(data);
  }

  // Search for data in a collection
  public async search(data: SearchSimpleReq) {
    return await this._client?.search({
      ...data,
    });
  }

  // Insert data into a collection
  public async insert(data: InsertReq) {
    try {
      const res = await this._client?.insert(data);
      return res;
    } catch (error) {
      throw error;
    }
  }

  // Insert data in batches, for example, 1000 data, insert 100 each time
  public async batchInsert(
    items: { [key in COLLECTION_KEYS]: string | number[] }[],
    startIndex: number
  ): Promise<MutationResult | undefined> {
    try {
      const total = items.length;
      const endIndex = Math.min(startIndex + this._MAX_INSERT_COUNT, total);
      const insertItems = items.slice(startIndex, endIndex);
      this._is_inserting = true;

      if (startIndex === 0) {
        this._insert_progress = 0;
      }
      
      // Array to hold the data to be inserted
      const insertDatas = [];
      for (let i = 0; i < insertItems.length; i++) {
        const item = insertItems[i] as any;

        // Prepare the data to be inserted into the Milvus collection
        insertDatas.push({
          vector: item[COLLECTION_KEYS.CHUNK_EMBEDDING],
          [COLLECTION_KEYS.DOCUMENT_ID]: item[COLLECTION_KEYS.DOCUMENT_ID],
          [COLLECTION_KEYS.CHUNK_ID]: item[COLLECTION_KEYS.CHUNK_ID],
          [COLLECTION_KEYS.PAGE_ID]: item[COLLECTION_KEYS.PAGE_ID],
          [COLLECTION_KEYS.CHUNK_TEXT]: item[COLLECTION_KEYS.CHUNK_TEXT],
        });
      }

      // Insert the data into Milvus
      const res = await milvus.insert({
        fields_data: insertDatas,
        collection_name: COLLECTION_NAME,
      });
      // Update the progress
      this._insert_progress = Math.floor((endIndex / total) * 100);

      console.log(
        `--- ${startIndex} ~ ${endIndex} insert done, ${this._insert_progress}% now ---`
      );
      
      if (endIndex < total) {
        return await this.batchInsert(items, endIndex);
      }
      
      this._insert_progress = 100;
      this._is_inserting = false;
      return res;
    } catch (error) {
      this._insert_progress = 0;
      this._is_inserting = false;
      this._error_msg = (error as any).message || "Insert failed";
    }
  }

  // Get the progress of the insert operation
  get insertProgress() {
    return this._insert_progress;
  }

  // Check if data is being inserted
  get isInserting() {
    return this._is_inserting;
  }

  // Get the error message
  get errorMsg() {
    return this._error_msg;
  }
}

// Create a singleton instance of the Milvus class
const milvus = new Milvus();

export { milvus };
