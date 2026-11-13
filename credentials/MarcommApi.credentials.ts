import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class MarcommApi implements ICredentialType {
  name = 'marcommApi';
  displayName = 'Marcomm AI API';
  documentationUrl = 'https://marcomm.works/developers';
  icon = { light: 'file:marcomm.svg', dark: 'file:marcomm.dark.svg' } as const;

  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'A personal API key from Settings > API in your Marcomm AI workspace. Writing, sending and approving need a personal key with the content:write, distribution and approvals scopes.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
  };

  // GET /me works with any valid key, whatever its scopes, so a key without the "content" scope still passes the test.
  test: ICredentialTestRequest = {
    request: { baseURL: 'https://marcomm.works/api/v1', url: '/me' },
  };
}
