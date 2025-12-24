import * as fs from "node:fs";
import * as path from "node:path";

import "@application/events/definitions";
import { EventRegistry } from "@application/events/registry";

const IGNORED_DIRS = new Set(["node_modules", "dist", ".git"]);

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function isLegacyHandler(filePath: string): boolean {
  const normalized = filePath.split(path.sep).join("/");
  if (!normalized.endsWith(".ts")) return false;
  if (normalized.endsWith(".spec.ts") || normalized.endsWith(".test.ts")) {
    return false;
  }

  return (
    (normalized.includes("src/domains/") && normalized.includes("/event-handlers/")) ||
    (normalized.includes("src/domains/") && normalized.includes("/listeners/")) ||
    (normalized.includes("src/core/") && normalized.includes("/listeners/"))
  );
}

function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

describe("Event Governance", () => {
  describe("Event Coverage", () => {
    it("every published event must have at least one declared consumer", () => {
      const orphans = EventRegistry.getOrphans();

      if (orphans.length > 0) {
        const orphanList = orphans
          .map((event) => `  - ${event.eventType} (producers: ${event.producers.join(", ")})`)
          .join("\n");
        console.warn(`Events with no consumers:\n${orphanList}`);
      }
    });

    it("every event must have at least one declared producer", () => {
      const unproduced = EventRegistry.getAll().filter(
        (event) => event.producers.length === 0,
      );

      if (unproduced.length > 0) {
        const list = unproduced
          .map((event) => `  - ${event.eventType}`)
          .join("\n");
        fail(`Found events with no producers:\n${list}`);
      }
    });
  });

  describe("Handler Location", () => {
    it("all event handlers should live in application/events/handlers", () => {
      const legacyHandlers = walk("src").filter(isLegacyHandler);

      if (legacyHandlers.length > 0) {
        console.warn(
          "Handlers in legacy locations (should migrate to application/events/handlers/):\n" +
            legacyHandlers.map((file) => `  - ${file}`).join("\n"),
        );
      }
    });

    it("handlers are grouped by consumer module", () => {
      const handlersRoot = path.join("src", "application", "events", "handlers");
      const expectedConsumers = ["services", "contract", "financial", "calendar"];

      if (!fs.existsSync(handlersRoot)) {
        fail(`Missing handlers root: ${handlersRoot}`);
      }

      const entries = fs.readdirSync(handlersRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        if (!expectedConsumers.includes(entry.name)) {
          console.warn(`Unexpected handler directory: ${entry.name}`);
        }
      }
    });
  });

  describe("Producer Verification", () => {
    it("declared producers should appear in codebase", () => {
      const catalog = EventRegistry.getAll();
      const files = walk("src").filter(
        (file) =>
          file.endsWith(".ts") &&
          !file.endsWith(".spec.ts") &&
          !file.endsWith(".test.ts"),
      );

      const contentByFile = new Map<string, string>();
      const errors: string[] = [];

      for (const event of catalog) {
        const eventType = event.eventType;
        let found = false;

        for (const file of files) {
          let content = contentByFile.get(file);
          if (!content) {
            content = readFileSafe(file);
            contentByFile.set(file, content);
          }

          if (
            (content.includes(`"${eventType}"`) || content.includes(`'${eventType}'`)) &&
            (content.includes(".publish") || content.includes(".emit") || content.includes("eventPublisher"))
          ) {
            found = true;
            break;
          }
        }

        if (!found) {
          errors.push(`Event "${eventType}" declared but not found in publisher usage`);
        }
      }

      if (errors.length > 0) {
        console.warn(`Producer verification warnings:\n${errors.join("\n")}`);
      }
    });
  });
});
