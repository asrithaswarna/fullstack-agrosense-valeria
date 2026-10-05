# VALERIA — Academic Project Documentation

## 1. Introduction

VALERIA (Smart Greenhouse Environmental Intelligence) is a website-first academic system for monitoring greenhouse conditions and presenting historical data, environmental alerts, and irrigation recommendations. It demonstrates an end-to-end full-stack data flow using simulated sensor observations.

**Current-data disclosure:** All environmental observations originate from a software simulator. No ESP32, Arduino, physical sensor, pump, or GPIO hardware is connected or controlled.

## 2. Problem Statement

Greenhouse operators need to understand changing environmental conditions and the history behind those changes. Raw sensor values are difficult to act on without a clear dashboard, persistent history, bounded alerting, and understandable status information. A monitoring system must also keep each operator's greenhouse information isolated.

## 3. Proposed Solution

VALERIA provides a responsive React website backed by an authenticated TypeScript API. A stateful simulator generates gradual environmental readings. The server validates and persists them with Prisma and PostgreSQL, evaluates environmental thresholds and soil-zone recommendations, and publishes authorized updates to the website through Socket.IO. MQTT is supported as an authenticated ingestion route for the simulator and a future device integration.

## 4. Objectives

- Display temperature, humidity, soil moisture, and light intensity clearly.
- Persist greenhouse snapshots, individual sensor measurements, and alerts.
- Provide bounded historical analytics and sensor health information.
- Demonstrate authenticated account, REST, MQTT, and realtime flows.
- Enforce greenhouse ownership for user-facing data.
- Communicate clearly that current values are simulated and hardware integration is future work.

## 5. Functional Requirements

1. A visitor can register, sign in, and sign out.
2. An authenticated user can retrieve and update their profile, greenhouse settings, and measurement thresholds.
3. An authenticated user can view owned sensors, readings, alerts, analytics, system status, and irrigation recommendations.
4. Reading ingestion validates sensor identity, greenhouse ownership, metric, timestamp, payload, and configured numeric limits before persistence.
5. The simulator supports direct ingestion and authenticated MQTT transport.
6. Persisted readings are evaluated for environmental alerts, stale sensor status, and soil-moisture recommendations.
7. An authenticated browser receives events for its greenhouse and refreshes REST state on reconnect.

## 6. Non-Functional Requirements

- **Security:** bcrypt password hashing, signed JWT bearer auth, owner-scoped repository operations, MQTT password/ACL enforcement, and greenhouse-derived Socket.IO rooms.
- **Integrity:** relational constraints, typed Prisma access, validation before persistence, and database transactions for ingestion.
- **Usability:** responsive page layouts, visible labels/focus, meaningful loading/error/empty states, and clear sensor-source disclosure.
- **Maintainability:** TypeScript frontend/backend, separation between routes/controllers/services/repositories, schema migrations, and focused automated tests.
- **Configurability:** database, ports, allowed browser origin, MQTT broker, simulator interval, and accepted reading bounds are environment-configurable.

## 7. System Architecture

```text
Stateful simulated sensor values
       ↓
Direct ingestion OR authenticated MQTT
       ↓
Express route / MQTT adapter
       ↓
Shared reading validation and ingestion service
       ↓
Prisma transaction → PostgreSQL
       ↓
Alert engine + sensor health + irrigation intelligence
       ↓
REST initial/history requests + authorized Socket.IO events
       ↓
React website
```

Production mode disables the simulator. A production installation must deliberately configure its data input and deployment environment.

## 8. Technology Stack

| Concern | Implementation |
| --- | --- |
| Browser UI | React, TypeScript, React Router |
| Development and production frontend build | Vite |
| API server | Node.js, Express, TypeScript |
| Data access | Prisma ORM |
| Relational store | PostgreSQL |
| Password storage | bcrypt |
| API and socket identity | JSON Web Tokens |
| Device/simulator message transport | MQTT.js and Mosquitto |
| Browser event transport | Socket.IO |
| Automated server tests | Node.js test runner through `tsx` |

## 9. Database Design

The schema is defined in `server/prisma/schema.prisma` and migrations are stored in `server/prisma/migrations`.

- **User** stores account identity, role, and bcrypt password hash.
- **Greenhouse** belongs to one user and stores settings, thresholds, and irrigation state.
- **SoilZone** belongs to a greenhouse and stores moisture and recommendation state.
- **Sensor** belongs to a greenhouse and may be assigned to a soil zone; it stores status, last reading, and last-seen time.
- **SensorReading** stores an environmental snapshot.
- **SensorMeasurement** stores a scalar metric and value for a sensor at a timestamp.
- **Alert** belongs to a greenhouse and may reference a sensor; active-condition keys suppress duplicate active alerts.

Foreign keys and unique/index constraints support ownership, identity, query, and deduplication behavior. The data model does not contain physical sensor device connections.

## 10. Authentication Architecture

Registration validates account input, hashes the password with bcrypt, creates an account and greenhouse workspace, and returns a signed JWT. Login compares the supplied password with the stored bcrypt hash. Protected HTTP requests use `Authorization: Bearer <token>`; middleware verifies the token and reloads the user identity. The password-change endpoint verifies the current password before storing a new bcrypt hash. API user representations omit password hashes.

Socket.IO clients provide the JWT in the handshake auth payload. The server verifies it, confirms the account and its greenhouse, and assigns the socket to the corresponding greenhouse room. Client-supplied greenhouse IDs are not used to select rooms.

## 11. Sensor Simulation

