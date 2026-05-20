# Contributing to Canvas

Welcome! This document outlines the developer standards, code architecture patterns, and contribution guidelines for the Canvas component.

## Core Architecture Pillars

1.  **Infinite Coordinate Panning**:
    *   Coordinate math transforms screen mouse positions to absolute canvas world coordinates using linear scaling.
    *   State updates are batched to prevent visual jitter.
2.  **Anti-Bleed Style Isolation**:
    *   All UI styles are encapsulated inside class namespaces (`.edit-panel`, `.burger-menu-button`) to prevent style interference with global Obsidian workspace themes.
3.  **Sterile Zero-Dependency Design**:
    *   Relies strictly on React/Preact hooks provided by the `dc` host environment.

## Local Development Loop

*   **Watchdog Reload Trigger**: The component listens for changes to `data/mcp_commands.json` and updates the layout immediately.
*   **HMR Integration**: Any local code edit inside the `src/` directory can be forced to reload using the hot-reload watcher.
