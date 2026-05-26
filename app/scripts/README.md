# Scripts

This folder contains utility and diagnostic scripts used during development and maintenance of the Uni-Event app.

## Scripts Overview

| Script            | Purpose                                    |
| ----------------- | ------------------------------------------ |
| patch-expo-sea.js | Replaces name of "node:sea" module to      |
|                   | "\_node_sea_disabled" so that Expo can     |
|                   | recognize it easily.                       |
|                   |                                            |
| generate-sw.js    | Generates a Service Worker required due to |
|                   | Firebase Cloud Messaging.                  |

## Usage

These scripts are development tools only. Do not run them in production.
Run individual scripts using:

```
node scripts/<script-name>.js
```
