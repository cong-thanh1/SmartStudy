/**
 * Bundle-time replacement for @huggingface/transformers in the Bedrock-only
 * Lambda. The production environment selects Bedrock and never invokes this.
 */
export async function pipeline(): Promise<never> {
  throw new Error("Local embedding is not included in the Bedrock Lambda");
}
