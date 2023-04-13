-- CreateTable
CREATE TABLE "Profile" (
    "clerkUserId" TEXT NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("clerkUserId")
);

-- CreateTable
CREATE TABLE "FavoritedHighline" (
    "profileId" TEXT NOT NULL,
    "highlineId" TEXT NOT NULL,

    CONSTRAINT "FavoritedHighline_pkey" PRIMARY KEY ("profileId","highlineId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_clerkUserId_key" ON "Profile"("clerkUserId");

-- AddForeignKey
ALTER TABLE "FavoritedHighline" ADD CONSTRAINT "FavoritedHighline_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritedHighline" ADD CONSTRAINT "FavoritedHighline_highlineId_fkey" FOREIGN KEY ("highlineId") REFERENCES "Highline"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
