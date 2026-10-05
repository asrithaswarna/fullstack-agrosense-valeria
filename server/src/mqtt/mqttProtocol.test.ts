import assert from 'node:assert/strict'
import test from 'node:test'
import { mqttAdapter } from './mqttAdapter.js'
import { parseMqttScalarPayload, parseMqttSnapshotPayload, parseMqttTopic } from './mqttProtocol.js'

const greenhouseId = '41fda8c2-31af-4c57-9a22-978bec6b1a93'
const sensorId = '92e4d110-eef0-4fd6-a857-9b67879cb064'

test('accepts only the documented greenhouse batch and sensor topics', () => {
  assert.deepEqual(parseMqttTopic(`valeria/greenhouses/${greenhouseId}/readings`), { greenhouseId })
  assert.deepEqual(parseMqttTopic(`valeria/greenhouses/${greenhouseId}/sensors/${sensorId}/reading`), { greenhouseId, sensorId })
  assert.equal(parseMqttTopic(`valeria/greenhouses/${greenhouseId}/sensors/${sensorId}/alerts`), undefined)
  assert.equal(parseMqttTopic('valeria/greenhouses/not-a-uuid/readings'), undefined)
})

test('validates scalar payload fields and numeric values', () => {
  assert.deepEqual(parseMqttScalarPayload(Buffer.from(JSON.stringify({
    metric: 'temperature',
    value: 24.5,
    recordedAt: '2026-10-03T12:00:00.000Z',
  }))), {
    metric: 'temperature',
    value: 24.5,
    recordedAt: '2026-10-03T12:00:00.000Z',
  })
  assert.throws(() => parseMqttScalarPayload(Buffer.from('{"metric":"bogus","value":2}')), /metric is invalid/)
  assert.throws(() => parseMqttScalarPayload(Buffer.from('{"metric":"humidity","value":"70"}')), /finite number/)
  assert.throws(() => parseMqttScalarPayload(Buffer.from('{"metric":"humidity","value":70,"ownerId":"other"}')), /unsupported fields/)
  assert.throws(() => parseMqttScalarPayload(Buffer.from('{"metric":"humidity","value":70,"recordedAt":"not-a-date"}')), /valid timestamp/)
  assert.throws(() => parseMqttScalarPayload(Buffer.from('null')), /JSON object/)
})

test('accepts only JSON objects for greenhouse batches and enforces the payload size limit', () => {
  assert.deepEqual(parseMqttSnapshotPayload(Buffer.from('{"measurements":[]}')), { measurements: [] })
  assert.throws(() => parseMqttSnapshotPayload(Buffer.from('[]')), /JSON object/)
  assert.throws(() => parseMqttSnapshotPayload(Buffer.alloc(16_385, 32)), /16384 bytes/)
})

test('MQTT adapter refuses to connect without username and password', async () => {
  const previousUsername = process.env.MQTT_USERNAME
  const previousPassword = process.env.MQTT_PASSWORD
  delete process.env.MQTT_USERNAME
  delete process.env.MQTT_PASSWORD
  try {
    await assert.rejects(mqttAdapter.start(), /MQTT_USERNAME and MQTT_PASSWORD must be configured/)
  } finally {
    if (previousUsername === undefined) delete process.env.MQTT_USERNAME
    else process.env.MQTT_USERNAME = previousUsername
    if (previousPassword === undefined) delete process.env.MQTT_PASSWORD
    else process.env.MQTT_PASSWORD = previousPassword
  }
})
