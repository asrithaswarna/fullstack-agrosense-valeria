# VALERIA API Reference

Base path: `/api`

Unless marked **Public**, endpoints require:

```http
Authorization: Bearer <JWT>
```

Successful responses use `{ "success": true, "data": ... }`. API errors use `{ "success": false, "message": "..." }`. Error messages are user-safe and do not include stack traces.

## Authentication

| Method | Endpoint | Purpose | Authentication |
| --- | --- | --- | --- |
| `GET` | `/health` | API liveness and timestamp. | Public |
| `POST` | `/auth/register` | Create an account and its greenhouse workspace. | Public |
| `POST` | `/auth/login` | Verify credentials and issue a JWT. | Public |
| `GET` | `/auth/me` | Return the authenticated account identity. | Required |
| `PATCH` | `/auth/profile` | Update authenticated user's profile fields. | Required |
| `PATCH` | `/auth/password` | Verify current password and rotate password hash. | Required |

## Sensors

| Method | Endpoint | Purpose | Authentication |
| --- | --- | --- | --- |
| `GET` | `/sensors` | List sensors in the authenticated user's greenhouse; optional `status` filter. | Required |
| `POST` | `/sensors` | Create a sensor in the authenticated user's greenhouse. | Required |
| `GET` | `/sensors/:id` | Retrieve an owned sensor. | Required |
| `PATCH` | `/sensors/:id` | Update an owned sensor. | Required |
| `DELETE` | `/sensors/:id` | Delete an owned sensor, subject to relational constraints. | Required |

The server determines the greenhouse from the authenticated identity; request bodies do not grant access to another owner's greenhouse.

## Readings

| Method | Endpoint | Purpose | Authentication |
| --- | --- | --- | --- |
| `GET` | `/readings/latest` | Retrieve latest persisted snapshots and sensor/metric values for the owned greenhouse. | Required |
| `GET` | `/readings/history` | Retrieve bounded persisted reading history or sensor measurements. | Required |
| `POST` | `/readings` | Validate and persist an owned scalar measurement or measurement batch. | Required |

`GET /readings/history` supports `range` (`24h`, `7d`, or `30d`), `sensorId`, `start`, `end`, `limit` (1–1000), `order` (`asc` or `desc`), and `sample` (`true` or `false`). Unknown query parameters and malformed values are rejected.

For batch ingestion, a request includes a `measurements` array whose entries identify a sensor, supported metric, and finite numeric value; an optional timestamp may be supplied. Scalar ingestion identifies `sensorId`, `metric`, `value`, and optional `recordedAt`. All input is validated against greenhouse ownership, sensor/metric compatibility, timestamps, payload limits, and configured reading bounds before persistence. See `sensorReadingIngestionService.ts` and `mqttProtocol.ts` for exact accepted structures.

## Alerts

| Method | Endpoint | Purpose | Authentication |
| --- | --- | --- | --- |
| `GET` | `/alerts` | List the owned greenhouse's alerts; optional `status` filter. | Required |
| `GET` | `/alerts/active` | List active alerts for the owned greenhouse. | Required |
| `GET` | `/alerts/:id` | Retrieve an owned alert. | Required |
| `PATCH` | `/alerts/:id` | Update supported status/acknowledgement fields on an owned alert. | Required |

## Analytics

| Method | Endpoint | Purpose | Authentication |
| --- | --- | --- | --- |
| `GET` | `/analytics` | Return analytics for a requested period; defaults to `24h`. | Required |
| `GET` | `/analytics/summary` | Return metric summary values for a requested period; defaults to `24h`. | Required |

Both endpoints accept `range=24h`, `range=7d`, or `range=30d`.

## Greenhouse and irrigation

| Method | Endpoint | Purpose | Authentication |
| --- | --- | --- | --- |
| `GET` | `/greenhouse` | Retrieve the authenticated user's greenhouse and settings. | Required |
| `PATCH` | `/greenhouse` | Update supported owned greenhouse settings and thresholds. | Required |
| `GET` | `/greenhouse/irrigation` | Retrieve persisted irrigation recommendation/state for the owned greenhouse. | Required |

Irrigation is a software recommendation/state only and does not control physical equipment.

## System

| Method | Endpoint | Purpose | Authentication |
| --- | --- | --- | --- |
| `GET` | `/system/status` | Report application service and data synchronization status. | Required |

## Realtime events

Socket.IO shares the API server origin and authenticates with the JWT in the connection handshake. Clients do not choose their greenhouse room.

| Event | Purpose |
| --- | --- |
| `sensor:reading` | Newly persisted scalar reading or snapshot data. |
| `alert:created` | Newly persisted alert. |
| `alert:updated` | Updated alert state. |
| `alert:resolved` | Alert recovery/resolution. |
| `irrigation:updated` | Persisted simulated soil-zone recommendation/state update. |

Realtime events are greenhouse-scoped. REST remains the initial and historical source; clients refresh after reconnect to recover any missed changes.
