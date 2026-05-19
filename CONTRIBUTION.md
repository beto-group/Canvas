# Contributing to Canvas

Welcome! This document outlines the core developer standards, dynamically loaded dependencies, and architectural patterns required to maintain the advanced implementation of the Canvas component.

---

## Core Architecture Pillars

1. **Dynamic Sandbox Component Rendering**:
   * Enables users to load and interact with any other Datacore component within isolated "boxes" on the infinite canvas.
   * Utilizes dynamic imports and standard prop mapping to inject parameters dynamically.

2. **Infinite Navigation & Focus Lock**:
   * Implements custom interaction hooks (spacebar dragging, Ctrl/Cmd wheel zoom, marquee multi-select) with focus locking to prevent standard Obsidian hotkeys from interfering.
   * Manages absolute coordinates and scale bounds to translate screen mouse movements to canvas world space.

3. **Banned Emojis in React UI**:
   * Emojis are strictly prohibited inside the user interface to ensure a modern, premium appearance.
   * Any control toolbar options, modal buttons, or status indicators MUST be wired directly to Lucide vectors using the built-in `<dc.Icon>` component or plain text.

---

## Local Compilation and Developer Loop

* **Logic Entry Point**: All component coordinates and React views reside in `src/App.jsx`.
* **Index Factory**: The bootstrapper/loader hook that handles namespaces and builds the view resides in `src/index.jsx`.
* **Hot Reload Trigger**: Invoke `dc.app.workspace.activeLeaf.rebuildView()` to flush the view cache. The visualizer compiles your changes instantly without a full application restart.
