import type {
  DeclarativeRestApiSettings,
  IExecutePaginationFunctions,
  IExecuteSingleFunctions,
  IDataObject,
  IHttpRequestOptions,
  IN8nHttpFullResponse,
  INodeExecutionData,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { buildIdempotencyKey } from './idempotency';
import { normalizeParams } from './normalize';
import { collectPages } from './pagination';

/** What to do next, by API error code (the codes are the ones in the API reference). */
const HINTS: Record<string, string> = {
  scope_denied: 'The API key or OAuth app does not have the scope this action needs. Add the scope in Settings > API in Marcomm AI (an OAuth app also needs it in its own scope list and in the credential Scope field), then connect again.',
  personal_key_required: 'Writing, sending and approving need a personal API key or an OAuth connection made by a person. A workspace key cannot do this.',
  invalid_key: 'The API key or access token is not valid any more. Create a new key, or reconnect the OAuth credential.',
  forbidden: 'This workspace or person is not allowed to use the API right now. Check the plan, the API approval and the member role in Marcomm AI.',
  plan_required: 'The API needs the Team plan or higher.',
  access_required: 'API access has not been approved for this workspace. Request it in Settings > API.',
  suspended: 'API access for this workspace is suspended. Contact Marcomm AI support.',
  rate_limited: 'The rate limit of this workspace was reached. Try again after the time in the Retry-After header.',
  confirmation_required: 'This action cannot be undone, so it needs confirmation.',
  publish_held: 'The item is scheduled or under embargo and cannot be published before its release time.',
  approval_required: 'This workspace requires approval before publishing. Request approval first.',
};

/** One readable message for an error answer: "Marcomm AI (scope_denied): <API message> <what to do>". */
export function describeApiError(statusCode: number, body: unknown): { message: string; description: string } {
  const err = ((body ?? {}) as { error?: { code?: string; message?: string } }).error ?? {};
  const code = typeof err.code === 'string' ? err.code : `http_${statusCode}`;
  const text = typeof err.message === 'string' && err.message ? err.message : `The request failed with status ${statusCode}.`;
  return { message: `Marcomm AI (${code}): ${text}`, description: HINTS[code] ?? '' };
}

/** preSend for every operation: list, date and approver/recipient fields into the shapes the API takes. */
export async function normalizeRequest(this: IExecuteSingleFunctions, options: IHttpRequestOptions): Promise<IHttpRequestOptions> {
  // Error answers come back to unwrapData, which turns them into a message that says what went wrong and what to do.
  options.ignoreHttpStatusErrors = true;
  const timeZone = this.getTimezone();
  normalizeParams(options.body as IDataObject | undefined, timeZone);
  normalizeParams(options.qs as IDataObject | undefined, timeZone);
  return options;
}

/** preSend for every write: a stable Idempotency-Key, so a retried item runs once on the Marcomm side. */
export async function addIdempotencyKey(this: IExecuteSingleFunctions, options: IHttpRequestOptions): Promise<IHttpRequestOptions> {
  let executionId: string | undefined;
  try {
    executionId = this.getExecutionId();
  } catch {
    executionId = undefined;
  }
  const key = buildIdempotencyKey({
    executionId,
    nodeId: this.getNode().id,
    runIndex: this.getExecuteData().runIndex ?? 0,
    itemIndex: this.getItemIndex(),
    resource: String(this.getNodeParameter('resource', '')),
    operation: String(this.getNodeParameter('operation', '')),
  });
  options.headers = { ...options.headers, 'Idempotency-Key': key };
  return options;
}

const asRows = (data: unknown): INodeExecutionData[] =>
  (Array.isArray(data) ? data : [data]).map((row) => ({ json: (row && typeof row === 'object' ? row : { value: row }) as IDataObject }));

/**
 * postReceive: answers are `{ data, meta? }`. One item per row for lists, one item for a single record.
 * With "Return All" the envelope stays, because the pagination function below needs `meta.next_cursor`.
 */
export async function unwrapData(this: IExecuteSingleFunctions, items: INodeExecutionData[], response: IN8nHttpFullResponse): Promise<INodeExecutionData[]> {
  if (typeof response.statusCode === 'number' && response.statusCode >= 400) {
    const { message, description } = describeApiError(response.statusCode, response.body);
    throw new NodeApiError(this.getNode(), (response.body ?? {}) as JsonObject, { message, description, httpCode: String(response.statusCode) });
  }
  if (this.getNodeParameter('returnAll', false) === true) return items;
  const body = (response.body ?? {}) as { data?: unknown; meta?: { next_cursor?: string | null } };
  const data = body.data === undefined ? body : body.data;
  if (this.getNodeParameter('options.returnPageInfo', false) === true && Array.isArray(data)) {
    return [{ json: { data, next_cursor: body.meta?.next_cursor ?? null } as IDataObject }];
  }
  return asRows(data);
}

/** Pagination for the list operations when "Return All" is on: follows meta.next_cursor 50 rows at a time. */
export async function paginateByCursor(this: IExecutePaginationFunctions, requestData: DeclarativeRestApiSettings.ResultOptions): Promise<INodeExecutionData[]> {
  const baseQs = { ...(requestData.options.qs ?? {}) } as IDataObject;
  const rows = await collectPages<IDataObject>(
    async (cursor, pageSize) => {
      requestData.options.qs = { ...baseQs, limit: pageSize, ...(cursor ? { cursor } : {}) };
      const res = await this.makeRoutingRequest(requestData);
      const body = (res[0]?.json ?? {}) as { data?: IDataObject[]; meta?: { next_cursor?: string | null } };
      return { rows: Array.isArray(body.data) ? body.data : [], next: body.meta?.next_cursor ?? null };
    },
    { startCursor: typeof baseQs.cursor === 'string' ? baseQs.cursor : undefined },
  );
  return rows.map((json) => ({ json }));
}
