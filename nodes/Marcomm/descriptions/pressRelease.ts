import type { INodeProperties } from 'n8n-workflow';
import { FORCE, bool, csv, dateTime, forOps, idField, input, listControls, operation, pathWith, pollFilters } from './common';
import { approverField } from './shared-fields';

const R = 'pressRelease';
const ID = 'pressReleaseId';

/** Fields of a press release body, shared by Create (extra fields) and Update. */
const contentFields = (): INodeProperties[] => [
  input('subtitle', 'Subtitle', 'Line below the title.'),
  input('leadParagraph', 'Lead Paragraph', 'Opening paragraph shown above the body.', { typeOptions: { rows: 3 } }),
  input('language', 'Language', 'Language code of the text, for example en or ko.'),
  input('categoryId', 'Category ID', 'ID of the press release category.'),
  bool('embargoEnabled', 'Embargo', 'Whether only approved journalists can read the release until the embargo lifts.'),
  dateTime('embargoLiftsAt', 'Embargo Lifts At', 'When the embargo ends.'),
  dateTime('scheduledAt', 'Scheduled At', 'When the release goes public. Needs an approval request with a deadline afterwards.'),
  input('seoTitle', 'SEO Title', 'Title for search results.'),
  input('seoDescription', 'SEO Description', 'Description for search results.'),
  csv('seoKeywords', 'SEO Keywords', 'Up to 10 keywords.'),
];

export const pressReleaseOperations = [
  operation({ name: 'Create', value: 'create', action: 'Create a press release draft', description: 'Create a press release draft', method: 'POST', url: '/press-releases' }),
  operation({ name: 'Get', value: 'get', action: 'Get a press release', description: 'Get one press release with its text', method: 'GET', url: pathWith('press-releases', ID) }),
  operation({ name: 'Get Many', value: 'getAll', action: 'Get many press releases', description: 'List press releases, newest first', method: 'GET', url: '/press-releases', list: true }),
  operation({ name: 'Publish to Newsroom', value: 'publish', action: 'Publish a press release to the newsroom', description: 'Publish to the public newsroom. This cannot be undone.', method: 'POST', url: pathWith('press-releases', ID, '/publish'), fixedBody: { confirm: true } }),
  operation({ name: 'Request Approval', value: 'requestApproval', action: 'Request approval for a press release', description: 'Send the draft to the approvers', method: 'POST', url: pathWith('press-releases', ID, '/request-approval') }),
  operation({ name: 'Send by Email', value: 'send', action: 'Send a press release by email', description: 'Email the press release to journalists. This cannot be undone.', method: 'POST', url: pathWith('press-releases', ID, '/send'), fixedBody: { confirm: true } }),
  operation({ name: 'Update', value: 'update', action: 'Update a press release draft', description: 'Change a draft or rejected press release', method: 'PATCH', url: pathWith('press-releases', ID) }),
];

export const pressReleaseFields: INodeProperties[] = [
  ...idField(R, ID, ['get', 'update', 'requestApproval', 'publish', 'send'], 'Press Release'),
  ...forOps(R, ['create'], [
    input('title', 'Title', 'Headline of the press release.', { required: true }),
    input('body', 'Body', 'Plain text of the release. Up to 50,000 characters.', { required: true, typeOptions: { rows: 8 } }),
    { displayName: 'Additional Fields', name: 'additionalFields', type: 'collection', placeholder: 'Add field', default: {}, options: contentFields() } as INodeProperties,
  ]),
  ...forOps(R, ['update'], [
    {
      displayName: 'Update Fields',
      name: 'updateFields',
      type: 'collection',
      placeholder: 'Add field',
      default: {},
      options: [input('title', 'Title', 'New headline.'), input('body', 'Body', 'New plain text. Up to 50,000 characters.', { typeOptions: { rows: 8 } }), ...contentFields()],
    } as INodeProperties,
  ]),
  ...forOps(R, ['requestApproval'], [
    dateTime('deadline', 'Deadline', 'When the approvers must decide.'),
    approverField(),
  ]).map((p) => (p.name === 'deadline' ? { ...p, required: true } : p)),
  ...forOps(R, ['publish'], [{ displayName: 'This publishes the release to the public newsroom and cannot be undone.', name: 'publishNotice', type: 'notice', default: '' } as INodeProperties]),
  ...forOps(R, ['publish', 'send'], [{ displayName: 'Options', name: 'options', type: 'collection', placeholder: 'Add option', default: {}, options: [FORCE] } as INodeProperties]),
  ...forOps(R, ['send'], [
    { displayName: 'This emails the press release and cannot be undone.', name: 'sendNotice', type: 'notice', default: '' } as INodeProperties,
    input('subject', 'Subject', 'Email subject line.', { required: true }),
    csv('to', 'To', 'Email addresses. Give at least one of To or Group IDs, up to 500 together.'),
    csv('groupIds', 'Journalist Group IDs', 'IDs of Press CRM journalist groups.'),
    { displayName: 'Additional Fields', name: 'additionalFields', type: 'collection', placeholder: 'Add field', default: {}, options: [csv('cc', 'CC', 'Up to 5 addresses.'), bool('includeNewsroom', 'Include Newsroom Link', 'Whether the email links to the newsroom page.'), dateTime('scheduledAt', 'Send At', 'Send later instead of now.')] } as INodeProperties,
  ]),
  ...listControls(R, 'getAll', { cursor: true, max: 50, filters: pollFilters(['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'REJECTED', 'SEND_FAILED']) }),
];
