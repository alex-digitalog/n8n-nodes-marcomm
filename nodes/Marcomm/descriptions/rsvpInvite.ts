import type { INodeProperties } from 'n8n-workflow';
import { csv, dateTime, forOps, idField, input, listControls, operation, pathWith } from './common';
import { recipientsField } from './shared-fields';

const R = 'rsvpInvite';
const ID = 'rsvpInviteId';

export const rsvpInviteOperations = [
  operation({ name: 'Add Recipients', value: 'addRecipients', action: 'Add recipients to an RSVP invitation', description: 'Add people to the invitation list', method: 'POST', url: pathWith('rsvp-invites', ID, '/recipients') }),
  operation({ name: 'Create', value: 'create', action: 'Create an RSVP invitation', description: 'Create an RSVP invitation, optionally for a press event', method: 'POST', url: '/rsvp-invites' }),
  operation({ name: 'Get', value: 'get', action: 'Get an RSVP invitation', description: 'Get one invitation with its recipients and answers', method: 'GET', url: pathWith('rsvp-invites', ID) }),
  operation({ name: 'Get Many', value: 'getAll', action: 'Get many RSVP invitations', description: 'List RSVP invitations', method: 'GET', url: '/rsvp-invites' }),
  operation({ name: 'Send', value: 'send', action: 'Send an RSVP invitation', description: 'Email the invitation to its recipients. This cannot be undone.', method: 'POST', url: pathWith('rsvp-invites', ID, '/send'), fixedBody: { confirm: true } }),
  operation({ name: 'Update', value: 'update', action: 'Update an RSVP invitation', description: 'Change the title and the email of an invitation', method: 'PATCH', url: pathWith('rsvp-invites', ID) }),
];

export const rsvpInviteFields: INodeProperties[] = [
  ...idField(R, ID, ['addRecipients', 'get', 'send', 'update'], 'RSVP Invitation'),
  ...forOps(R, ['create'], [
    input('title', 'Title', 'Name of the invitation.', { required: true }),
    input('eventId', 'Press Event ID', 'Press event the invitation belongs to.'),
  ]),
  ...forOps(R, ['update'], [
    {
      displayName: 'Update Fields',
      name: 'updateFields',
      type: 'collection',
      placeholder: 'Add field',
      default: {},
      options: [input('title', 'Title', 'New name.'), input('subject', 'Email Subject', 'Subject of the invitation email.'), input('previewText', 'Preview Text', 'Short text shown next to the subject.'), input('emailCategoryId', 'Email Category ID', 'ID of the email category.')],
    } as INodeProperties,
  ]),
  ...forOps(R, ['addRecipients'], [recipientsField()]),
  ...forOps(R, ['send'], [
    { displayName: 'This emails the invitation and cannot be undone. Use Test Addresses to send a test first.', name: 'sendNotice', type: 'notice', default: '' } as INodeProperties,
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add option',
      default: {},
      options: [csv('testTo', 'Test Addresses', 'Send only to these addresses as a test.'), csv('recipientIds', 'Recipient IDs', 'Send only to these recipients.'), dateTime('scheduledAt', 'Send At', 'Send later instead of now.')],
    } as INodeProperties,
  ]),
  ...listControls(R, 'getAll', {
    cursor: false,
    max: 100,
    filters: [
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        default: 'draft',
        options: [
          { name: 'Draft', value: 'draft' },
          { name: 'Scheduled', value: 'scheduled' },
          { name: 'Sending', value: 'sending' },
          { name: 'Sent', value: 'sent' },
        ],
        routing: { send: { type: 'query', property: 'status' } },
      } as INodeProperties,
    ],
  }),
];
