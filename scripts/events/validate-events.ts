import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

type PayloadStyle = "raw" | "envelope" | "envelopeWithType";

type CatalogProducer = {
  module?: string;
  file?: string;
  class: string;
  method?: string;
  status?: "active" | "planned";
};

type CatalogEvent = {
  name: string;
  status?: "active" | "legacy" | "planned" | "deprecated";
  allowNoConsumer?: boolean;
  payloadStyle?: PayloadStyle;
  producers?: CatalogProducer[];
};

type EventCatalog = {
  meta?: unknown;
  events: CatalogEvent[];
};

type RegistrySubscriber = {
  module?: string;
  class: string;
  method: string;
};

type RegistrySubscription = {
  event: string;
  subscriber: RegistrySubscriber;
  required?: boolean;
  status?: "active" | "planned";
  registration?: "static" | "dynamic";
};

type SubscriptionRegistry = {
  meta?: unknown;
  subscriptions: RegistrySubscription[];
};

type Finding = {
  level: "error" | "warning";
  code:
    | "CATALOG_MISSING_EVENT"
    | "REGISTRY_MISSING_SUBSCRIPTION"
    | "CATALOG_MISSING_PRODUCER"
    | "REGISTRY_SUBSCRIPTION_NOT_IMPLEMENTED"
    | "CATALOG_PRODUCER_NOT_IMPLEMENTED"
    | "EVENT_NAME_UNRESOLVABLE"
    | "SUBSCRIBER_NOT_REGISTERED_IN_MODULE"
    | "CATALOG_EVENT_REQUIRES_CONSUMER"
    | "PAYLOAD_STYLE_VIOLATION";
  message: string;
  file?: string;
  line?: number;
  col?: number;
};

type DiscoveredEmit = {
  eventName?: string;
  eventExpr: ts.Expression;
  file: string;
  pos: ts.LineAndCharacter;
  className?: string;
  methodName?: string;
  payloadArg?: ts.Expression;
};

type DiscoveredSubscription = {
  eventName?: string;
  eventExpr: ts.Expression;
  file: string;
  pos: ts.LineAndCharacter;
  className?: string;
  methodName?: string;
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i++;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function loadTsConfig(rootDir: string) {
  const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) throw new Error("tsconfig.json not found");

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext([configFile.error], {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => rootDir,
      getNewLine: () => "\n",
    }));
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
    { noEmit: true },
    configPath,
  );
  if (parsed.errors?.length) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => rootDir,
      getNewLine: () => "\n",
    }));
  }
  return parsed;
}

function isStringLiteralLike(expr: ts.Expression): expr is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr);
}

function resolveEventName(checker: ts.TypeChecker, expr: ts.Expression): string | undefined {
  if (isStringLiteralLike(expr)) return expr.text;

  // Handle Identifier / PropertyAccess / QualifiedName through symbol resolution.
  const symbol = checker.getSymbolAtLocation(expr);
  if (!symbol) return undefined;

  const unaliased = (symbol.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(symbol) : symbol;
  const declarations = unaliased.declarations || [];
  for (const decl of declarations) {
    if (ts.isVariableDeclaration(decl) && decl.initializer && isStringLiteralLike(decl.initializer)) {
      return decl.initializer.text;
    }
    if (ts.isPropertyAssignment(decl) && isStringLiteralLike(decl.initializer)) {
      return decl.initializer.text;
    }
  }

  return undefined;
}

function getEnclosingClassAndMethod(node: ts.Node): { className?: string; methodName?: string } {
  let current: ts.Node | undefined = node;
  let methodName: string | undefined;
  while (current) {
    if (!methodName) {
      if (ts.isMethodDeclaration(current) && current.name) {
        methodName = current.name.getText();
      } else if (ts.isFunctionDeclaration(current) && current.name) {
        methodName = current.name.getText();
      } else if (ts.isPropertyDeclaration(current) && current.name) {
        // class property with arrow function
        methodName = current.name.getText();
      }
    }
    if (ts.isClassDeclaration(current) && current.name) {
      return { className: current.name.text, methodName };
    }
    current = current.parent;
  }
  return { methodName };
}

function findOnEventDecorators(sourceFile: ts.SourceFile): ts.Decorator[] {
  const decorators: ts.Decorator[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isDecorator(n)) {
      const expr = n.expression;
      if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === "OnEvent") {
        decorators.push(n);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sourceFile);
  return decorators;
}

function findEmitCalls(sourceFile: ts.SourceFile): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === "emit") {
        calls.push(n);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sourceFile);
  return calls;
}

