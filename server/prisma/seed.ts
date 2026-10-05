import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, AlertSeverity, AlertStatus, GreenhouseStatus, IrrigationState, SensorMeasurementType, SensorStatus, UserRole, ZoneState } from '@prisma/client'

const prisma = new PrismaClient()
const readingSamples = [
  [21.2, 73, 78, 120], [20.8, 75, 77, 100], [20.3, 76, 76, 80], [19.9, 77, 76, 60],
  [19.5, 78, 75, 50], [19.2, 78, 74, 70], [19.7, 76, 73, 180], [21.1, 73, 72, 420],
  [22.8, 70, 72, 760], [24.1, 67, 71, 1120], [25.2, 64, 70, 1480], [26.1, 62, 70, 1820],
  [27.3, 59, 69, 2050], [28.1, 57, 68, 2180], [28.8, 55, 68, 2100], [29.1, 54, 67, 1940],
  [28.7, 56, 67, 1680], [28.2, 58, 66, 1320], [27.5, 61, 66, 960], [26.9, 63, 65, 620],
  [26.2, 65, 65, 380], [25.4, 67, 64, 250], [24.8, 69, 63, 160], [26.4, 68, 74, 842],
] as const

type SeedAccount = { name: string; email?: string; password?: string; greenhouseName: string; location: string }

