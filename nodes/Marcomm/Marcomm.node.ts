import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { approvalFields, approvalOperations } from './descriptions/approval';
import { blogPostFields, blogPostOperations } from './descriptions/blogPost';
import { operationSelector } from './descriptions/common';
import { pressEventFields, pressEventOperations } from './descriptions/pressEvent';
import { pressReleaseFields, pressReleaseOperations } from './descriptions/pressRelease';
import { rsvpInviteFields, rsvpInviteOperations } from './descriptions/rsvpInvite';

/** The one place the API address lives. The API is hosted by Marcomm AI and has no other address. */
export const MARCOMM_API_URL = 'https://marcomm.works/api/v1';

export class Marcomm implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Marcomm AI',
    name: 'marcomm',
    icon: { light: 'file:marcomm.svg', dark: 'file:marcomm.dark.svg' },
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Write, approve and publish press releases, blog posts, press events and RSVP invitations in Marcomm AI',
    defaults: { name: 'Marcomm AI' },
    usableAsTool: true,
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'marcommApi', required: true }],
    requestDefaults: {
      baseURL: MARCOMM_API_URL,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    },
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        default: 'pressRelease',
        options: [
          { name: 'Approval', value: 'approval' },
          { name: 'Blog Post', value: 'blogPost' },
          { name: 'Press Event', value: 'pressEvent' },
          { name: 'Press Release', value: 'pressRelease' },
          { name: 'RSVP Invitation', value: 'rsvpInvite' },
        ],
      },
      operationSelector('approval', approvalOperations, 'getPending'),
      operationSelector('blogPost', blogPostOperations, 'create'),
      operationSelector('pressEvent', pressEventOperations, 'create'),
      operationSelector('pressRelease', pressReleaseOperations, 'create'),
      operationSelector('rsvpInvite', rsvpInviteOperations, 'create'),
      ...approvalFields,
      ...blogPostFields,
      ...pressEventFields,
      ...pressReleaseFields,
      ...rsvpInviteFields,
    ],
  };
}
