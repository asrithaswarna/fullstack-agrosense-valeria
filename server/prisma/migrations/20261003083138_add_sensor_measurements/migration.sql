-- CreateEnum
CREATE TYPE "SensorMeasurementType" AS ENUM ('TEMPERATURE', 'HUMIDITY', 'SOIL_MOISTURE', 'LIGHT_INTENSITY');

-- CreateTable
CREATE TABLE "SensorMeasurement" (
    "id" UUID NOT NULL,
    "greenhouseId" UUID NOT NULL,
    "sensorId" UUID NOT NULL,
    "metric" "SensorMeasurementType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SensorMeasurement_greenhouseId_recordedAt_idx" ON "SensorMeasurement"("greenhouseId", "recordedAt");

-- CreateIndex
CREATE INDEX "SensorMeasurement_sensorId_metric_recordedAt_idx" ON "SensorMeasurement"("sensorId", "metric", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SensorMeasurement_sensorId_metric_recordedAt_key" ON "SensorMeasurement"("sensorId", "metric", "recordedAt");

-- AddForeignKey
ALTER TABLE "SensorMeasurement" ADD CONSTRAINT "SensorMeasurement_greenhouseId_fkey" FOREIGN KEY ("greenhouseId") REFERENCES "Greenhouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorMeasurement" ADD CONSTRAINT "SensorMeasurement_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