async function seedAccount(account: SeedAccount): Promise<void> {
  if (!account.email || !account.password || account.password.length < 12) {
    throw new Error('Set both seed account emails and passwords (at least 12 characters) in server/.env before seeding.')
  }

  const passwordHash = await bcrypt.hash(account.password, 12)
  const user = await prisma.user.upsert({
    where: { email: account.email.toLowerCase() },
    update: { name: account.name, passwordHash, role: UserRole.USER },
    create: { name: account.name, email: account.email.toLowerCase(), passwordHash, role: UserRole.USER },
  })
  const greenhouse = await prisma.greenhouse.upsert({
    where: { ownerId: user.id },
    update: { name: account.greenhouseName, location: account.location },
    create: {
      ownerId: user.id,
      name: account.greenhouseName,
      location: account.location,
      area: 240,
      timezone: 'Asia/Kolkata',
      description: 'Leafy greens and seasonal herbs.',
      status: GreenhouseStatus.ACTIVE,
    },
  })

  const zoneSpecs = [
    { name: 'Zone A', moisture: 72, state: ZoneState.HEALTHY, irrigationState: IrrigationState.IDLE },
    { name: 'Zone B', moisture: 68, state: ZoneState.HEALTHY, irrigationState: IrrigationState.IDLE },
    { name: 'Zone C', moisture: 75, state: ZoneState.OPTIMAL, irrigationState: IrrigationState.SCHEDULED },
    { name: 'Zone D', moisture: 59, state: ZoneState.MONITOR, irrigationState: IrrigationState.IDLE },
  ] as const
  const zones = new Map<string, string>()
  for (const zone of zoneSpecs) {
    const stored = await prisma.soilZone.upsert({
      where: { greenhouseId_name: { greenhouseId: greenhouse.id, name: zone.name } },
      update: { moisture: zone.moisture, state: zone.state, irrigationState: zone.irrigationState },
      create: { ...zone, greenhouseId: greenhouse.id },
    })
    zones.set(zone.name, stored.id)
  }

  const sensorSpecs = [
    { name: 'DHT22', type: 'Temperature & humidity', zoneLabel: 'Central aisle', unit: '°C / %', status: SensorStatus.ONLINE, lastReading: '26.4°C · 68%', batteryLevel: 100 },
    ...zoneSpecs.map((zone) => ({ name: 'Soil moisture', type: 'Capacitive sensor', zoneLabel: zone.name, unit: '%', status: SensorStatus.ONLINE, lastReading: `${zone.moisture}%`, batteryLevel: 94, soilZoneId: zones.get(zone.name) })),
    { name: 'LDR', type: 'Light intensity', zoneLabel: 'Roof level', unit: 'lux', status: SensorStatus.ONLINE, lastReading: '842 lux', batteryLevel: 98 },
    { name: 'Irrigation relay', type: 'Irrigation control', zoneLabel: 'Pump room', unit: 'state', status: SensorStatus.READY, lastReading: 'Standby' },
  ]
  let readingSensorId = ''
  const sensorIds = new Map<string, string>()
  for (const sensor of sensorSpecs) {
    const stored = await prisma.sensor.upsert({
      where: { greenhouseId_name_zoneLabel: { greenhouseId: greenhouse.id, name: sensor.name, zoneLabel: sensor.zoneLabel } },
      update: { ...sensor, lastSeen: null },
      create: { ...sensor, greenhouseId: greenhouse.id, lastSeen: null },
    })
    sensorIds.set(`${sensor.name}:${sensor.zoneLabel}`, stored.id)
    if (sensor.name === 'DHT22') readingSensorId = stored.id
  }

  const currentHour = new Date()
  currentHour.setMinutes(0, 0, 0)
  for (let index = 0; index < readingSamples.length; index += 1) {
    const sample = readingSamples[index]
    const timestamp = new Date(currentHour.getTime() - (readingSamples.length - index - 1) * 60 * 60_000)
    await prisma.sensorReading.upsert({
      where: { sensorId_timestamp: { sensorId: readingSensorId, timestamp } },
      update: {
        temperature: sample[0],
        humidity: sample[1],
        soilMoisture: sample[2],
        lightIntensity: sample[3],
        greenhouseId: greenhouse.id,
      },
      create: {
        sensorId: readingSensorId,
        greenhouseId: greenhouse.id,
        timestamp,
        temperature: sample[0],
        humidity: sample[1],
        soilMoisture: sample[2],
        lightIntensity: sample[3],
      },
    })

    const measurementSpecs = [
      { sensorId: readingSensorId, metric: SensorMeasurementType.TEMPERATURE, value: sample[0], lastReading: `${sample[0]}°C · ${sample[1]}%` },
      { sensorId: readingSensorId, metric: SensorMeasurementType.HUMIDITY, value: sample[1], lastReading: `${sample[0]}°C · ${sample[1]}%` },
      ...zoneSpecs.map((zone, zoneIndex) => {
        const sensorId = sensorIds.get(`Soil moisture:${zone.name}`)
        if (!sensorId) throw new Error(`Missing seeded soil sensor for ${zone.name}.`)
        const value = Math.min(100, Math.max(0, sample[2] + (zoneIndex - 1.5) * 1.2))
        return { sensorId, metric: SensorMeasurementType.SOIL_MOISTURE, value, lastReading: `${value.toFixed(1)}%` }
      }),
      {
        sensorId: sensorIds.get('LDR:Roof level') ?? '',
        metric: SensorMeasurementType.LIGHT_INTENSITY,
        value: sample[3],
        lastReading: `${sample[3]} lux`,
      },
    ]
    for (const measurement of measurementSpecs) {
      if (!measurement.sensorId) throw new Error('Missing seeded light sensor.')
      await prisma.sensorMeasurement.upsert({
        where: {
          sensorId_metric_recordedAt: {
            sensorId: measurement.sensorId,
            metric: measurement.metric,
            recordedAt: timestamp,
          },
        },
        update: { value: measurement.value, greenhouseId: greenhouse.id },
        create: {
          greenhouseId: greenhouse.id,
          sensorId: measurement.sensorId,
          metric: measurement.metric,
          value: measurement.value,
          recordedAt: timestamp,
        },
      })
      await prisma.sensor.update({
        where: { id: measurement.sensorId },
        data: { lastSeen: timestamp, lastReading: measurement.lastReading },
      })
    }
  }

  const alertSpecs = [
    { type: 'Low Soil Moisture', title: 'Soil moisture is low in Zone D', message: 'Moisture is below the preferred range.', severity: AlertSeverity.WARNING, source: 'Soil sensor · Zone D', status: AlertStatus.ACTIVE, sensorName: 'Soil moisture', zoneLabel: 'Zone D' },
    { type: 'High Temperature', title: 'Temperature rising above daily average', message: 'Temperature is above the daily average.', severity: AlertSeverity.WARNING, source: 'DHT22 · Greenhouse 01', status: AlertStatus.ACTIVE, sensorName: 'DHT22', zoneLabel: 'Central aisle' },
    { type: 'Low Light', title: 'Light intensity returned to optimal range', message: 'Light intensity has returned to the preferred range.', severity: AlertSeverity.INFO, source: 'LDR · Greenhouse 01', status: AlertStatus.RESOLVED, sensorName: 'LDR', zoneLabel: 'Roof level' },
    { type: 'Sensor Offline', title: 'Sensor connection interrupted', message: 'The connection was restored.', severity: AlertSeverity.CRITICAL, source: 'Soil sensor · Zone B', status: AlertStatus.RESOLVED, sensorName: 'Soil moisture', zoneLabel: 'Zone B' },
  ] as const
  for (const [index, item] of alertSpecs.entries()) {
    const { sensorName, zoneLabel, ...alertData } = item
    const sensor = await prisma.sensor.findUnique({
      where: { greenhouseId_name_zoneLabel: { greenhouseId: greenhouse.id, name: sensorName, zoneLabel } },
      select: { id: true },
    })
    const createdAt = new Date(Date.now() - (index + 1) * 60 * 60_000)
    await prisma.alert.upsert({
      where: { greenhouseId_title: { greenhouseId: greenhouse.id, title: alertData.title } },
      update: {
        ...alertData,
        sensorId: sensor?.id,
        createdAt,
        resolvedAt: alertData.status === AlertStatus.RESOLVED ? createdAt : null,
        acknowledged: false,
        acknowledgedAt: null,
      },
      create: {
        ...alertData,
        greenhouseId: greenhouse.id,
        sensorId: sensor?.id,
        createdAt,
        resolvedAt: alertData.status === AlertStatus.RESOLVED ? createdAt : null,
        acknowledged: false,
        acknowledgedAt: null,
      },
    })
  }
}

async function main(): Promise<void> {
  await seedAccount({
    name: 'Valeria Grower',
    email: process.env.SEED_USER_EMAIL,
    password: process.env.SEED_USER_PASSWORD,
    greenhouseName: 'Greenhouse 01',
    location: 'North Garden',
  })
  await seedAccount({
    name: 'Second Grower',
    email: process.env.SEED_SECOND_USER_EMAIL,
    password: process.env.SEED_SECOND_USER_PASSWORD,
    greenhouseName: 'Greenhouse 02',
    location: 'West Garden',
  })
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Database seed failed.')
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
