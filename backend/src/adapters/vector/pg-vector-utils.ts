export const PGVECTOR_EMBEDDING_DIMENSIONS = 1024;

export function toPgVectorLiteral(
  embedding: readonly number[],
  valueName = "Embedding",
): string {
  if (embedding.length !== PGVECTOR_EMBEDDING_DIMENSIONS) {
    throw new RangeError(
      `${valueName} must contain ${PGVECTOR_EMBEDDING_DIMENSIONS} dimensions`,
    );
  }

  return `[${embedding.map((value) => formatVectorValue(value, valueName)).join(",")}]`;
}

function formatVectorValue(value: number, valueName: string): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${valueName} contains a non-finite value`);
  }

  return value.toString();
}