-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "GreenhouseStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SensorStatus" AS ENUM ('ONLINE', 'OFFLINE', 'WARNING', 'READY');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ZoneState" AS ENUM ('HEALTHY', 'OPTIMAL', 'MONITOR');

-- CreateEnum
CREATE TYPE "IrrigationState" AS ENUM ('IDLE', 'WATERING', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "IrrigationMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Greenhouse" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "location" VARCHAR(160) NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "timezone" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "status" "GreenhouseStatus" NOT NULL DEFAULT 'ACTIVE',
    "irrigationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "irrigationActive" BOOLEAN NOT NULL DEFAULT false,
    "currentZone" TEXT,
    "irrigationStartedAt" TIMESTAMP(3),
    "irrigationDurationMinutes" INTEGER NOT NULL DEFAULT 8,
    "irrigationMode" "IrrigationMode" NOT NULL DEFAULT 'AUTOMATIC',
    "irrigationLastCycle" VARCHAR(40) NOT NULL DEFAULT '8:30 AM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Greenhouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoilZone" (
    "id" UUID NOT NULL,
    "greenhouseId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "state" "ZoneState" NOT NULL DEFAULT 'HEALTHY',
    "irrigationState" "IrrigationState" NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoilZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sensor" (
    "id" UUID NOT NULL,
    "greenhouseId" UUID NOT NULL,
    "soilZoneId" UUID,
    "name" VARCHAR(120) NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "zoneLabel" VARCHAR(120) NOT NULL,
    "unit" VARCHAR(40) NOT NULL,
    "status" "SensorStatus" NOT NULL DEFAULT 'ONLINE',
    "lastReading" VARCHAR(120) NOT NULL DEFAULT 'No reading yet',
    "lastSeen" TIMESTAMP(3),
    "batteryLevel" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" UUID NOT NULL,
    "greenhouseId" UUID NOT NULL,
    "sensorId" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperature" DOUBLE PRECISION NOT NULL,
    "humidity" DOUBLE PRECISION NOT NULL,
    "soilMoisture" DOUBLE PRECISION NOT NULL,
    "lightIntensity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "greenhouseId" UUID NOT NULL,
    "sensorId" UUID,
    "type" VARCHAR(100) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Greenhouse_ownerId_key" ON "Greenhouse"("ownerId");

-- CreateIndex
CREATE INDEX "Greenhouse_status_idx" ON "Greenhouse"("status");

-- CreateIndex
CREATE INDEX "SoilZone_greenhouseId_idx" ON "SoilZone"("greenhouseId");

-- CreateIndex
CREATE UNIQUE INDEX "SoilZone_greenhouseId_name_key" ON "SoilZone"("greenhouseId", "name");

-- CreateIndex
CREATE INDEX "Sensor_greenhouseId_idx" ON "Sensor"("greenhouseId");

-- CreateIndex
CREATE INDEX "Sensor_soilZoneId_idx" ON "Sensor"("soilZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "Sensor_greenhouseId_name_zoneLabel_key" ON "Sensor"("greenhouseId", "name", "zoneLabel");

-- CreateIndex
CREATE INDEX "SensorReading_greenhouseId_timestamp_idx" ON "SensorReading"("greenhouseId", "timestamp");

-- CreateIndex
CREATE INDEX "SensorReading_sensorId_timestamp_idx" ON "SensorReading"("sensorId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "SensorReading_sensorId_timestamp_key" ON "SensorReading"("sensorId", "timestamp");

-- CreateIndex
CREATE INDEX "Alert_greenhouseId_status_createdAt_idx" ON "Alert"("greenhouseId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_sensorId_idx" ON "Alert"("sensorId");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_greenhouseId_title_key" ON "Alert"("greenhouseId", "title");

-- AddForeignKey
ALTER TABLE "Greenhouse" ADD CONSTRAINT "Greenhouse_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilZone" ADD CONSTRAINT "SoilZone_greenhouseId_fkey" FOREIGN KEY ("greenhouseId") REFERENCES "Greenhouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_greenhouseId_fkey" FOREIGN KEY ("greenhouseId") REFERENCES "Greenhouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_soilZoneId_fkey" FOREIGN KEY ("soilZoneId") REFERENCES "SoilZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_greenhouseId_fkey" FOREIGN KEY ("greenhouseId") REFERENCES "Greenhouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_greenhouseId_fkey" FOREIGN KEY ("greenhouseId") REFERENCES "Greenhouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
