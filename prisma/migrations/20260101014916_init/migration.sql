-- CreateTable
CREATE TABLE "planners" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "notes" TEXT,
    "reflection" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plannerId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "timeSpan" INTEGER NOT NULL DEFAULT 30,
    "isBig3" BOOLEAN NOT NULL DEFAULT false,
    "scheduledStartHour" INTEGER,
    "scheduledStartMinute" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "planners" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "planners_date_key" ON "planners"("date");

-- CreateIndex
CREATE INDEX "tasks_plannerId_idx" ON "tasks"("plannerId");
