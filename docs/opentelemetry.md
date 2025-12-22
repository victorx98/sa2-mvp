### OpenTelemetry 简介

**OpenTelemetry (OTEL)** 是一个开源的、厂商中立的可观测性（Observability）框架。它的主要目的是为云原生软件的遥测数据（Traces, Metrics, Logs）的生成、收集和导出提供一套统一的标准和工具。通过标准化，开发者可以避免被特定的监控工具或供应商绑定，并以一致的方式来检测、分析和排查他们的应用。

#### 核心组件与数据流

OpenTelemetry 的工作流程可以被看作一个数据处理管道，从应用代码开始，到最终的分析系统结束。

[业务应用代码]
      │
      ▼
[**Instrumentation (插桩层)**]
*   **职责**: 负责“自动打点”。
*   **说明**: 这是与应用代码直接交互的第一层。它能够自动识别并捕获来自通用框架和库的关键事件，例如一个 Express 的 HTTP 请求、一次数据库（DB）调用或一次文件读写，而无需开发者手动编写大量追踪代码。

      │
      ▼
[**Language SDK (语言开发工具包)**]
*   **职责**: 负责“生成数据”。
*   **说明**: 当插桩层捕获到一个事件后，特定语言的 SDK（如 Node.js SDK, Java SDK）会介入，将这些事件信息转换成标准化的遥测数据对象，即 **Trace**、**Metrics** 和 **Logs**。

      │
      ▼
[**OTLP Exporter / SDK Exporter (导出器)**]
*   **职责**: 将数据导出给 Collector。
*   **说明**: 导出器是 SDK 的一部分，它负责将格式化后的遥测数据通过 OTLP (OpenTelemetry Protocol) 协议或其他协议发送到下一个目的地。

      │
      ▼
[**OpenTelemetry Collector (收集器)**]
*   **职责**: 负责“汇聚和转发”。
*   **说明**: Collector 是一个独立、高效的代理服务。它的核心功能是：**接收**来自一个或多个数据源的遥ce测数据，进行**处理**（如过滤、增加属性、数据采样），**转换**格式，然后**转发**到一个或多个后端分析系统。它将应用与具体的分析工具解耦，让架构更具flexibility。

      │
      ▼
[**后端分析系统 (Backend Analysis System)**]
*   **职责**: 负责“分析与可视化”。
*   **说明**: 这是遥测数据的最终目的地。在这里，数据被存储、索引、分析和可视化，以供开发者进行故障排查、性能监控和告警。常见的后端系统包括 **Jaeger**、**Prometheus**、**Grafana Tempo**，以及商业方案如 **Datadog**、**AWS X-Ray** 等。

#### 收益

1. **Trace：贯通端到端链路**  
   - Next.js 前端在发起请求时写入 `traceparent` header，NestJS 后端沿用同一 `traceId`/`spanId` 继续链路。  
   - 这样可以一眼定位“某个页面点击 → API Gateway → Nest 用例 → 下游服务”的每一步耗时与错误点，实现真正的 Full-Stack Observability。  
   - 结合 Collector 的采样与属性增强，还能按用户、租户或版本维度做性能对比。
