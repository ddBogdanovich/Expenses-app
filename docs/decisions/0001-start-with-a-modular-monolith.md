# ADR 0001: Start with a modular monolith

- Status: Accepted
- Date: 2026-09-20

## Context

The application must become useful quickly while providing room to study domain-driven design, messaging, and Kubernetes. Splitting the initial product into independently deployed services would add network and operational failure modes before the domain boundaries have been validated.

## Decision

Begin with one deployable backend whose domain and application code is divided into explicit modules. Budgeting and expense recording initially form the core module. Reporting may later become a separate worker when messaging is introduced.

The domain model does not depend on ASP.NET Core, Entity Framework Core, RabbitMQ, or UI code.

## Consequences

Transactions and local development remain straightforward. Module boundaries can be tested before any physical split. Messaging and independent deployment will be introduced only where the reporting use case supplies a concrete reason for them.

