import { db } from "@flowproof/core";
import { seedDatabase } from "./seed-lib";

try {
  await seedDatabase(true);
} finally {
  await db.$disconnect();
}
