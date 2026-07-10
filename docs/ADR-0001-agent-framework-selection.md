# ADR-0001: Agent Framework Selection

- **Status:** Accepted
- **Date:** 2026-07-10
- **Context area:** Backend / multi-agent architecture

## Context

As Laxie grows from a single risk domain (schedule conflicts) toward multiple
domains (inventory, subscriptions, and more), we are formalizing a multi-agent
architecture: a perception layer of per-domain sensor agents, a decision layer
(risk arbiter, resolution planner, language actuator), and a cross-cutting
governance layer (autonomy governor, execution). See
`ARCHITECTURE_MultiAgent.md` for the full design.

That raised the question: **do we need an agent framework** — Pydantic AI,
Google ADK, or Claude Managed Agents — to build this?

The key distinction that drives this decision:

> **A "multi-agent architecture" (how the system is organized) is not the same
> thing as an "agent framework" (an SDK that runs an LLM tool-use loop).**

Our multi-agent decomposition is a *code-structure* decision. Most of our
"agents" are deterministic rule engines, not open-ended model-driven
exploration:

- The subscription sensor (`app/src/services/subscriptions.ts`) is pure
  functions — no LLM, no token cost.
- Risk detection (`backend/functions/src/risk-detection/`) is threshold logic.
- The arbiter, governor, and execution layers are deterministic control flow.

The only genuinely LLM-shaped step today is the **language actuator**
(`backend/functions/src/language-actuator/`), which turns a resolution into a
family-tone message — a single model call, not an agentic loop. The resolution
planner *could* become agentic later if it needs to call tools and iterate, but
it does not today.

### Relevant constraints

- The backend is **TypeScript on Firebase Cloud Functions (node20)**.
- Coordination is already event choreography via Firestore triggers.
- We are a small team optimizing for few moving parts and low operational cost.
- The Product Constitution favors deterministic, auditable behavior and treats
  a notification (and, by extension, an unpredictable LLM action) as a failure
  mode unless it is a real, reversible action.

## Options considered

| Option | Language | Fit for Laxie |
|---|---|---|
| **Pydantic AI** | Python | Would require standing up a separate Python service alongside the TS Firebase backend — a second runtime, second deploy target, cross-service calls. Only justified if we deliberately move the "brain" out of Firebase. |
| **Google ADK** | Python (+ Java) | Same second-runtime cost; strongest when leaning on Google-agent tooling we are not using. Our stack is Firebase/Firestore, not the ADK ecosystem. |
| **Claude Managed Agents** | Language-agnostic (REST / TS SDK) | Anthropic runs the agent loop *and* hosts a per-session sandbox for tool execution; offers versioned agent configs, scheduled (cron) deployments, and a credential vault. Beta; adds an external dependency and cost. Overkill while our agents are deterministic, but the natural home for a *future* autonomous "actually cancel the subscription" agent that needs tools + a sandbox + credentials. |
| **No framework — Anthropic TS SDK direct** | TypeScript | Keep the multi-agent decomposition as plain Cloud Functions + Firestore choreography. For the one LLM step, call `client.messages.create` directly. If a step later needs a genuine tool-use loop, use the SDK's **Tool Runner** (`client.beta.messages.toolRunner`) — part of the regular `@anthropic-ai/sdk`, no new runtime. |

## Decision

**For now, do not adopt an agent framework.** Specifically:

1. **Multi-agent decomposition stays as TypeScript Cloud Functions + Firestore
   choreography.** The sensor/arbiter/governor structure is code organization,
   not a framework dependency.

2. **The single LLM step (language actuator) uses the Anthropic TypeScript SDK
   directly** (`client.messages.create`), running inside Cloud Functions — no
   second runtime.

3. **Reach for the Anthropic Tool Runner** (`client.beta.messages.toolRunner`,
   still the `@anthropic-ai/sdk`) **only when a step becomes a real agentic
   loop** — the model must call multiple tools and iterate (e.g. a resolution
   planner that looks up options dynamically). This adds an agent loop without
   changing language or adding a service.

4. **Reserve Claude Managed Agents for a specific future case:** an autonomous
   agent that must *act in the world on a schedule with its own tools and
   credentials* — e.g. actually cancelling an idle subscription via a
   service/website. Its hosted loop + sandbox + cron deployments + credential
   vault map directly to that scenario. Re-evaluate when we build it.

### Decision shortcut

```
Need a separate Python service?           → No  → skip Pydantic AI / Google ADK
Is this step open-ended multi-tool
exploration by the model?
   No                                      → single messages.create (+ structured output)
   Yes, self-hosted                        → Tool Runner (TS SDK, stays in Firebase)
   Yes, needs hosted sandbox + cron + creds → Claude Managed Agents
```

## Consequences

**Positive**

- One language, one runtime, one deploy target — the whole backend stays in
  TypeScript on Firebase.
- No premature framework lock-in; the multi-agent structure evolves as plain
  code we fully control and can unit-test (the subscription engine is already a
  pure-function example).
- Rules-first keeps token cost near zero for the deterministic layers, matching
  the Constitution's bias toward predictable, auditable behavior.
- A clear, documented upgrade path (direct call → Tool Runner → Managed Agents)
  so we introduce complexity only when a concrete step demands it.

**Negative / trade-offs**

- If we later need heavy Python-only agent tooling, we will revisit this and
  accept the cost of a second service at that point.
- Managed Agents' scheduled deployments could one day replace our own
  `scheduledRiskDetection` cron; deferring means we keep maintaining that
  scheduler ourselves for now.

## Related notes

- The language actuator currently calls **OpenAI**. Since we are standardizing
  on Claude for new work, migrating that single call to Claude
  (`claude-opus-4-8` for quality; `claude-sonnet-5` / `claude-haiku-4-5` if we
  need to control cost at family-scale volume) is a reasonable follow-up — but
  it is an independent decision, not a prerequisite for anything above.
- See `ARCHITECTURE_MultiAgent.md` for the agent catalog and coordination model
  this decision supports.
