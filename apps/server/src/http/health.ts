import type { FastifyInstance } from "fastify";

export type ReadinessProbe = {
  query(sql: string): Promise<unknown>;
};

export function registerHealthRoutes(app: FastifyInstance, database: ReadinessProbe) {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ready", async (_request, reply) => {
    try {
      await database.query("SELECT 1");
      return { status: "ok" };
    } catch (error) {
      app.log.warn(
        { message: error instanceof Error ? error.message : "Unknown database error" },
        "readiness check failed",
      );
      reply.code(503);
      return { status: "unavailable" };
    }
  });
}
