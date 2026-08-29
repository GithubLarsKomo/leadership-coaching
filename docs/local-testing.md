# Local test on port 3010

The local browser entry point is always:

```text
http://localhost:3010
```

Vite runs on 3010 and proxies `/api` and `/healthz` to the local Node API on 3011. Production/Coolify remains free to use its own internal port through `PORT`.

## 1. Start PostgreSQL

```powershell
docker compose -f docker-compose.local.yml up -d
```

The local database is exposed only for development on host port `5437`.

## 2. Configure the development connection

PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://leadership_coaching_app:leadership_coaching_local@127.0.0.1:5437/leadership_coaching"
```

## 3. Install, migrate and seed

```powershell
npm install
npm run db:migrate
npm run db:seed:pes
```

`db:seed:pes` publishes the reviewed PES/SGL Schleswig-Holstein scorecard and initial assessment definition from `assessments/pes-sgl-sh/`.

## 4. Start the app

```powershell
npm run dev
```

Open `http://localhost:3010`.

## 5. Expected vertical slice

Candidate view should allow you to:

1. create a new PES/SGL baseline test session;
2. see round 1 without the hidden task stimulus;
3. unlock the task explicitly;
4. see the task only after unlock;
5. observe the countdown / elapsed time;
6. enter an answer;
7. save and complete the round;
8. see the server-measured elapsed time and deterministic raw handoff.

Reloading or closing the browser after unlock does not pause the server-authoritative attempt clock. The current MVP UI does not yet restore an in-progress session after a browser reload; persistence exists in PostgreSQL and restore/resume navigation is a following slice.

## 6. Health check

```powershell
Invoke-RestMethod http://localhost:3010/healthz
```

Expected database state after migration and while PostgreSQL is reachable:

```json
{
  "status": "ok",
  "service": "leadership-coaching",
  "database": {
    "configured": true,
    "ready": true
  }
}
```

## Reset local data

```powershell
docker compose -f docker-compose.local.yml down -v
```

Then rerun migration and seed.
