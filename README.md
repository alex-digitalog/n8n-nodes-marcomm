# n8n-nodes-marcomm

n8n community nodes for [Marcomm AI](https://marcomm.works). Write press releases, blog posts, press events and RSVP invitations from a workflow, send them for approval, publish them to your newsroom and blog, email them to journalists, and start a workflow when something changes.

The nodes call the Marcomm AI public API (`https://marcomm.works/api/v1`, documented at [marcomm.works/developers](https://marcomm.works/developers)). Nothing else is contacted and the package has no runtime dependencies.

- **Marcomm AI** node: five resources, 28 operations.
- **Marcomm AI Trigger** node: polls for new and changed items.
- **Marcomm AI API** credential: a personal API key.

## Install

In n8n, open **Settings > Community Nodes**, choose **Install**, enter `n8n-nodes-marcomm` and confirm. See the [n8n guide to installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/) for self-hosted setups. After the install, search for "Marcomm AI" in the node panel.

## Credentials

1. In Marcomm AI open **Settings > API** and request API access for the workspace. A Marcomm AI team reviews the request.
2. Once approved, create a **personal** key and tick the scopes the workflow needs.
3. In n8n create a **Marcomm AI API** credential and paste the key.

| Scope | Lets the key |
| --- | --- |
| `content` | Read press releases, blog posts, press events and RSVP invitations (also used by the trigger) |
| `content:write` | Create and update drafts, request approval, add RSVP recipients |
| `distribution` | Publish to the newsroom and blog, email press releases and RSVP invitations |
| `approvals` | Approve or reject, list what waits for a decision |

Writing, sending and deciding need a personal key, because the action is recorded under the person who created the key. The permissions of that person in the workspace apply: a key never does more than its owner may do in the app. Calls count against the rate limits set for the workspace (the node shows the API error when a limit is reached).

## Marcomm AI node

| Resource | Operations |
| --- | --- |
| Press Release | Create, Update, Get, Get Many, Request Approval, Publish to Newsroom, Send by Email |
| Blog Post | Create, Update, Get, Get Many, Request Approval, Publish |
| Press Event | Create, Update, Get, Get Many |
| RSVP Invitation | Create, Update, Add Recipients, Get, Get Many, Send |
| Approval | Approve Press Release, Reject Press Release, Approve Blog Post, Reject Blog Post, Get Pending |

Input fields match the request bodies in the API reference. Fields such as SEO keywords, `To` and `CC` take comma separated text. Dates without a time zone offset are read in the workflow time zone and sent in UTC.

## Usage example

Two workflows are ready to import from the [`examples` folder](https://github.com/alex-digitalog/n8n-nodes-marcomm/tree/main/examples) of the public repository (in n8n use **Import from File** on a new workflow, then pick your credential):

- `rows-to-press-release-approval.json`: a spreadsheet row becomes a press release draft and goes to approval.
- `slack-on-published-press-release.json`: a Slack message when a press release is published.

### From a spreadsheet row to an approval request

1. Add a **Google Sheets** node that reads rows with the columns `Title` and `Body`.
2. Add a **Marcomm AI** node. Set **Resource** to *Press Release* and **Operation** to *Create*. Set **Title** to `{{ $json.Title }}` and **Body** to `{{ $json.Body }}`. Under **Additional Fields** set **Language** to `en`. The node returns the new draft, including its `id`.
3. Add a second **Marcomm AI** node. Set **Resource** to *Press Release* and **Operation** to *Request Approval*. Set **Press Release ID** to `{{ $json.id }}` and **Deadline** to `{{ $now.plus({ days: 2 }).toISO() }}`.
4. Run the workflow. The draft appears in the newsroom list in Marcomm AI with status *In review*, and the people on the approval chain are notified. The key needs the `content:write` scope.

Nothing is published until a person approves. The *Publish to Newsroom* and *Send by Email* operations cannot be undone, so add them only after you are sure the workflow is right.

### Start a workflow when a press release is published

1. Add a **Marcomm AI Trigger** node and set **Event** to *Press Release Published*. Leave the poll interval at 5 minutes or change it. The key needs the `content` scope.
2. Connect any node you like, for example **Slack** with the message `Published: {{ $json.title }}`.
3. Activate the workflow. The first check only records what exists, so old items do not trigger it. Each press release published after that starts one execution.

### License

MIT. See [LICENSE](LICENSE).
