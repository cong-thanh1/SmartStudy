import type { APIRequestContext } from '@playwright/test';

/**
 * API helpers for test data cleanup.
 * These helpers call the backend API directly (not through the UI) to clean up
 * test artifacts created during test runs.
 *
 * Per PLAYWRIGHT_TEST_GOAL.md §0 rule 7:
 *   "mỗi test tự tạo dữ liệu riêng... và tự dọn dẹp ở bước afterAll"
 *
 * Uses Playwright's APIRequestContext which automatically attaches the auth token
 * from the loaded storageState.
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

/**
 * Retrieve JWT token from browser localStorage via stored state context.
 * The token is stored under key 'smartstudy_access_token'.
 */
function getAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Get access token from Playwright storageState.
 * The token is saved in localStorage from the auth setup step.
 */
export async function getTokenFromStorage(request: APIRequestContext): Promise<string> {
  // We call /auth/refresh with the stored refresh token,
  // but since request context already has cookies/localStorage from storageState,
  // we can retrieve the token by checking the API behavior.
  // Simplest: store token in a file during auth setup.
  // For now, extract from process.env.E2E_ACCESS_TOKEN set by auth setup helper.
  return process.env.E2E_ACCESS_TOKEN || '';
}

/** Delete a document by ID via API */
export async function deleteDocumentById(request: APIRequestContext, docId: string, token: string): Promise<void> {
  const response = await request.delete(`${API_BASE}/documents/${docId}`, {
    headers: getAuthHeaders(token),
  });
  if (!response.ok()) {
    console.warn(`[API Helper] Failed to delete document ${docId}: ${response.status()}`);
  }
}

/** List all documents for the authenticated user */
export async function listDocuments(request: APIRequestContext, token: string): Promise<Array<{ id: string; title: string; status: string }>> {
  const response = await request.get(`${API_BASE}/documents`, {
    headers: getAuthHeaders(token),
  });
  if (!response.ok()) {
    console.warn(`[API Helper] Failed to list documents: ${response.status()}`);
    return [];
  }
  const body = await response.json() as { documents: Array<{ id: string; title: string; status: string }> };
  return body.documents || [];
}

/** Delete all documents whose title starts with the given prefix */
export async function deleteDocumentsByTitlePrefix(
  request: APIRequestContext,
  token: string,
  titlePrefix: string
): Promise<number> {
  const docs = await listDocuments(request, token);
  const targets = docs.filter((d) => d.title.startsWith(titlePrefix));
  let deleted = 0;
  for (const doc of targets) {
    await deleteDocumentById(request, doc.id, token);
    deleted++;
  }
  if (deleted > 0) {
    console.log(`[API Helper] Cleaned up ${deleted} test document(s) with prefix: ${titlePrefix}`);
  }
  return deleted;
}

/** Upload a document via API (bypass UI for faster setup) */
export async function uploadDocumentViaApi(
  request: APIRequestContext,
  token: string,
  title: string,
  pdfBuffer: Buffer,
  baseUrl = 'http://localhost:3000'
): Promise<string | null> {
  // Step 1: Get presigned URL
  const presignResp = await request.post(`${API_BASE}/documents/upload-url`, {
    headers: getAuthHeaders(token),
    data: {
      title,
      contentType: 'application/pdf',
      sizeBytes: pdfBuffer.length,
    },
  });

  if (!presignResp.ok()) {
    console.error(`[API Helper] Failed to get presigned URL: ${presignResp.status()} ${await presignResp.text()}`);
    return null;
  }

  const presignBody = await presignResp.json() as {
    document: { id: string };
    upload: { url: string; method: string; headers?: Record<string, string> };
  };

  const docId = presignBody.document.id;
  const uploadUrl = presignBody.upload.url;
  const uploadHeaders = presignBody.upload.headers || {};

  // Step 2: Upload to MinIO
  const uploadResp = await request.fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf', ...uploadHeaders },
    data: pdfBuffer,
  });

  if (!uploadResp.ok()) {
    console.error(`[API Helper] Failed to upload to MinIO: ${uploadResp.status()}`);
    return null;
  }

  // Step 3: Complete upload
  const completeResp = await request.post(`${API_BASE}/documents/${docId}/complete`, {
    headers: getAuthHeaders(token),
    data: {},
  });

  if (!completeResp.ok()) {
    console.error(`[API Helper] Failed to complete upload: ${completeResp.status()}`);
    return null;
  }

  return docId;
}

/** Poll document status until it becomes 'ready' or times out */
export async function waitForDocumentReady(
  request: APIRequestContext,
  token: string,
  docId: string,
  timeoutMs = 60_000,
  pollIntervalMs = 2_000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const resp = await request.get(`${API_BASE}/documents/${docId}`, {
      headers: getAuthHeaders(token),
    });
    if (resp.ok()) {
      const body = await resp.json() as { document: { status: string } };
      if (body.document?.status === 'ready') return true;
      if (body.document?.status === 'failed') {
        console.warn(`[API Helper] Document ${docId} processing failed`);
        return false;
      }
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  console.warn(`[API Helper] Document ${docId} did not become ready within ${timeoutMs}ms`);
  return false;
}
