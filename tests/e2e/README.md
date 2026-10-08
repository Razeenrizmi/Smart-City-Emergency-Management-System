# End-to-end tests (Postman + Newman)

Two collections live here. Both use `local.postman_environment.json`
(`baseUrl=http://localhost:5017`, officer `officer` / `officer123`).

| Collection | Use for |
|---|---|
| `hazards-workflow.postman_collection.json` | **Your individual** Hazard Detection demo (report → pending → approve → map + 401/403/SQLi) |
| `srms-integrated.postman_collection.json` | **Group** integrated system (health, hazard, Green Wave, crime-vehicle, junctions, AI, extra security) |

## Start the API first

```bash
dotnet run --project backend/SRMS.API
```

Wait until Swagger is at http://localhost:5017/swagger (or `/health` returns 200).

## Individual — Hazard Detection only

```bash
npx --yes -p newman -p newman-reporter-htmlextra newman run \
  tests/e2e/hazards-workflow.postman_collection.json \
  -e tests/e2e/local.postman_environment.json \
  -r cli,htmlextra --reporter-htmlextra-export tests/evidence/e2e-hazards.html
```

## Group — full integrated system

```bash
npx --yes -p newman -p newman-reporter-htmlextra newman run \
  tests/e2e/srms-integrated.postman_collection.json \
  -e tests/e2e/local.postman_environment.json \
  -r cli,htmlextra --reporter-htmlextra-export tests/evidence/e2e-integrated.html
```

Screenshot the Newman summary table (assertions, failed = 0) and open the HTML report.

CI (`.github/workflows/ci.yml` job `e2e`) runs the **integrated** collection against a throwaway Postgres.