![Grafana Cloud Traces](https://grafana.com/media/products/cloud/traces/grafana-products-traces-hero.png)

2. **Metric：量化性能与容量**  
   - 自动统计系统层（CPU使用率、内存使用率等）
   - 自动查看到api层（各api实时请求量、平均耗时）
![Grafana Cloud Metric](https://grafana.com/static/img/docs/grafana-cloud/visualization_sample.png)

3. **Log：上下文感知的排障体验**  
   - OTEL 规范支持在日志里自动附带 `traceId`、`spanId` 与自定义属性，Collector 再统一转发到 Loki/CloudWatch Logs。  
   - 当告警触发时，工程师只需从某个 span 直接跳到相关日志，而不用手动 grep 容器或翻旧的 log 文件。  
   - 同一个 Log/Trace 上下文，也便于安全审计或业务追责。

#### 上报的核心数据结构

OpenTelemetry 上报的核心数据结构包括 **Resource**、**Span**、**Attribute**、**log**，另外还有抽象工具**Trace**，它们构成了完整的追踪体系。

**1. Resource（资源）**
- **定义**：表示"是谁"在上报，描述发出 trace 的实体身份信息
- **特点**：进程级静态信息，同一服务实例的所有 Span 共享同一个 Resource
- **示例**：
  ```
  service.name=saas-order-service
  service.version=1.0.3
  service.namespace=production
  cloud.provider=aws
  ```

**2. Trace（追踪）**
- **定义**：表示"一次完整的请求/事务"，是由多个 Span 组成的有向无环图（DAG）
- **特点**：请求级抽象概念，通过 traceId 唯一标识，包含该请求在整个系统中的完整执行路径
- **示例**：
  - 一次 HTTP API 调用 → 包含 HTTP Span、DB Span、Redis Span 等
  - 一次订单处理事务 → 包含支付 Span、库存 Span、通知 Span 等
  - 跨服务调用链路 → 通过 traceId 关联前端、API Gateway、后端服务、数据库等多个 Span

**3. Span（追踪单元）**
- **定义**：表示"做了什么"，是 trace 中的一个行为片段
- **特点**：请求/操作级，包含 traceId、spanId、parentSpanId、name 等核心信息
- **示例**：
  - HTTP 请求 → `Span: "Http GET /orders"`
  - 数据库操作 → `Span: "SQL SELECT orders"`
  - Redis 调用 → `Span: "Redis GET order:12"`

**4. Attribute（属性）**
- **定义**：描述资源或动作的额外信息（Details）
- **特点**：键值对形式，可挂载在 Resource 或 Span 上
- **示例**：
  - Resource Attributes: `service.name=payment-service`, `deployment.environment=staging`
  - Span Attributes: `http.method=GET`, `db.system=postgresql`, `db.response_time_ms=84`

**5. Trace（追踪工具）**
- **定义**：OpenTelemetry 提供的工具对象，用于获取当前上下文中的 Tracer 和 Span
- **特点**：提供上下文感知的 API，能够访问当前执行环境中的追踪信息
- **核心方法**：
  - `trace.getTracer(name, version?)`：获取指定名称的 Tracer 实例，用于创建新的 Span
    - 示例：`const tracer = trace.getTracer('payment-service')`
    - 用途：在装饰器、拦截器等场景中创建业务 Span
  - `trace.getActiveSpan()`：获取当前上下文中活跃的 Span
    - 示例：`const span = trace.getActiveSpan()`
    - 用途：获取当前 traceId、spanId，或在日志中关联追踪上下文

**层级关系**

```
Resource (进程级)
 └─ Trace (一次请求 / 事务)
     ├─ Span A (HTTP)
     │   ├─ Attributes: http.method=GET, http.status_code=200
     │   ├─ Event: request.received
     │   └─ ─ ─ ─ Log: "Processing HTTP request"
     ├─ Span B (DB)
     │   ├─ Attributes: db.system=postgresql, db.response_time_ms=84
     │   └─ Event: query.completed
     │   └─ ─ ─ ─ Log: "Executing SQL query"
     └─ Span C (Redis)
         ├─ Attributes: db.system=redis
         └─ Event: cache.hit
         └─ ─ ─ ─ Log: "Cache lookup"
```

**关系总结**

| 概念 | 表示意义 | 生命周期 | 关系 |
|------|---------|---------|------|
| Resource | 谁发出的 | 进程级 | 所有 Span 的父级 |
| Trace | 一次完整请求/事务 | 请求级 | 包含多个 Span，通过 traceId 唯一标识 |
| Span | 做了什么 | 请求/操作级 | 属于某个 Trace，共享 Resource |
| Attribute | 描述细节 | 依附于 Resource/Span | 为 Resource 或 Span 提供额外信息 |
| Log | 事件记录 | 事件级 | 通过 traceId/spanId 关联到 Trace/Span |
| trace (工具) | 追踪工具对象 | 工具对象 | 提供 `getTracer()` 和 `getActiveSpan()` 方法，用于获取或创建 Tracer 和当前 Span |

#### Span vs Log vs Event 使用决策

**总体结论**

| 用途 | 建议使用 |
|------|---------|
| 记录一个"操作"、"行为"、"事务过程" | **Span** |
| 记录事件细节、状态信息、调试信息 | **Log** |
| 记录 Span 内部的关键事件点 | **Event** |

**何时使用 Span**

满足以下任意一条，应使用 Span：
- ✓ 这是一个可衡量耗时的动作（如：查询数据库、调用 API、执行业务计算）
- ✓ 需要成为 Trace 中可视化节点
- ✓ 有明确开始、结束
- ✓ 是性能瓶颈来源
- ✓ 是用户可感知动作

**何时使用 Log**

Log 用于捕获事件，而不是行为过程：
- ✓ 输出状态说明（如："Start processing order #49321"、"Retry request due to timeout"）
- ✓ 只输出状态文本
- ✓ 高频且无性能意义
- ✓ 调试变量、上下文信息
- ✓ 错误细节

**何时使用 Event**

Event 不是日志，也不是独立存在的，它属于某一个 Span：
- ✓ 重试发生一次（在重试 Span 内记录）
- ✓ 某个状态变化（如："cache hit"、"cache miss"）
- ✓ 阶段性 checkpoint（如："validation passed"、"payment initiated"）
- ✓ 模块内部关键但非独立行为（在 Span 生命周期内的关键节点）

**决策矩阵**

| 情况描述 | 用 Span | 用 Log | 用 Event |
|---------|---------|--------|----------|
| 有明确开始、结束 | ✅ | optional | ❌ |
| 能度量耗时 | ✅ | optional | ❌ |
| 是性能瓶颈来源 | ✅ | optional | ❌ |
| 是用户可感知动作 | ✅ | optional | ❌ |
| 只输出状态文本 | ❌ | ✅ | optional |
| 高频且无性能意义 | ❌ | ✅ | optional |
| 调试变量、上下文 | ❌ | ✅ | ❌ |
| 错误细节 | optional | ✅ | optional |
| 出现异常时定位问题 | Span + Log | ✅ | optional |
| Span 内部的关键事件点 | ❌ | optional | ✅ |
| 状态变化（如 cache hit/miss） | ❌ | optional | ✅ |
| 阶段性 checkpoint | ❌ | optional | ✅ |

#### 统一异常可观测性上报：异常作为 Event 记录

**核心原则**
在 OTel 里，异常 ≠ 日志，而是一个**结构化事件（Event）**，挂在 Span 上。

**标准做法（语义规范）**
1. 在当前 Span 上记录 exception event（使用 `span.recordException()`）
2. 将 Span 状态标记为 ERROR（使用 `span.setStatus({ code: SpanStatusCode.ERROR })`）

**实现方式**
通过全局 ExceptionFilter 统一处理，避免在每个 service 中重复编写：

**效果**
- 任意 controller/service 抛异常 → 自动挂到当前 HTTP Span 上
- Trace 页面直接标红显示异常的 Span
- 异常信息作为 Event 包含在 Trace 中，便于排查问题
