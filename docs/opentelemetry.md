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

OpenTelemetry 的核心数据结构包括 **Resource**、**Span**、**Attribute**、**Tracer**，它们构成了完整的追踪体系。

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

**2. Span（追踪单元）**
- **定义**：表示"做了什么"，是 trace 中的一个行为片段
- **特点**：请求/操作级，包含 traceId、spanId、parentSpanId、name 等核心信息
- **示例**：
  - HTTP 请求 → `Span: "Http GET /orders"`
  - 数据库操作 → `Span: "SQL SELECT orders"`
  - Redis 调用 → `Span: "Redis GET order:12"`

**3. Attribute（属性）**
- **定义**：描述资源或动作的额外信息（Details）
- **特点**：键值对形式，可挂载在 Resource 或 Span 上
- **示例**：
  - Resource Attributes: `service.name=payment-service`, `deployment.environment=staging`
  - Span Attributes: `http.method=GET`, `db.system=postgresql`, `db.response_time_ms=84`

**4. Tracer（追踪器）**
- **定义**：用于创建 Span 的对象，代表一个可追踪操作来源（instrumentation source）
- **特点**：区分不同框架/库的追踪来源，不能直接创建 Span，必须通过 Tracer
- **示例**：
  - NestJS 追踪 → `"@opentelemetry/instrumentation-nestjs"`
  - HTTP 客户端追踪 → `"@opentelemetry/instrumentation-http"`
  - 业务追踪 → `"payment-service"`

**层级关系**

```
Service Process (Resource)
 ├─ Span A: "Http GET /orders" [Attributes: http.method=GET, http.status_code=200]
 ├─ Span B: "SQL SELECT orders" [Attributes: db.system=postgresql, db.response_time_ms=84]
 └─ Span C: "Redis GET order:12" [Attributes: db.system=redis]
```

**关系总结**

| 概念 | 表示意义 | 生命周期 | 关系 |
|------|---------|---------|------|
| Resource | 谁发出的 | 进程级 | 所有 Span 的父级 |
| Span | 做了什么 | 请求/操作级 | 通过 Tracer 创建，共享 Resource |
| Attribute | 描述细节 | 依附于 Resource/Span | 为 Resource 或 Span 提供额外信息 |
| Tracer | 追踪来源 | 工具对象 | 用于创建 Span，标记 instrumentation 来源 |

#### Span vs Log 使用决策

**总体结论**

| 用途 | 建议使用 |
|------|---------|
| 记录一个"操作"、"行为"、"事务过程" | **Span** |
| 记录事件细节、状态信息、调试信息 | **Log** |

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

**决策矩阵**

| 情况描述 | 用 Span | 用 Log |
|---------|---------|--------|
| 有明确开始、结束 | ✅ | optional |
| 能度量耗时 | ✅ | optional |
| 是性能瓶颈来源 | ✅ | optional |
| 是用户可感知动作 | ✅ | optional |
| 只输出状态文本 | ❌ | ✅ |
| 高频且无性能意义 | ❌ | ✅ |
| 调试变量、上下文 | ❌ | ✅ |
| 错误细节 | optional | ✅ |
| 出现异常时定位问题 | Span + Log | ✅ |
