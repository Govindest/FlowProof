import { db } from "@flowproof/core";
import { seedDatabase } from "./seed-lib";

try {
  await seedDatabase(false);
} finally {
  await db.$disconnect();
}