function isEventEmitter2EmitCall(
  checker: ts.TypeChecker,
  call: ts.CallExpression,
): boolean {
  if (!ts.isPropertyAccessExpression(call.expression)) return false;
  if (call.expression.name.text !== "emit") return false;
  const receiver = call.expression.expression;
  const type = checker.getTypeAtLocation(receiver);
  const typeText = checker.typeToString(type);
  return (
    typeText.includes("EventEmitter2") ||
    typeText.includes("eventemitter2.EventEmitter2")
  );
}

function collectModuleProviders(program: ts.Program): Map<string, Set<string>> {
  // providerClassName -> set(moduleFile)
  const providers = new Map<string, Set<string>>();
  const checker = program.getTypeChecker();

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    const filePath = sourceFile.fileName;
    if (!filePath.endsWith(".module.ts")) continue;

    const visit = (n: ts.Node) => {
      if (!ts.isDecorator(n)) return ts.forEachChild(n, visit);
      const expr = n.expression;
      if (!ts.isCallExpression(expr) || !ts.isIdentifier(expr.expression) || expr.expression.text !== "Module") {
        return ts.forEachChild(n, visit);
      }
      const arg = expr.arguments[0];
      if (!arg || !ts.isObjectLiteralExpression(arg)) return;
      const providersProp = arg.properties.find((p) => {
        if (!ts.isPropertyAssignment(p)) return false;
        if (!ts.isIdentifier(p.name) && !ts.isStringLiteral(p.name)) return false;
        const name = ts.isIdentifier(p.name) ? p.name.text : p.name.text;
        return name === "providers";
      });
      if (!providersProp || !ts.isPropertyAssignment(providersProp)) return;
      const init = providersProp.initializer;
      if (!ts.isArrayLiteralExpression(init)) return;

      for (const el of init.elements) {
        if (ts.isIdentifier(el)) {
          const name = el.text;
          if (!providers.has(name)) providers.set(name, new Set());
          providers.get(name)!.add(path.relative(process.cwd(), filePath));
        } else if (ts.isSpreadElement(el)) {
          // dynamic / unknown
        } else if (ts.isObjectLiteralExpression(el)) {
          // { provide: ..., useClass: ... } etc, ignore for now
          // Could resolve useClass identifier if needed later.
          const useClassProp = el.properties.find((p) => {
            if (!ts.isPropertyAssignment(p)) return false;
            if (!ts.isIdentifier(p.name) && !ts.isStringLiteral(p.name)) return false;
            const name = ts.isIdentifier(p.name) ? p.name.text : p.name.text;
            return name === "useClass";
          });
          if (useClassProp && ts.isPropertyAssignment(useClassProp) && ts.isIdentifier(useClassProp.initializer)) {
            const sym = checker.getSymbolAtLocation(useClassProp.initializer);
            if (sym) {
              const className = useClassProp.initializer.text;
              if (!providers.has(className)) providers.set(className, new Set());
              providers.get(className)!.add(path.relative(process.cwd(), filePath));
            }
          }
        }
      }
    };
    ts.forEachChild(sourceFile, visit);
  }

  return providers;
}

function hasObjectLiteralProperty(obj: ts.ObjectLiteralExpression, propertyName: string): boolean {
  return obj.properties.some((p) => {
    if (ts.isShorthandPropertyAssignment(p)) {
      return p.name.text === propertyName;
    }
    if (ts.isPropertyAssignment(p)) {
      if (ts.isIdentifier(p.name)) return p.name.text === propertyName;
      if (ts.isStringLiteral(p.name)) return p.name.text === propertyName;
      return false;
    }
    return false;
  });
}

