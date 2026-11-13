import type { INodeProperties } from 'n8n-workflow';
import { bool, dateTime, forOps, idField, input, listControls, operation, pathWith, pollFilters } from './common';

const R = 'pressEvent';
const ID = 'pressEventId';

const eventType = (): INodeProperties =>
  ({
    displayName: 'Event Type',
    name: 'eventType',
    type: 'options',
    default: 'PRESS_CONFERENCE',
    options: [
      { name: 'Interview', value: 'INTERVIEW' },
      { name: 'Media Day', value: 'MEDIA_DAY' },
      { name: 'Other', value: 'OTHER' },
      { name: 'Press Conference', value: 'PRESS_CONFERENCE' },
      { name: 'Product Launch', value: 'PRODUCT_LAUNCH' },
    ],
    routing: { send: { type: 'body', property: 'eventType' } },
  }) as INodeProperties;

const eventFields = (): INodeProperties[] => [
  input('description', 'Description', 'What the event is about.', { typeOptions: { rows: 3 } }),
  eventType(),
  input('venueName', 'Venue Name', 'Name of the place.'),
  input('venueAddress', 'Venue Address', 'Street address.'),
  input('meetingUrl', 'Meeting URL', 'Link for an online event.'),
  dateTime('startAt', 'Starts At', 'When the event starts.'),
  dateTime('endAt', 'Ends At', 'When the event ends.'),
  input('categoryId', 'Category ID', 'ID of the event category.'),
];

export const pressEventOperations = [
  operation({ name: 'Create', value: 'create', action: 'Create a press event', description: 'Create a press event', method: 'POST', url: '/press-events' }),
  operation({ name: 'Get', value: 'get', action: 'Get a press event', description: 'Get one press event', method: 'GET', url: pathWith('press-events', ID) }),
  operation({ name: 'Get Many', value: 'getAll', action: 'Get many press events', description: 'List press events', method: 'GET', url: '/press-events', list: true }),
  operation({ name: 'Update', value: 'update', action: 'Update a press event', description: 'Change a press event', method: 'PATCH', url: pathWith('press-events', ID) }),
];

export const pressEventFields: INodeProperties[] = [
  ...idField(R, ID, ['get', 'update'], 'Press Event'),
  ...forOps(R, ['create'], [
    input('title', 'Title', 'Name of the event.', { required: true }),
    { displayName: 'Additional Fields', name: 'additionalFields', type: 'collection', placeholder: 'Add field', default: {}, options: eventFields() } as INodeProperties,
  ]),
  ...forOps(R, ['update'], [
    {
      displayName: 'Update Fields',
      name: 'updateFields',
      type: 'collection',
      placeholder: 'Add field',
      default: {},
      options: [input('title', 'Title', 'New name.'), ...eventFields(), input('inviteSubject', 'Invitation Subject', 'Subject of the invitation email.'), input('inviteMessage', 'Invitation Message', 'Text of the invitation email.', { typeOptions: { rows: 3 } })],
    } as INodeProperties,
  ]),
  ...listControls(R, 'getAll', {
    cursor: true,
    max: 50,
    filters: [...pollFilters(['PLANNING', 'IN_REVIEW', 'REJECTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']), bool('upcomingOnly', 'Upcoming Only', 'Whether to return only events that have not ended yet.', 'qs')],
  }),
];
