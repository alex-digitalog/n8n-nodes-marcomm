import type { INodeProperties } from 'n8n-workflow';
import { FORCE, forOps, idField, input, operation, pathWith } from './common';

const R = 'approval';

export const approvalOperations = [
  operation({ name: 'Approve Blog Post', value: 'approveBlogPost', action: 'Approve a blog post', description: 'Approve a blog post that waits for your decision', method: 'POST', url: pathWith('approvals/blog-posts', 'blogPostId'), fixedBody: { decision: 'approve' } }),
  operation({ name: 'Approve Press Release', value: 'approvePressRelease', action: 'Approve a press release', description: 'Approve a press release that waits for your decision', method: 'POST', url: pathWith('approvals/press-releases', 'pressReleaseId'), fixedBody: { decision: 'approve' } }),
  operation({ name: 'Get Pending', value: 'getPending', action: 'Get pending approvals', description: 'List the items that wait for your decision', method: 'GET', url: '/approvals' }),
  operation({ name: 'Reject Blog Post', value: 'rejectBlogPost', action: 'Reject a blog post', description: 'Send a blog post back with a comment', method: 'POST', url: pathWith('approvals/blog-posts', 'blogPostId'), fixedBody: { decision: 'reject' } }),
  operation({ name: 'Reject Press Release', value: 'rejectPressRelease', action: 'Reject a press release', description: 'Send a press release back with a comment', method: 'POST', url: pathWith('approvals/press-releases', 'pressReleaseId'), fixedBody: { decision: 'reject' } }),
];

const comment = (required: boolean): INodeProperties => input('comment', 'Comment', required ? 'Why the item is rejected. The author sees it.' : 'Optional note for the author.', { required, typeOptions: { rows: 3 } });

export const approvalFields: INodeProperties[] = [
  ...idField(R, 'pressReleaseId', ['approvePressRelease', 'rejectPressRelease'], 'Press Release'),
  ...idField(R, 'blogPostId', ['approveBlogPost', 'rejectBlogPost'], 'Blog Post'),
  ...forOps(R, ['rejectPressRelease', 'rejectBlogPost'], [comment(true)]),
  ...forOps(R, ['approvePressRelease', 'approveBlogPost'], [comment(false)]),
  ...forOps(R, ['approvePressRelease', 'approveBlogPost', 'rejectPressRelease', 'rejectBlogPost'], [
    { displayName: 'Options', name: 'options', type: 'collection', placeholder: 'Add option', default: {}, options: [FORCE] } as INodeProperties,
  ]),
];
