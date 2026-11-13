import type { INodeProperties } from 'n8n-workflow';

/** Approvers of an approval request. The node turns { approver: [...] } into the API's list. */
export const approverField = (): INodeProperties => ({
  displayName: 'Approvers',
  name: 'approvers',
  type: 'fixedCollection',
  typeOptions: { multipleValues: true },
  placeholder: 'Add approver',
  default: {},
  description: 'Who decides. Leave empty to use the approval flow set in the workspace.',
  options: [
    {
      displayName: 'Approver',
      name: 'approver',
      values: [
        { displayName: 'User ID', name: 'userId', type: 'string', default: '', description: 'ID of the workspace member' },
        {
          displayName: 'Role',
          name: 'role',
          type: 'options',
          default: 'approve',
          options: [
            { name: 'Approves', value: 'approve' },
            { name: 'Gets a Copy (CC)', value: 'cc' },
          ],
        },
      ],
    },
  ],
  routing: { send: { type: 'body', property: 'approvers' } },
});

/** RSVP recipients. The node turns { recipient: [...] } into the API's list. */
export const recipientsField = (): INodeProperties => ({
  displayName: 'Recipients',
  name: 'recipients',
  type: 'fixedCollection',
  typeOptions: { multipleValues: true },
  placeholder: 'Add recipient',
  default: {},
  required: true,
  description: 'People to invite. Marcomm AI skips addresses on the suppression list when sending.',
  options: [
    {
      displayName: 'Recipient',
      name: 'recipient',
      values: [
        { displayName: 'Name', name: 'name', type: 'string', default: '', required: true },
        { displayName: 'Email', name: 'email', type: 'string', placeholder: 'name@example.com', default: '', required: true },
        { displayName: 'Outlet', name: 'outletName', type: 'string', default: '', description: 'Media outlet of the person' },
        { displayName: 'Press CRM Contact ID', name: 'contactId', type: 'string', default: '', description: 'Links the recipient to a journalist in the Press CRM' },
      ],
    },
  ],
  routing: { send: { type: 'body', property: 'recipients' } },
});
