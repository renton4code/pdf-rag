import {
  pipeline,
  env,
  FeatureExtractionPipeline,
} from "@huggingface/transformers";


// TODO: Replace with a standalone embedding model run in docker container and Python
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
