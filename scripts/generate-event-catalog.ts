import * as fs from "node:fs";
import * as path from "node:path";

import "../src/application/events/definitions";
import { EventRegistry } from "../src/application/events/registry";

type CatalogEvent = Omit<
  ReturnType<typeof EventRegistry.getAll>[number],
  "schema"
>;

function sanitizeCatalog(): CatalogEvent[] {
  return EventRegistry.getAll().map(({ schema, ...rest }) => rest);
}

function generateMarkdown(catalog: CatalogEvent[], timestamp: string): string {
  const orphans = catalog.filter((event) => event.consumers.length === 0);

  return `# Event Catalog

> Auto-generated on ${timestamp}
> Total Events: ${catalog.length} | Orphans: ${orphans.length}

## Summary

| Event | Version | Producers | Consumers | Status |
|-------|---------|-----------|-----------|--------|
${catalog
  .sort((a, b) => a.eventType.localeCompare(b.eventType))
  .map((event) => {
    const status = event.consumers.length === 0 ? "Orphan" : "Active";
    const producers = event.producers.join(", ") || "-";
    const consumers = event.consumers.join(", ") || "-";
    return `| \`${event.eventType}\` | ${event.version} | ${producers} | ${consumers} | ${status} |`;
  })
  .join("\n")}

## Events by Domain

${generateByDomain(catalog)}
`;
}

function generateByDomain(catalog: CatalogEvent[]): string {
  const domains = [
    "services",
    "financial",
    "placement",
    "meeting",
    "contract",
    "resume",
  ];

  let output = "";

  for (const domain of domains) {
    const domainEvents = catalog.filter(
      (event) =>
        event.eventType.startsWith(domain) || event.eventType.includes(domain),
    );

    if (domainEvents.length === 0) {
      continue;
    }

    output += `\n### ${domain.charAt(0).toUpperCase() + domain.slice(1)} Domain\n\n`;

    for (const event of domainEvents) {
      output += `#### \`${event.eventType}\`\n`;
      output += `- Version: ${event.version}\n`;
      output += `- Producers: ${event.producers.join(", ") || "-"}\n`;
      output += `- Consumers: ${event.consumers.join(", ") || "-"}\n`;
      if (event.description) {
        output += `- Description: ${event.description}\n`;
      }
      output += "\n";
    }
  }

  return output;
}

function toMermaidId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "");
}

function generateMermaid(catalog: CatalogEvent[]): string {
  let diagram = "flowchart LR\n";

  const producers = new Set<string>();
  const consumers = new Set<string>();

  for (const event of catalog) {
    event.producers.forEach((producer) => producers.add(producer));
    event.consumers.forEach((consumer) => consumers.add(consumer));
  }

  diagram += "\n  subgraph Producers\n";
  producers.forEach((producer) => {
    diagram += `    ${toMermaidId(producer)}["${producer}"]\n`;
  });
  diagram += "  end\n";

  diagram += "\n  subgraph Consumers\n";
  consumers.forEach((consumer) => {
    diagram += `    ${toMermaidId(consumer)}["${consumer}"]\n`;
  });
  diagram += "  end\n\n";

  for (const event of catalog) {
    const eventLabel = event.eventType.split(".").slice(-2).join(".");
    for (const producer of event.producers) {
      for (const consumer of event.consumers) {
        diagram += `  ${toMermaidId(producer)} -->|${eventLabel}| ${toMermaidId(consumer)}\n`;
      }
    }
  }

  return diagram;
}

function generateEventCatalog(): void {
  const timestamp = new Date().toISOString();
  const catalog = sanitizeCatalog();

  const outputDir = path.join("docs", "events");
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, "EVENT_CATALOG.md"),
    generateMarkdown(catalog, timestamp),
  );

  fs.writeFileSync(
    path.join(outputDir, "event-flow.mermaid"),
    generateMermaid(catalog),
  );

  fs.writeFileSync(
    path.join(outputDir, "event-catalog.json"),
    JSON.stringify(catalog, null, 2),
  );

  console.log(`Event catalog generated at ${outputDir}`);
  console.log(`- ${catalog.length} events documented`);
  console.log(`- ${catalog.filter((event) => event.consumers.length === 0).length} orphan events`);
}

generateEventCatalog();
