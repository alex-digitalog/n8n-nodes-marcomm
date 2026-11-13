/**
 * Idempotency keys for every write. The Marcomm API runs a request once per (API key, Idempotency-Key) and answers a retry
 * with the first result, so a retried "send" never mails twice. The key must be the same for a retry of the same item and
 * different for every other call, so it is built from where the call sits in the workflow run:
 * execution id + node id + run index (loops) + item index + operation.
 */
export const IDEMPOTENCY_KEY_MAX = 200;

export interface IdempotencyParts {
  /** Empty only when n8n does not give an execution id (some test runs). The key then changes with the clock. */
  executionId?: string;
  nodeId: string;
  runIndex: number;
  itemIndex: number;
  resource: string;
  operation: string;
  /** Test hook for the clock fallback. */
  now?: number;
}

export function buildIdempotencyKey(p: IdempotencyParts): string {
  // ponytail: no random id when n8n gives no execution id. A clock tick keeps manual test clicks from replaying
  // an old result, and costs retry safety only in that case. Needed elsewhere? Use a UUID from the n8n helpers.
  const run = p.executionId?.trim() || `manual-${(p.now ?? Date.now()).toString(36)}`;
  const key = ['n8n', run, p.nodeId, p.runIndex, p.itemIndex, `${p.resource}.${p.operation}`].join(':');
  return key.slice(0, IDEMPOTENCY_KEY_MAX);
}
