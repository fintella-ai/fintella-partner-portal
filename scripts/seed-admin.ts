import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Standalone admin-seed helper. Safe to run against any environment.
 *
 * Hardened per the Phase 15b-fu operational-security work (2026-04-13):
 * - Refuses to create a new super_admin if one already exists in the DB.
 * - Requires SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD env vars in production
 *   so we never silently reintroduce the `admin123` default that exists
 *   in public git history.
 * - In dev/test, falls back to the historical defaults for convenience.
 *
 * See scripts/seed-all.js for the longer rationale — the guards here
 * match that file so both entry points are safe.
 */
async function main() {
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: "super_admin" },
  });

  if (existingSuperAdmin) {
    console.log(
      "Admin seeding SKIPPED — super_admin already exists:",
      existingSuperAdmin.email
    );
    return;
  }

  const isProd = process.env.NODE_ENV === "production";
  const envEmail = process.env.SEED_ADMIN_EMAIL;
  const envPassword = process.env.SEED_ADMIN_PASSWORD;

  if (isProd && (!envEmail || !envPassword)) {
    console.warn(
      "⚠ No super_admin exists and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD " +
        "env vars are not set. Refusing to create a default-password admin " +
        "in production. Set both env vars and re-run to bootstrap the first " +
        "admin safely."
    );
    return;
  }

  const adminEmail = envEmail || "admin@fintella.partners";
  const adminPassword = envPassword || "admin123";

  const user = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: hashSync(adminPassword, 10),
      name: "Admin User",
      role: "super_admin",
    },
  });
  console.log("Created admin user:", user.email);
  if (!envPassword && !isProd) {
    console.log(
      "  ⓘ Using default dev password. Set SEED_ADMIN_PASSWORD env var to override."
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
