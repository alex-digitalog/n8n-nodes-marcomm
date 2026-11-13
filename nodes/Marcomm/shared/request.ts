import type {
  DeclarativeRestApiSettings,
  IExecutePaginationFunctions,
  IExecuteSingleFunctions,
  IDataObject,
  IHttpRequestOptions,
  IN8nHttpFullResponse,
  INodeExecutionData,
} from 'n8n-workflow';
import { buildIdempotencyKey } from './idempotency';
import { normalizeParams } from './normalize';
import { collectPages } from './pagination';

/** preSend for every operation: list, date and approver/recipient fields into the shapes the API takes. */
export async function normalizeRequest(this: IExecuteSingleFunctions, options: IHttpRequestOptions): Promise<IHttpRequestOptions> {
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
