---
name: citycake-mode
description: "The router for any multi-step task in this repo. Use at the start of a feature, a design pass, a data change or a fix. Reads the request, picks a playbook, and names the skills and docs each step needs."
---

# City Cake mode

Read `AGENTS.md` in full first. It holds the rules this skill assumes.

## Start

Open a todo list with one entry per step of the playbook you pick. Name the playbook in your first reply.

## Playbooks

| Request looks like | Playbook |
|---|---|
| a new page, flow or Convex function | **build-feature** skill |
| make a screen look right, restyle, illustration | **design-pass** skill |
| more or different places, a new city, a new category | **ingest-data** skill |
| something is broken | reproduce it, find the cause, fix the cause, then the **verify** skill |
| a question about how something works | read the code and the docs, answer with `file:line` references, change nothing |

## Delegation

- Split work by file ownership, not by step. Two agents never edit the same file in one wave.
- Give each delegate: the task, the paths it owns, the docs to read, the contract it must keep (from `docs/architecture.md`), and what proof to return.
- The main thread keeps decisions, contracts and commits. Delegates return a summary, not file dumps.

## Finish

Run the **verify** skill. Commit one logical unit with an imperative message. Report what changed and how you proved it, in that order.
