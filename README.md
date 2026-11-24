# FlowMatrix

### Business Management Dashboard

FlowMatrix is a web-based business management dashboard designed to help small businesses manage their clients, projects, leads, approvals, reports, and team activities from one centralized workspace.

## Live Demo

https://flowmatrix-dashboard-lfou.vercel.app/

## Features

### Client Management
- Add and manage client records.
- Edit client information.
- Archive clients without permanently deleting their records.
- Restore archived clients.

### Project Management
- Create and manage projects.
- Link projects with clients.
- Track project status.
- Role-based Add, Edit, and Delete permissions.

### Lead Management
- Manage and organize business leads.
- Keep lead records within the workspace.

### Approval Management
- Centralized approval workflow.
- Track pending, approved, and rejected requests.
- Maintain approval history.

### Reports
- Access business reports through the dashboard.

### Team Management
- Manage workspace members.
- Support Owner, Admin, and Member roles.

### Notifications & Settings
- View workspace notifications.
- Manage available workspace preferences.

## User Roles

The project management module uses the following permissions:

| Permission | Owner | Admin | Member |
|---|---|---|---|
| View Projects | Yes | Yes | Yes |
| Add Projects | Yes | Yes | No |
| Edit Projects | Yes | Yes | No |
| Delete Projects | Yes | No | No |

## Technology Stack

- Next.js
- React
- TypeScript
- Supabase
- PostgreSQL
- Supabase Row Level Security (RLS)
- Vercel
- GitHub

## Security

- Supabase authentication.
- PostgreSQL Row Level Security.
- Workspace membership checks.
- Role-based database permissions.
- Approval controls for sensitive actions.

## Local Setup

### Requirements
- Node.js
- npm
- Supabase project

### 1. Clone the repository

```bash
git clone https://github.com/rohitondkardev/flowmatrix-dashboard.git
```

### 2. Open the project folder

```bash
cd flowmatrix-dashboard
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

Add your own Supabase project credentials. Never upload private keys or service-role keys to GitHub.

### 5. Run the development server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Intended Use Cases

FlowMatrix can be adapted for:

- Retail stores
- Clinics
- Service businesses
- Digital agencies
- Small teams and startups

Business-specific workflows and modules may require additional customization.

## Developer

**Rohit Ondkar**

GitHub: https://github.com/rohitondkardev

---

FlowMatrix — Manage your business operations in one workspace.