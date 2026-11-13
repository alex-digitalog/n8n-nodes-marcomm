import type { INodeProperties, INodePropertyOptions, INodeTypeDescription } from 'n8n-workflow';
import { addIdempotencyKey, normalizeRequest, paginateByCursor, unwrapData } from '../shared/request';

type Prop = INodeProperties;
type Where = 'body' | 'qs';

/** One input that goes into the request body or the query string under the same name the API uses. */
export function input(
  name: string,
  displayName: string,
  description: string,
  extra: Partial<Prop> = {},
  where: Where = 'body',
): Prop {
  return { displayName, name, type: 'string', default: '', description, routing: { send: { type: where, property: name } }, ...extra } as Prop;
}

export const bool = (name: string, displayName: string, description: string, where: Where = 'body'): Prop =>
  ({ displayName, name, type: 'boolean', default: false, description, routing: { send: { type: where, property: name } } }) as Prop;

export const dateTime = (name: string, displayName: string, description: string, where: Where = 'body'): Prop =>
  input(name, displayName, `${description} A date without a time zone offset is read in the workflow time zone.`, { type: 'dateTime' }, where);

export const csv = (name: string, displayName: string, description: string): Prop =>
  input(name, displayName, `${description} Comma separated.`);

export const FORCE = bool('force', 'Ignore Warnings', 'Go ahead even when Marcomm AI shows warnings about the content, for example banned phrases.');

/** Shows a property only for these operations of a resource. */
export function forOps(resource: string, operations: string[], props: Prop[]): Prop[] {
  return props.map((p) => ({ ...p, displayOptions: { ...(p.displayOptions ?? {}), show: { resource: [resource], operation: operations, ...(p.displayOptions?.show ?? {}) } } }));
}

export function idField(resource: string, name: string, operations: string[], label: string): Prop[] {
  return forOps(resource, operations, [
    { displayName: `${label} ID`, name, type: 'string', required: true, default: '', description: `ID of the ${label.toLowerCase()}. Use Get Many to find it, or map it from a previous node.` } as Prop,
  ]);
}

/** Adds the preSend/postReceive steps all operations share. `write` adds the Idempotency-Key header. */
export interface OpSpec {
  name: string;
  value: string;
  action: string;
  description: string;
  method: 'GET' | 'POST' | 'PATCH';
  /** n8n expression or plain path below https://marcomm.works/api/v1 */
  url: string;
  /** Hidden request body fields set by the node, for example confirm: true. */
  fixedBody?: Record<string, unknown>;
  /** List operations that page through results. */
  list?: boolean;
}

export function operation(spec: OpSpec): INodePropertyOptions {
  const write = spec.method !== 'GET';
  return {
    name: spec.name,
    value: spec.value,
    action: spec.action,
    description: spec.description,
    routing: {
      request: { method: spec.method, url: spec.url, ...(spec.fixedBody ? { body: spec.fixedBody } : {}) },
      send: { preSend: write ? [normalizeRequest, addIdempotencyKey] : [normalizeRequest] },
      output: { postReceive: [unwrapData] },
      ...(spec.list ? { operations: { pagination: paginateByCursor } } : {}),
    },
  } as INodePropertyOptions;
}

export const pathWith = (base: string, idParam: string, suffix = ''): string => `=/${base}/{{encodeURIComponent($parameter.${idParam})}}${suffix}`;

export function operationSelector(resource: string, ops: INodePropertyOptions[], defaultOp: string): Prop {
  return { displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true, displayOptions: { show: { resource: [resource] } }, options: ops, default: defaultOp };
}

/** Return All, Limit and the paging options of a polling list. `max` is the largest limit the API takes. */
export function listControls(resource: string, operationName: string, opts: { cursor: boolean; max: number; filters: Prop[] }): Prop[] {
  const only = [operationName];
  const props: Prop[] = [];
  if (opts.cursor) {
    props.push({
      displayName: 'Return All',
      name: 'returnAll',
      type: 'boolean',
      default: false,
      description: 'Whether to return all results or only up to a given limit',
      routing: { send: { paginate: '={{ $value }}' } },
    } as Prop);
  }
  props.push({
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 50,
    typeOptions: { minValue: 1, maxValue: opts.max },
    description: 'Max number of results to return',
    ...(opts.cursor ? { displayOptions: { show: { returnAll: [false] } } } : {}),
    routing: { send: { type: 'query', property: 'limit' } },
  } as Prop);
  const optionFields: Prop[] = [...opts.filters];
  if (opts.cursor) {
    optionFields.push(
      input('cursor', 'Cursor', 'Continue after this cursor, the next_cursor value of an earlier page.', {}, 'qs'),
      { displayName: 'Return Page Info', name: 'returnPageInfo', type: 'boolean', default: false, description: 'Whether to return one item with data (the page) and next_cursor, to page by hand with the Cursor option. Not used with Return All.' } as Prop,
    );
  }
  if (optionFields.length) {
    props.push({ displayName: 'Options', name: 'options', type: 'collection', placeholder: 'Add option', default: {}, options: optionFields } as Prop);
  }
  return forOps(resource, only, props);
}

/** Filters shared by the three polling lists. */
export function pollFilters(statuses: string[]): Prop[] {
  const firstStatus = statuses[0] as string;
  return [
    {
      displayName: 'Status',
      name: 'status',
      type: 'options',
      default: firstStatus,
      options: statuses.map((s) => ({ name: s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()), value: s })),
      description: 'Only items in this status',
      routing: { send: { type: 'query', property: 'status' } },
    } as Prop,
    {
      displayName: 'Sort By',
      name: 'sort',
      type: 'options',
      default: 'created',
      options: [
        { name: 'Created', value: 'created' },
        { name: 'Last Changed', value: 'updated' },
      ],
      description: 'Newest first by creation time or by last change',
      routing: { send: { type: 'query', property: 'sort' } },
    } as Prop,
    dateTime('updated_since', 'Changed Since', 'Only items changed after this time.', 'qs'),
  ];
}

export type NodeDescription = INodeTypeDescription;