function validatePayloadStyle(
  checker: ts.TypeChecker,
  style: PayloadStyle,
  eventName: string,
  emit: DiscoveredEmit,
): Finding[] {
  const findings: Finding[] = [];
  const payloadArg = emit.payloadArg;
  if (!payloadArg) {
    findings.push({
      level: "error",
      code: "PAYLOAD_STYLE_VIOLATION",
      message: `emit(${eventName}) missing payload argument; expected ${style}`,
      file: emit.file,
      line: emit.pos.line + 1,
      col: emit.pos.character + 1,
    });
    return findings;
  }

  if (style === "raw") return findings;

  if (!ts.isObjectLiteralExpression(payloadArg)) {
    findings.push({
      level: "warning",
      code: "PAYLOAD_STYLE_VIOLATION",
      message: `emit(${eventName}) payload is not an object literal; cannot statically validate ${style}`,
      file: emit.file,
      line: emit.pos.line + 1,
      col: emit.pos.character + 1,
    });
    return findings;
  }

  if (!hasObjectLiteralProperty(payloadArg, "payload")) {
    findings.push({
      level: "error",
      code: "PAYLOAD_STYLE_VIOLATION",
      message: `emit(${eventName}) expected top-level { payload: ... }`,
      file: emit.file,
      line: emit.pos.line + 1,
      col: emit.pos.character + 1,
    });
  }

  if (style === "envelopeWithType") {
    if (!hasObjectLiteralProperty(payloadArg, "type")) {
      findings.push({
        level: "error",
        code: "PAYLOAD_STYLE_VIOLATION",
        message: `emit(${eventName}) expected top-level { type: '${eventName}', payload: ... }`,
        file: emit.file,
        line: emit.pos.line + 1,
        col: emit.pos.character + 1,
      });
    } else {
      // Best-effort: verify type literal matches eventName if statically resolvable
      const typeProp = payloadArg.properties.find((p) => {
        if (!ts.isPropertyAssignment(p)) return false;
        if (ts.isIdentifier(p.name)) return p.name.text === "type";
        if (ts.isStringLiteral(p.name)) return p.name.text === "type";
        return false;
      });
      if (typeProp && ts.isPropertyAssignment(typeProp)) {
        const typeValue = resolveEventName(checker, typeProp.initializer);
        if (typeValue && typeValue !== eventName) {
          findings.push({
            level: "error",
            code: "PAYLOAD_STYLE_VIOLATION",
            message: `emit(${eventName}) has mismatched type '${typeValue}'`,
            file: emit.file,
            line: emit.pos.line + 1,
            col: emit.pos.character + 1,
          });
        }
      }
    }
  }

  return findings;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalogPath = String(args.get("catalog") || "docs/eventing/event-catalog.json");
  const registryPath = String(args.get("registry") || "docs/eventing/subscription-registry.json");
  const rootDir = process.cwd();

  const catalog = readJsonFile<EventCatalog>(path.resolve(rootDir, catalogPath));
  const registry = readJsonFile<SubscriptionRegistry>(path.resolve(rootDir, registryPath));

  const catalogByEvent = new Map<string, CatalogEvent>();
  for (const e of catalog.events) catalogByEvent.set(e.name, e);

  const registryKeys = new Set<string>();
  for (const s of registry.subscriptions) {
    registryKeys.add(`${s.event}|${s.subscriber.class}|${s.subscriber.method}`);
  }

  const parsed = loadTsConfig(rootDir);
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  });
  const checker = program.getTypeChecker();

  const emits: DiscoveredEmit[] = [];
  const subs: DiscoveredSubscription[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    const rel = path.relative(rootDir, sourceFile.fileName);
    if (rel.startsWith("node_modules")) continue;
    if (!rel.startsWith("src") && !rel.startsWith("test") && !rel.startsWith("scripts")) continue;

    for (const call of findEmitCalls(sourceFile)) {
      if (!isEventEmitter2EmitCall(checker, call)) continue;
      const args = call.arguments;
      if (!args.length) continue;
      const eventExpr = args[0];
      const eventName = resolveEventName(checker, eventExpr);
      const pos = sourceFile.getLineAndCharacterOfPosition(call.getStart(sourceFile));
      const { className, methodName } = getEnclosingClassAndMethod(call);
      emits.push({
        eventName,
        eventExpr,
        file: rel,
        pos,
        className,
        methodName,
        payloadArg: args[1],
      });
    }

    for (const dec of findOnEventDecorators(sourceFile)) {
      const expr = dec.expression as ts.CallExpression;
      const eventExpr = expr.arguments[0];
      if (!eventExpr) continue;
      const eventName = resolveEventName(checker, eventExpr);
      const pos = sourceFile.getLineAndCharacterOfPosition(dec.getStart(sourceFile));
      const { className, methodName } = getEnclosingClassAndMethod(dec);
      subs.push({
        eventName,
        eventExpr,
        file: rel,
        pos,
        className,
        methodName,
      });
    }
  }

  const moduleProviders = collectModuleProviders(program);

  const findings: Finding[] = [];

  // 1) Every discovered event name must be resolvable and exist in catalog.
  for (const e of emits) {
    if (!e.eventName) {
      findings.push({
        level: "warning",
        code: "EVENT_NAME_UNRESOLVABLE",
        message:
          "emit() event name is not a string literal or resolvable const (skipping catalog/producer validation)",
        file: e.file,
        line: e.pos.line + 1,
        col: e.pos.character + 1,
      });
      continue;
    }
    const catalogEvent = catalogByEvent.get(e.eventName);
    if (!catalogEvent) {
      findings.push({
        level: "error",
        code: "CATALOG_MISSING_EVENT",
        message: `emit(${e.eventName}) not registered in event-catalog.json`,
        file: e.file,
        line: e.pos.line + 1,
        col: e.pos.character + 1,
      });
      continue;
    }

    if (!e.className) {
      findings.push({
        level: "error",
        code: "CATALOG_MISSING_PRODUCER",
        message: `emit(${e.eventName}) producer location not in a class; cannot verify producer registration`,
        file: e.file,
        line: e.pos.line + 1,
        col: e.pos.character + 1,
      });
      continue;
    }

    const producers = catalogEvent.producers || [];
    const matched = producers.some((p) => {
      if (p.status === "planned") return false;
      if (p.file && p.file !== e.file) return false;
      if (p.class !== e.className) return false;
      if (p.method && e.methodName && p.method !== e.methodName) return false;
      if (p.method && !e.methodName) return false;
      return true;
    });
    if (!matched) {
      findings.push({
        level: "error",
        code: "CATALOG_MISSING_PRODUCER",
        message: `emit(${e.eventName}) producer ${e.className}${e.methodName ? "." + e.methodName : ""} not registered in event-catalog.json`,
        file: e.file,
        line: e.pos.line + 1,
        col: e.pos.character + 1,
      });
    } else {
      const style = catalogEvent.payloadStyle || "raw";
      findings.push(...validatePayloadStyle(checker, style, e.eventName, e));
    }
  }

  for (const s of subs) {
    if (!s.eventName) {
      findings.push({
        level: "error",
        code: "EVENT_NAME_UNRESOLVABLE",
        message: "@OnEvent() event name is not a string literal or resolvable const",
        file: s.file,
        line: s.pos.line + 1,
        col: s.pos.character + 1,
      });
      continue;
    }

    if (!catalogByEvent.has(s.eventName)) {
      findings.push({
        level: "error",
        code: "CATALOG_MISSING_EVENT",
        message: `@OnEvent(${s.eventName}) not registered in event-catalog.json`,
        file: s.file,
        line: s.pos.line + 1,
        col: s.pos.character + 1,
      });
    }

    if (!s.className || !s.methodName) {
      findings.push({
        level: "error",
        code: "REGISTRY_MISSING_SUBSCRIPTION",
        message: "@OnEvent() is not on a class method; cannot verify subscription registry",
        file: s.file,
        line: s.pos.line + 1,
        col: s.pos.character + 1,
      });
      continue;
    }

    const key = `${s.eventName}|${s.className}|${s.methodName}`;
    if (!registryKeys.has(key)) {
      findings.push({
        level: "error",
        code: "REGISTRY_MISSING_SUBSCRIPTION",
        message: `@OnEvent(${s.eventName}) subscriber ${s.className}.${s.methodName} not registered in subscription-registry.json`,
        file: s.file,
        line: s.pos.line + 1,
        col: s.pos.character + 1,
      });
    }

    if (!moduleProviders.has(s.className)) {
      findings.push({
        level: "error",
        code: "SUBSCRIBER_NOT_REGISTERED_IN_MODULE",
        message: `Subscriber class ${s.className} is not registered in any *.module.ts providers[] (Nest won't instantiate it)`,
        file: s.file,
        line: s.pos.line + 1,
        col: s.pos.character + 1,
      });
    }
  }

  // 2) Registry should not contain subscriptions that aren't implemented.
  const discoveredSubKeys = new Set<string>();
  for (const s of subs) {
    if (s.eventName && s.className && s.methodName) {
      discoveredSubKeys.add(`${s.eventName}|${s.className}|${s.methodName}`);
    }
  }
  for (const r of registry.subscriptions) {
    const key = `${r.event}|${r.subscriber.class}|${r.subscriber.method}`;
    if (r.status === "planned") continue;
    if (!discoveredSubKeys.has(key)) {
      findings.push({
        level: "error",
        code: "REGISTRY_SUBSCRIPTION_NOT_IMPLEMENTED",
        message: `Registry subscription ${r.subscriber.class}.${r.subscriber.method} for ${r.event} is not implemented (@OnEvent not found)`,
      });
    }
  }

  // 3) Catalog producers should not contain entries that aren't implemented.
  const discoveredEmitKeys = new Set<string>();
  const discoveredEmitKeysWithFile = new Set<string>();
  for (const e of emits) {
    if (e.eventName && e.className) {
      discoveredEmitKeys.add(`${e.eventName}|${e.className}|${e.methodName || ""}`);
      discoveredEmitKeys.add(`${e.eventName}|${e.className}|`);
      discoveredEmitKeysWithFile.add(`${e.eventName}|${e.className}|${e.methodName || ""}|${e.file}`);
      discoveredEmitKeysWithFile.add(`${e.eventName}|${e.className}||${e.file}`);
    }
  }
  for (const evt of catalog.events) {
    for (const p of evt.producers || []) {
      if (p.status === "planned") continue;
      const key = `${evt.name}|${p.class}|${p.method || ""}`;
      const keyWithFile = `${evt.name}|${p.class}|${p.method || ""}|${p.file || ""}`;
      const implemented = p.file ? discoveredEmitKeysWithFile.has(keyWithFile) : discoveredEmitKeys.has(key);
      if (!implemented) {
        findings.push({
          level: "error",
          code: "CATALOG_PRODUCER_NOT_IMPLEMENTED",
          message: `Catalog producer ${p.class}${p.method ? "." + p.method : ""} for ${evt.name} is not implemented (emit not found)`,
        });
      }
    }
  }

  // 4) Events that require consumers must have at least one registry subscription.
  const registryCountByEvent = new Map<string, number>();
  for (const s of registry.subscriptions) {
    if (s.status === "planned") continue;
    registryCountByEvent.set(s.event, (registryCountByEvent.get(s.event) || 0) + 1);
  }
  for (const evt of catalog.events) {
    if (evt.status === "planned" || evt.status === "deprecated") continue;
    if (evt.allowNoConsumer) continue;
    const count = registryCountByEvent.get(evt.name) || 0;
    if (count === 0) {
      findings.push({
        level: "error",
        code: "CATALOG_EVENT_REQUIRES_CONSUMER",
        message: `Catalog event ${evt.name} requires at least 1 consumer, but subscription-registry has none`,
      });
    }
  }

  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warning");

  const lines: string[] = [];
  for (const f of findings) {
    const loc = f.file ? `${f.file}${f.line ? ":" + f.line : ""}${f.col ? ":" + f.col : ""}` : "";
    lines.push(`[${f.level.toUpperCase()}][${f.code}] ${loc ? loc + " " : ""}${f.message}`);
  }

  if (lines.length) {
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
  }
  if (warnings.length) {
    // eslint-disable-next-line no-console
    console.log(`\nWarnings: ${warnings.length}`);
  }
  if (errors.length) {
    // eslint-disable-next-line no-console
    console.error(`\nErrors: ${errors.length}`);
    process.exit(1);
  }
}

main();
