import {
  NodeApiError,
  NodeConnectionTypes,
  NodeOperationError,
  type IDataObject,
  type IPollFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
  type JsonObject,
} from 'n8n-workflow';
import { MARCOMM_API_URL } from '../Marcomm/Marcomm.node';
import { collectPages, PAGE_SIZE } from '../Marcomm/shared/pagination';
import { describeApiError } from '../Marcomm/shared/request';
import { baseline, eventByValue, EVENTS, POLL_MAX_PAGES, processRows, type PollState, type Row } from './poll';

export class MarcommTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Marcomm AI Trigger',
    name: 'marcommTrigger',
    icon: { light: 'file:marcomm.svg', dark: 'file:marcomm.dark.svg' },
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["event"]}}',
    description: 'Starts a workflow when a press release, blog post or press event changes in Marcomm AI',
    defaults: { name: 'Marcomm AI Trigger' },
    polling: true,
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      { name: 'marcommApi', required: true, displayOptions: { show: { authentication: ['apiKey'] } } },
      { name: 'marcommOAuth2Api', required: true, displayOptions: { show: { authentication: ['oAuth2'] } } },
    ],
    properties: [
      {
        displayName: 'Authentication',
        name: 'authentication',
        type: 'options',
        noDataExpression: true,
        default: 'apiKey',
        options: [
          { name: 'API Key', value: 'apiKey' },
          { name: 'OAuth2', value: 'oAuth2' },
        ],
      },
      {
        displayName: 'Event',
        name: 'event',
        type: 'options',
        default: 'pressReleasePublished',
        options: EVENTS.map((e) => ({ name: e.name, value: e.value, description: e.description })),
      },
      {
        displayName: 'The key or OAuth app needs the content scope. The trigger checks for changes on the polling interval and sends nothing on the first check.',
        name: 'pollNotice',
        type: 'notice',
        default: '',
      },
    ],
  };

  async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
    const event = eventByValue(this.getNodeParameter('event') as string);
    if (!event) throw new NodeOperationError(this.getNode(), 'Unknown event.');

    const listMeta: { next: string | null } = { next: null };
    const list = async (qs: IDataObject): Promise<Row[]> => {
      try {
        const res = (await this.helpers.httpRequestWithAuthentication.call(this, this.getNodeParameter('authentication', 'apiKey') === 'oAuth2' ? 'marcommOAuth2Api' : 'marcommApi', { method: 'GET', baseURL: MARCOMM_API_URL, url: `/${event.resource}`, qs, json: true })) as {
          data?: Row[];
          meta?: { next_cursor?: string | null };
        };
        listMeta.next = res.meta?.next_cursor ?? null;
        return Array.isArray(res.data) ? res.data : [];
      } catch (error) {
        const failed = error as { httpCode?: string; statusCode?: number; response?: { body?: unknown; status?: number }; context?: { data?: unknown } };
        const status = Number(failed.httpCode ?? failed.statusCode ?? failed.response?.status ?? 0);
        const { message, description } = describeApiError(status, failed.response?.body ?? failed.context?.data);
        throw new NodeApiError(this.getNode(), error as JsonObject, status ? { message, description, httpCode: String(status) } : {});
      }
    };
    const paged = (qs: IDataObject, max?: number) =>
      collectPages<Row>(async (cursor, pageSize) => ({ rows: await list({ ...qs, limit: pageSize, ...(cursor ? { cursor } : {}) }), next: listMeta.next }), { max });
    const filter: IDataObject = event.filterStatus ? { status: event.filterStatus } : {};

    // Test button in the editor: show the newest item, change nothing.
    if (this.getMode() === 'manual') {
      const shown = event.filterStatus ?? event.baselineStatus;
      const [latest] = await list({ ...(shown ? { status: shown, sort: 'updated' } : { sort: 'created' }), limit: 1 });
      if (!latest) throw new NodeOperationError(this.getNode(), 'Nothing to show yet. Create one in Marcomm AI and test again.');
      return [[{ json: latest as IDataObject }]];
    }

    const data = this.getWorkflowStaticData('node') as IDataObject;
    const state = data[event.value] as PollState | undefined;

    if (!state) {
      const [newest] = await list({ ...filter, sort: 'updated', limit: 1 });
      const watched = event.baselineStatus ? await paged({ status: event.baselineStatus, sort: 'updated' }, PAGE_SIZE * 10) : [];
      data[event.value] = baseline(event, newest, watched) as unknown as IDataObject;
      return null;
    }

    const rows = await paged({ ...filter, sort: 'updated', updated_since: state.since }, PAGE_SIZE * POLL_MAX_PAGES);
    const result = processRows(event, state, rows);
    data[event.value] = result.state as unknown as IDataObject;
    return result.emit.length ? [result.emit.map((json) => ({ json: json as IDataObject }))] : null;
  }
}
