import type { ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * Sign in with OAuth instead of a key. A workspace admin creates the OAuth app in Settings > API and pastes its client ID and secret here.
 * The node then acts as the person who allows it, with the permissions of a personal key.
 */
export class MarcommOAuth2Api implements ICredentialType {
  name = 'marcommOAuth2Api';
  extends = ['oAuth2Api'];
  displayName = 'Marcomm AI OAuth2 API';
  documentationUrl = 'https://marcomm.works/developers';
  icon = { light: 'file:marcomm.svg', dark: 'file:marcomm.dark.svg' } as const;

  properties: INodeProperties[] = [
    { displayName: 'Grant Type', name: 'grantType', type: 'hidden', default: 'authorizationCode' },
    { displayName: 'Authorization URL', name: 'authUrl', type: 'hidden', default: 'https://marcomm.works/oauth/authorize', required: true },
    { displayName: 'Access Token URL', name: 'accessTokenUrl', type: 'hidden', default: 'https://marcomm.works/api/oauth/token', required: true },
    { displayName: 'Auth URI Query Parameters', name: 'authQueryParameters', type: 'hidden', default: '' },
    { displayName: 'Authentication', name: 'authentication', type: 'hidden', default: 'header' },
    {
      displayName: 'Scope',
      name: 'scope',
      type: 'string',
      default: 'content',
      description: 'Space-separated scopes. Reading needs content. Writing needs content:write, sending needs distribution, approving needs approvals. The OAuth app and your workspace API approval must include them.',
    },
  ];
}
