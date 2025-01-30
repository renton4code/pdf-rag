import {
  pipeline,
  env,
  FeatureExtractionPipeline,
} from "@huggingface/transformers";


// TODO: Use mixedbread-ai/mxbai-embed-large-v1 
export class Embedder {
  static task = "feature-extraction";
  static model = "Supabase/gte-small";
  static instance: FeatureExtractionPipeline;

  static async getInstance() {
    if (!this.instance) {
      env.cacheDir = "./.cache";
      this.instance = await pipeline("feature-extraction", this.model);
    }

    return this.instance;
  }
}
