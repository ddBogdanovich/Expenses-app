# Poland Expenses

A personal budgeting application built to make a rolling daily allowance easy to understand and use. It is also a guided learning project for domain-driven design, React, ASP.NET Core, messaging, and Kubernetes.

## Current milestone

Milestone 1 establishes the domain language and the application foundation. The solution contains the domain model, strict repository-wide build rules, an ASP.NET Core API, shared Aspire service defaults, and an AppHost that orchestrates the API. Persistence and UI concerns will be added with the first feature that needs them.

## Planned frontend

The React frontend will use **HeroUI** as its component library. We will introduce it when the frontend application is scaffolded and record the resulting design and accessibility conventions in the learning documentation.

## Prerequisites

- .NET SDK 10
- Aspire CLI 13.5 or later

## Run the tests

```shell
dotnet test
```

See [docs/domain-model.md](docs/domain-model.md) for the current rules and worked examples.

## Architecture

The backend is a modular monolith with a clean domain core and vertically organized use cases:

```text
Domain <- UseCases <- Infrastructure <- Api <- AppHost
```

- `Domain` owns business language and invariants.
- `UseCases` owns feature handlers and HTTP endpoint modules.
- `Infrastructure` will implement aggregate repositories, query services, messaging, and integrations.
- `Api` composes the application.
- `AppHost` runs and observes local resources.

Read [ADR 0002](docs/decisions/0002-clean-domain-with-vertical-use-cases.md) for the decisions and tradeoffs.

## Learning workflow

Each implementation step follows the same loop:

1. Name the product or design problem.
2. Explain the relevant concept and its alternatives.
3. Implement one small example together.
4. Complete a focused exercise.
5. Review the result and record the decision.

Start with [Value objects and Money](docs/learning/001-value-objects-and-money.md), continue to [Project foundations and vertical slices](docs/learning/002-project-foundation-and-vertical-slices.md), then complete [Exercise 001](docs/exercises/001-rolling-allowance.md).

## Local orchestration

Aspire is the development composition root from the first milestone. The AppHost starts the API and the Aspire dashboard exposes resource state, structured logs, traces, and metrics.

```shell
cd PolandExpenses.AppHost
aspire start
```

Open the dashboard URL printed by Aspire. The API exposes development health endpoints at `/health` and `/alive`.
