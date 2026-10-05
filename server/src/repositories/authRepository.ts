import { Prisma, SensorStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect

export type SafeUserRecord = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>

async function createStarterGreenhouse(
  transaction: Prisma.TransactionClient,
  ownerId: string,
  greenhouseName: string,
): Promise<void> {
  const greenhouse = await transaction.greenhouse.create({
    data: {
      ownerId,
      name: greenhouseName,
      location: 'My growing space',
      area: 240,
      timezone: 'Asia/Kolkata',
      description: 'Your greenhouse workspace.',
    },
  })
  const zoneSpecs = [
    { name: 'Zone A', moisture: 72 },
    { name: 'Zone B', moisture: 68 },
    { name: 'Zone C', moisture: 75 },
    { name: 'Zone D', moisture: 59 },
  ]
  const zones = await Promise.all(zoneSpecs.map((zone) => transaction.soilZone.create({
    data: { greenhouseId: greenhouse.id, name: zone.name, moisture: zone.moisture },
  })))
  const sensors = await Promise.all([
    transaction.sensor.create({
      data: {
        greenhouseId: greenhouse.id,
        name: 'DHT22',
        type: 'Temperature & humidity',
        zoneLabel: 'Central aisle',
        unit: '°C / %',
        lastReading: '26.4°C · 68%',
        lastSeen: new Date(),
      },
    }),
    ...zones.map((zone) => transaction.sensor.create({
      data: {
        greenhouseId: greenhouse.id,
        soilZoneId: zone.id,
        name: 'Soil moisture',
        type: 'Capacitive sensor',
        zoneLabel: zone.name,
        unit: '%',
        lastReading: `${zone.moisture}%`,
        lastSeen: new Date(),
      },
    })),
    transaction.sensor.create({
      data: {
        greenhouseId: greenhouse.id,
        name: 'LDR',
        type: 'Light intensity',
        zoneLabel: 'Roof level',
        unit: 'lux',
        lastReading: '842 lux',
        lastSeen: new Date(),
      },
    }),
    transaction.sensor.create({
      data: {
        greenhouseId: greenhouse.id,
        name: 'Irrigation relay',
        type: 'Irrigation control',
        zoneLabel: 'Pump room',
        unit: 'state',
        status: SensorStatus.READY,
        lastReading: 'Standby',
        lastSeen: new Date(),
      },
    }),
  ])
  const readingSensor = sensors[0]
  if (!readingSensor) throw new Error('Unable to prepare initial sensor data.')
  await transaction.sensorReading.create({
    data: {
      greenhouseId: greenhouse.id,
      sensorId: readingSensor.id,
      temperature: 26.4,
      humidity: 68,
      soilMoisture: 74,
      lightIntensity: 842,
    },
  })
}

export const authRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

  findSafeById(id: string): Promise<SafeUserRecord | null> {
    return prisma.user.findUnique({ where: { id }, select: safeUserSelect })
  },

  findPasswordHashById(id: string): Promise<string | null> {
    return prisma.user.findUnique({ where: { id }, select: { passwordHash: true } }).then((user) => user?.passwordHash ?? null)
  },

  findIdentityById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
  },

  async createAccount(input: {
    name: string
    email: string
    passwordHash: string
    greenhouseName: string
  }): Promise<SafeUserRecord> {
    return prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { name: input.name, email: input.email, passwordHash: input.passwordHash },
        select: safeUserSelect,
      })
      await createStarterGreenhouse(transaction, user.id, input.greenhouseName)
      return user
    })
  },

  updateProfile(id: string, patch: { name?: string; email?: string }): Promise<SafeUserRecord> {
    return prisma.user.update({ where: { id }, data: patch, select: safeUserSelect })
  },

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { passwordHash }, select: { id: true } })
  },
}
