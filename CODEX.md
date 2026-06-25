# Project Rules

Always read:

1. docs/project-overview.md
2. docs/architecture.md
3. docs/current-state.md
4. docs/todo.md

Project Type:
Investment Operating System

Current Stage:
Portfolio Tracking

Future Stages:
- News Analysis
- Research System
- Paper Trading
- Trading Bot

Do not:
- delete existing tables
- change architecture
- implement real trading

without updating docs/decisions.md.

Supabase is the primary database. The active journal table is `investment_journal`.
