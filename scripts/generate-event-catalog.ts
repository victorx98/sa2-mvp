import * as fs from "fs";
import * as path from "path";
import { EventRegistry, type EventMetadata } from "@shared/events/registry";

// Populate registry with all integration events
import "@shared/events";

// Populate registry with all consumer declarations (@HandlesEvent)
import "@shared/events/governance/load-consumers";

function main(): void {
  const outputDir = path.resolve(process.cwd(), "docs", "events");
  fs.mkdirSync(outputDir, { recursive: true });

  const catalog = EventRegistry.getAll();
  const generatedAt = new Date().toISOString();

  fs.writeFileSync(
    path.join(outputDir, "EVENT_CATALOG.md"),
    generateMarkdown(catalog, generatedAt),
    "utf8",
  );

  fs.writeFileSync(
    path.join(outputDir, "event-flow.mermaid"),
    generateMermaidDiagram(catalog),
    "utf8",
  );

  fs.writeFileSync(
    path.join(outputDir, "event-catalog.json"),
    JSON.stringify(
      {
        generatedAt,
        events: catalog.map(({ schema: _schema, ...rest }) => rest),
      },
      null,
      2,
    ),
    "utf8",
  );

  // eslint-disable-next-line no-console
  console.log(`✅ Event catalog generated: ${outputDir}`);
  // eslint-disable-next-line no-console
  console.log(`   - ${catalog.length} events documented`);
}

function generateMarkdown(catalog: EventMetadata[], generatedAt: string): string {
  const orphans = catalog.filter((event) => event.consumers.length === 0);
  const deprecated = catalog.filter((event) => event.deprecated);

  return `# Event Catalog

> Auto-generated on ${generatedAt}  
> Total Events: ${catalog.length} | Orphans: ${orphans.length} | Deprecated: ${deprecated.length}

## Quick Stats

| Metric | Count |
|--------|-------|
| Total Events | ${catalog.length} |
| Active Events | ${catalog.length - deprecated.length} |
| Orphan Events (no consumers) | ${orphans.length} |
| Deprecated Events | ${deprecated.length} |

---

## Events by Producer

${generateByProducerSection(catalog)}

---

## Events by Consumer

${generateByConsumerSection(catalog)}

---

## Dependency Matrix

| Event | Version | Producers | Consumers | Status |
|-------|---------|-----------|-----------|--------|
${catalog
  .slice()
  .sort((a, b) => a.eventType.localeCompare(b.eventType))
  .map((event) => {
    const status = event.deprecated
      ? "Deprecated"
      : event.consumers.length === 0
        ? "Orphan"
        : "Active";
    return `| \`${event.eventType}\` | ${event.version} | ${event.producers.join(", ") || "-"} | ${event.consumers.join(", ") || "-"} | ${status} |`;
  })
  .join("\n")}

---

## Warnings & Issues

${generateWarningsSection(catalog)}
`;
}

function generateByProducerSection(catalog: EventMetadata[]): string {
  const byProducer = new Map<string, EventMetadata[]>();

  for (const event of catalog) {
    for (const producer of event.producers) {
      const list = byProducer.get(producer) ?? [];
      list.push(event);
      byProducer.set(producer, list);
    }
  }

  return Array.from(byProducer.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([producer, events]) => {
      const lines = events
        .slice()
        .sort((a, b) => a.eventType.localeCompare(b.eventType))
        .map((event) => `- \`${event.eventType}\` (v${event.version})`)
        .join("\n");
      return `### ${producer}\n\n${lines}\n`;
    })
    .join("\n");
}

function generateByConsumerSection(catalog: EventMetadata[]): string {
  const byConsumer = new Map<string, EventMetadata[]>();

  for (const event of catalog) {
    for (const consumer of event.consumers) {
      const list = byConsumer.get(consumer) ?? [];
      list.push(event);
      byConsumer.set(consumer, list);
    }
  }

  return Array.from(byConsumer.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([consumer, events]) => {
      const lines = events
        .slice()
        .sort((a, b) => a.eventType.localeCompare(b.eventType))
        .map((event) => `- \`${event.eventType}\` (v${event.version})`)
        .join("\n");
      return `### ${consumer}\n\n${lines}\n`;
    })
    .join("\n");
}

function generateWarningsSection(catalog: EventMetadata[]): string {
  const warnings: string[] = [];

  const orphans = catalog.filter((event) => event.consumers.length === 0 && !event.deprecated);
  if (orphans.length > 0) {
    warnings.push(
      `### Orphan Events\n\n${orphans
        .map(
          (event) =>
            `- \`${event.eventType}\` (produced by ${event.producers.join(", ") || "-"})`,
        )
        .join("\n")}\n`,
    );
  }

  const deprecatedInUse = catalog.filter(
    (event) => event.deprecated && event.consumers.length > 0,
  );
  if (deprecatedInUse.length > 0) {
    warnings.push(
      `### Deprecated Events Still in Use\n\n${deprecatedInUse
        .map(
          (event) =>
            `- \`${event.eventType}\` consumed by ${event.consumers.join(", ") || "-"}`,
        )
        .join("\n")}\n`,
    );
  }

  return warnings.length > 0 ? warnings.join("\n") : "_No warnings_";
}

function generateMermaidDiagram(catalog: EventMetadata[]): string {
  const producers = new Set<string>();
  const consumers = new Set<string>();

  for (const event of catalog) {
    event.producers.forEach((producer) => producers.add(producer));
    event.consumers.forEach((consumer) => consumers.add(consumer));
  }

  let diagram = `%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '14px'}}}%%\nflowchart LR\n`;

  diagram += `  subgraph Producers\n`;
  Array.from(producers)
    .sort()
    .forEach((producer) => {
      diagram += `    ${toNodeId(producer)}[${producer}]\n`;
    });
  diagram += `  end\n\n`;

  diagram += `  subgraph Consumers\n`;
  Array.from(consumers)
    .sort()
    .forEach((consumer) => {
      diagram += `    ${toNodeId(consumer)}[${consumer}]\n`;
    });
  diagram += `  end\n\n`;

  for (const event of catalog) {
    for (const producer of event.producers) {
      for (const consumer of event.consumers) {
        diagram += `  ${toNodeId(producer)} -->|${event.eventType}| ${toNodeId(consumer)}\n`;
      }
    }
  }

  return diagram;
}

function toNodeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

main();

