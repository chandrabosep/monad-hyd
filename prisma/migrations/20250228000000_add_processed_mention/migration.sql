-- CreateTable
CREATE TABLE "ProcessedMention" (
    "tweetId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedMention_pkey" PRIMARY KEY ("tweetId")
);
