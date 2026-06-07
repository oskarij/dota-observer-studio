# Local Overlay Hosting Platform - Architecture Overview

## Vision

Build a desktop application that functions primarily as a **local overlay hosting platform** for streaming software.

The application hosts browser-based overlays on local HTTP endpoints and provides tools for creating, managing, previewing, and controlling those overlays.

The hosted overlays are the primary product. The desktop application serves as the control surface used to manage them.

The system should be simple to download, launch, and use while remaining highly extensible for future functionality.

---

# Core Objectives

## Local Overlay Hosting

Expose browser-based overlays through local HTTP endpoints.

Example endpoints:

```text
http://localhost:3333/overlay/main
http://localhost:3333/overlay/chat
http://localhost:3333/overlay/alerts
```

These endpoints should be consumable by:

* OBS Browser Sources
* Streamlabs
* Other streaming software
* Local browser windows
* Future integrations

## Runtime Control

Allow overlays to be updated and controlled while active.

Changes made through the application should be reflected in hosted overlays with minimal interruption.

## Local-First Operation

Core functionality should not require cloud infrastructure or external services.

The application should remain fully functional offline.

## Low User Friction

Users should be able to:

1. Download the application
2. Launch the application
3. Start hosting overlays

without additional dependency installation or infrastructure setup.

## Future Extensibility

The architecture should support future expansion without requiring fundamental redesign.

---

# Technology Stack

## Desktop Shell

**Electron**

Responsibilities:

* Application lifecycle
* Window management
* Process orchestration
* Native operating system integration

Electron is selected because:

* It provides a self-contained desktop experience
* It aligns well with browser-based overlay development
* Its Chromium-based rendering environment is similar to the rendering model used by OBS Browser Sources

---

## User Interface

**SvelteKit + TypeScript**

Responsibilities:

* Overlay management
* Overlay editing
* Settings and configuration
* Preview tools
* User workflows

SvelteKit is selected because:

* It provides a clean and maintainable UI architecture
* It supports rapid iteration
* It integrates naturally with TypeScript
* It keeps the presentation layer independent from runtime concerns

---

## Build Tooling

**Vite**

Responsibilities:

* Development environment
* Hot reloading
* Production builds

---

## Local Storage

**SQLite**

Responsibilities:

* Overlay definitions
* Overlay identifiers
* User preferences
* Application configuration
* Templates
* Future structured application data

SQLite is selected because:

* No separate database installation is required
* Data remains local
* It scales sufficiently for the application's expected needs

---

# High-Level Architecture

```text
┌──────────────────────────────┐
│        Desktop Shell         │
│          Electron            │
└──────────────┬───────────────┘
               │
               ▼

┌──────────────────────────────┐
│     Overlay Management       │
│      SvelteKit UI            │
└──────────────┬───────────────┘
               │
               ▼

┌──────────────────────────────┐
│      Overlay Runtime         │
│      Local HTTP Host         │
└───────┬───────────┬──────────┘
        │           │
        │           │
        ▼           ▼

 ┌────────────┐ ┌─────────────┐
 │ OBS Source │ │ Internal    │
 │ Consumers  │ │ Preview     │
 └────────────┘ └─────────────┘

               ▲
               │

┌──────────────┴───────────────┐
│       Persistence Layer      │
│           SQLite             │
└──────────────────────────────┘
```

---

# System Components

## Desktop Shell

Provides the desktop application container.

Responsibilities:

* Startup and shutdown
* Window management
* Runtime monitoring
* Process orchestration

The shell should contain minimal business logic.

---

## Overlay Management Layer

Provides tools for managing overlays.

Responsibilities:

* Overlay creation
* Overlay editing
* Overlay configuration
* Overlay organization
* Template management

The management layer determines what should be hosted.

---

## Overlay Hosting Runtime

The central component of the system.

Responsibilities:

* Hosting overlay endpoints
* Managing overlay routes
* Serving overlay assets
* Providing runtime data
* Managing active overlay sessions
* Supporting dynamic updates

The runtime exists independently from the editor UI.

If an overlay is active, the runtime should continue serving it regardless of which editor view is open.

---

## Preview System

Provides an internal representation of hosted overlays.

Responsibilities:

* Visual preview
* Runtime inspection
* Development feedback

The preview should consume the same hosted overlay endpoints used by external clients whenever practical.

Example:

```text
OBS
 └─ http://localhost:3333/overlay/main

Preview Window
 └─ http://localhost:3333/overlay/main
```

This reduces differences between preview behavior and production behavior.

---

## Persistence Layer

Provides local storage.

Responsibilities:

* Overlay metadata
* Overlay configuration
* User preferences
* Runtime configuration
* Templates
* Future application data

The persistence layer should remain isolated from UI concerns.

---

# Overlay Model

An overlay is a hosted web resource exposed through a local HTTP endpoint.

Example:

```text
Overlay: Main
Endpoint: /overlay/main

Overlay: Chat
Endpoint: /overlay/chat

Overlay: Alerts
Endpoint: /overlay/alerts
```

Each overlay should:

* Have a unique identifier
* Be independently configurable
* Be independently hostable
* Support runtime updates

---

# Runtime Update Model

The platform should support dynamic runtime updates.

When overlay configuration changes:

1. The editor updates application state
2. The runtime receives the update
3. Active overlay instances receive the update
4. Changes appear without requiring full page reloads whenever possible

The exact implementation mechanism is intentionally unspecified.

---

# Architectural Principles

## Separation of Concerns

UI, runtime hosting, persistence, and desktop orchestration should remain independent.

## Modular Design

Each major component should be replaceable or extendable with minimal impact on other parts of the system.

## Local-First

Core functionality should not depend on cloud infrastructure.

## Runtime Consistency

The internal preview should closely match what OBS and other clients consume.

## Extensibility

Future capabilities should be additive rather than requiring architectural redesign.

---

# Future Expansion Areas

Potential future additions include:

* Overlay marketplace
* Plugin architecture
* Automation workflows
* Scripting support
* External APIs
* Synchronization services
* Remote administration
* Multi-user collaboration
* Advanced runtime data sources

The architecture should leave room for these capabilities without changing the core system model.

---

# Distribution Model

Initial distribution target:

```text
GitHub Release
    ↓
ZIP Package
    ↓
User Extracts
    ↓
Launch Application
```

No installer is required for the initial version.

No external database installation should be required.

No additional runtime installation should be required.

---

# Summary

The system is fundamentally a **local overlay hosting platform**.

The Electron desktop application provides management, editing, previewing, and control capabilities.

The central responsibility of the platform is to host browser-based overlays through local HTTP endpoints that can be consumed by OBS and other streaming software while remaining easy to manage through a dedicated desktop interface.
