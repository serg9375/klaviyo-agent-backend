# klaviyo-agent-backend

Hosted OAuth connector and tools API for the "explain Klaviyo billing in numbers" agent (Next.js, deployed on Vercel).

## Routes
- `GET /api/connect/start`, `GET /api/connect/callback`: Klaviyo OAuth connect flow
- `POST /api/disconnect`: revoke and delete stored tokens
- `POST /api/tools/usage`, `POST /api/tools/rule`: tools the agent calls

## Deploy on Vercel
1. Import this repo; framework is detected as Next.js.
2. Add the Upstash Redis integration (sets `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`).
3. Set the remaining variables from `.env.example`; generate `TOKEN_KEY` with `openssl rand -base64 32`.
4. After the first deploy, set `KLAVIYO_REDIRECT_URI` to `https://<your-domain>/api/connect/callback` and register the same URL in the Klaviyo app. Redeploy.

The app throws at boot if a required variable is missing.

## Develop
```bash
npm install
npm test
npm run build
```
