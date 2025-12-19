# Deploying with Self-Hosted Supabase

This guide explains how to connect the app to your self-hosted Supabase instance when deploying.

## Your Self-Hosted Supabase Details

- **URL**: `http://172.234.31.22:8000`
- **Dashboard**: `http://172.234.31.22:3000` (Supabase Studio)

## Deployment Steps

### Option 1: Using Environment Variables (Recommended)

When deploying to Vercel, Netlify, or any hosting platform, set these environment variables:

```
VITE_SELF_HOSTED_SUPABASE_URL=http://172.234.31.22:8000
VITE_SELF_HOSTED_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UiLAogICAgImlhdCI6IDE2NzU0MDAwMDAsCiAgICAiZXhwIjogMTc5OTUzNTYwMAp9.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
```

### Option 2: Direct Code Update

If you want to always use self-hosted (after cloning from GitHub), update `src/integrations/supabase/client.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'http://172.234.31.22:8000';
const SUPABASE_KEY = 'your-anon-key-here';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

## Important Notes

1. **HTTPS Required for Production**: Your self-hosted Supabase should use HTTPS in production. Set up a reverse proxy (nginx) with SSL certificates.

2. **Database Migration**: Make sure your self-hosted Supabase has the same database schema. You can export from Lovable Cloud and import to your instance.

3. **CORS Configuration**: Ensure your Kong configuration allows requests from your deployed domain.

## Database Schema Migration

To migrate your database schema:

1. Access Lovable Cloud backend data
2. Export the schema using SQL
3. Import into your self-hosted Supabase via Studio at `http://172.234.31.22:3000`

## Testing Connection

Test your self-hosted connection:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://172.234.31.22:8000',
  'your-anon-key'
);

// Test query
const { data, error } = await supabase.from('departments').select('*');
console.log(data, error);
```
