-- CreateEnum
CREATE TYPE "AnchorSide" AS ENUM ('A', 'B');

-- CreateTable
CREATE TABLE "HighlineAnchor" (
    "uuid" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "anchorSide" "AnchorSide" NOT NULL DEFAULT 'A',
    "highlineId" TEXT NOT NULL,

    CONSTRAINT "HighlineAnchor_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Highline" (
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "height" INTEGER NOT NULL,
    "length" INTEGER NOT NULL,
    "isRigged" BOOLEAN NOT NULL,

    CONSTRAINT "Highline_pkey" PRIMARY KEY ("uuid")
);

-- AddForeignKey
ALTER TABLE "HighlineAnchor" ADD CONSTRAINT "HighlineAnchor_highlineId_fkey" FOREIGN KEY ("highlineId") REFERENCES "Highline"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
