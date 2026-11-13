import type { INodeProperties } from 'n8n-workflow';
import { FORCE, csv, dateTime, forOps, idField, input, listControls, operation, pathWith, pollFilters } from './common';
import { approverField } from './shared-fields';

const R = 'blogPost';
const ID = 'blogPostId';

const contentFields = (): INodeProperties[] => [
  input('subtitle', 'Subtitle', 'Line below the title.'),
  input('excerpt', 'Excerpt', 'Short summary shown in lists.', { typeOptions: { rows: 3 } }),
  input('seoTitle', 'SEO Title', 'Title for search results.'),
  input('seoDescription', 'SEO Description', 'Description for search results.'),
  csv('seoKeywords', 'SEO Keywords', 'Up to 10 keywords.'),
];

export const blogPostOperations = [
  operation({ name: 'Create', value: 'create', action: 'Create a blog post draft', description: 'Create a blog post draft', method: 'POST', url: '/blog-posts' }),
  operation({ name: 'Get', value: 'get', action: 'Get a blog post', description: 'Get one blog post with its text', method: 'GET', url: pathWith('blog-posts', ID) }),
  operation({ name: 'Get Many', value: 'getAll', action: 'Get many blog posts', description: 'List blog posts, newest first', method: 'GET', url: '/blog-posts', list: true }),
  operation({ name: 'Publish', value: 'publish', action: 'Publish a blog post', description: 'Publish to the public blog now, or at a set time. This cannot be undone.', method: 'POST', url: pathWith('blog-posts', ID, '/publish'), fixedBody: { confirm: true } }),
  operation({ name: 'Request Approval', value: 'requestApproval', action: 'Request approval for a blog post', description: 'Send the draft to the approvers', method: 'POST', url: pathWith('blog-posts', ID, '/request-approval') }),
  operation({ name: 'Update', value: 'update', action: 'Update a blog post draft', description: 'Change a draft or rejected blog post', method: 'PATCH', url: pathWith('blog-posts', ID) }),
];

export const blogPostFields: INodeProperties[] = [
  ...idField(R, ID, ['get', 'update', 'requestApproval', 'publish'], 'Blog Post'),
  ...forOps(R, ['create'], [
    input('title', 'Title', 'Title of the post.', { required: true }),
    input('body', 'Body', 'Plain text of the post. Up to 50,000 characters.', { required: true, typeOptions: { rows: 8 } }),
    { displayName: 'Additional Fields', name: 'additionalFields', type: 'collection', placeholder: 'Add field', default: {}, options: contentFields() } as INodeProperties,
  ]),
  ...forOps(R, ['update'], [
    {
      displayName: 'Update Fields',
      name: 'updateFields',
      type: 'collection',
      placeholder: 'Add field',
      default: {},
      options: [input('title', 'Title', 'New title.'), input('body', 'Body', 'New plain text. Up to 50,000 characters.', { typeOptions: { rows: 8 } }), ...contentFields()],
    } as INodeProperties,
  ]),
  ...forOps(R, ['requestApproval'], [dateTime('deadline', 'Deadline', 'When the approvers must decide.'), approverField()]).map((p) => (p.name === 'deadline' ? { ...p, required: true } : p)),
  ...forOps(R, ['publish'], [
    { displayName: 'This publishes the post to the public blog and cannot be undone.', name: 'publishNotice', type: 'notice', default: '' } as INodeProperties,
    { displayName: 'Options', name: 'options', type: 'collection', placeholder: 'Add option', default: {}, options: [dateTime('scheduledAt', 'Publish At', 'Publish at this time instead of now.'), FORCE] } as INodeProperties,
  ]),
  ...listControls(R, 'getAll', { cursor: true, max: 50, filters: pollFilters(['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'REJECTED', 'ARCHIVED']) }),
];