The stateful simulator produces temperature, humidity, soil moisture, and light values with gradual variation, small sensor-level differences, time-of-day effects, and configured bounds. The simulator interval and accepted-value limits are configured through server environment variables. Direct mode calls the shared ingestion service; MQTT mode publishes through the broker and is received by the same server ingestion path.

The server runs the in-process simulator only outside production. No separate simulator should be started alongside the API in this configuration.

## 12. MQTT Communication

The backend requires `MQTT_USERNAME` and `MQTT_PASSWORD`, connects using `MQTT_BROKER_URL`, and subscribes to greenhouse snapshot and individual sensor reading topics. Example topic forms:

```text
valeria/greenhouses/<greenhouseId>/readings
valeria/greenhouses/<greenhouseId>/sensors/<sensorId>/reading
```

Batch payloads contain `recordedAt` and a `measurements` array; scalar payloads contain `metric`, finite numeric `value`, and optional `recordedAt`. The protocol parser enforces topic shape and payload size. The ingestion service verifies greenhouse/sensor ownership and metric/value compatibility. MQTT topic names do not independently authorize data.

The provided Mosquitto configuration is a local example with anonymous access disabled and an ACL. Existing password files must be preserved: Mosquitto's `-c` option creates/replaces the file and must not be used to update an existing broker account list.

## 13. REST API

The Express API is rooted at `/api`. Registration, login, and health are public. Account, greenhouse, sensor, readings, analytics, alerts, irrigation, and system routes require a valid bearer token. JSON success and error envelopes are documented in [API_REFERENCE.md](./API_REFERENCE.md). Request validation rejects unsupported fields and malformed query inputs; data lookups are scoped to the authenticated owner.

## 14. Socket.IO Realtime Communication

The HTTP server and Socket.IO server share the configured API port. The authenticated server-side room membership is derived from the user's greenhouse. Events include `sensor:reading`, `alert:created`, `alert:updated`, `alert:resolved`, and `irrigation:updated`. Reading and intelligence events are emitted after the relevant persistence operation. The React app maintains one authenticated client connection per mounted application shell and removes event listeners when subscribers unmount. On connect/reconnect, REST refresh restores state that may have changed while disconnected.

## 15. Alert Intelligence

The alert engine evaluates committed readings against the greenhouse's minimum/maximum temperature, humidity, soil moisture, and light thresholds. Active-condition keys suppress duplicate alerts for an ongoing condition. Recovery resolves the existing alert while preserving the historical record. The sensor health monitor identifies sensors whose readings exceed the configured stale interval, creates a deduplicated offline alert, and resolves it when a valid reading resumes.

Alert severity, type, status, source, creation time, and optional resolution time are persisted. Alerts are greenhouse-scoped and changes are sent only to the authorized greenhouse room.

## 16. Irrigation Intelligence

Soil-zone moisture is compared with the greenhouse's configured soil minimum. Dry readings create a persisted `NEEDS_WATER` recommendation. A recovery margin provides hysteresis so the recommendation does not immediately toggle at the threshold. Zone state and recommendation updates are persisted and may be delivered as `irrigation:updated` events. This is decision support only, not automatic physical watering.

## 17. Frontend Design

The website uses a warm ivory and forest-green palette, editorial serif headings, sans-serif interface copy, and reusable page/layout components. Public routes include `/`, `/register`, and `/login`. Protected application routes include `/dashboard`, `/live`, `/analytics`, `/sensors`, `/alerts`, `/system`, and `/settings`; `/logout` clears the browser token. A responsive sidebar provides authenticated navigation. The System page distinguishes the current simulated pipeline from future ESP32/Arduino integration.

## 18. Testing Strategy

The repository's server test script covers simulator behavior, MQTT protocol/payload rules, and authentication/password changes. TypeScript builds validate backend and frontend code; Oxlint checks the client. End-to-end verification additionally exercises real local PostgreSQL, Mosquitto, API ownership, simulated persistence, Socket.IO delivery, UI behavior, and responsive layouts. Those environment-specific browser and broker checks are not all committed as automated test files.

## 19. Security

- Store passwords as bcrypt hashes and avoid returning credential hashes.
- Use JWT-protected API routes and derive user identity from token claims plus a current database identity lookup.
- Scope data repositories and queries to the authenticated user's greenhouse.
- Require broker credentials, use Mosquitto ACLs, validate all received topics and payloads, and verify sensor ownership in application code.
- Derive Socket.IO rooms server-side after authentication.
- Configure CORS to the intended frontend origin.
- Keep local secrets in ignored environment files and broker password files.
- For deployment, use HTTPS, MQTT over TLS, strong secrets, firewall controls, a protected database, backups, and operational monitoring.

## 20. Limitations

- Sensor observations are simulated; physical sensor integration is not implemented.
- MQTT/Socket.IO and PostgreSQL require deployment-specific configuration.
- Password reset is not available.
- Notification preferences are session-only rather than persisted.
- Irrigation does not control a pump, GPIO, or other hardware.
- The repository does not include cloud deployment manifests.
- No rate-limiting feature is currently documented or configured for authentication endpoints; add an appropriate deployment control before public exposure.

## 21. Future Hardware Integration

A future device can measure greenhouse conditions and publish validated metric messages to the configured authenticated MQTT broker. The backend can then reuse the existing topic parsing, sensor ownership validation, persistence, alerting, and Socket.IO event path. Device provisioning, TLS, credential rotation, calibration, and physical safety controls would need to be designed and tested before deployment. This describes future work only.

## 22. Conclusion

VALERIA demonstrates an integrated greenhouse-monitoring workflow from simulated sensor generation through validated persistence, threshold intelligence, and an authenticated website. The system keeps data source and hardware limitations explicit while providing an extensible MQTT boundary for a separately designed future device integration.
