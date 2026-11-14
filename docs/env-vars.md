# Environment variables

Configuration is read exclusively from environment variables. Defaults below are the application defaults. The deployed values are set per environment in the system's gitops-app repo (`system.yaml`: a component's `env`, and `replicas`, `resources` under `instances.<env>`).

## Core

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port the server listens on. |
| `NODE_ENV` | `production` (in the image) | Node environment. |
| `API_URL` | _(unset)_ | Base URL of `taskboard15-api` (e.g. `http://taskboard15-api`). Server-side only, never `NEXT_PUBLIC_`. Unset or empty: the start page shows the load and save failure messages. |

## Observability

| Variable | Default | Description |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | _(unset — tracing disabled)_ | OTLP endpoint; when set, `instrumentation.ts` enables OpenTelemetry tracing. |
| `OTEL_SERVICE_NAME` | `taskboard15-web` | Service name reported in traces. |

## Public (browser-exposed)

Variables prefixed `NEXT_PUBLIC_` are inlined into the client bundle at build time. Never put secrets in them.
