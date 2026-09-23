# meetrec docs

Start here. Each file is one concern; keep them short.

New to the app? Read [Getting started](getting-started.md), then the root [README](../README.md).

| Doc                                              | What it covers                          |
| ------------------------------------------------ | --------------------------------------- |
| [getting-started.md](getting-started.md)         | ffmpeg, `npm run dev`, first recording  |
| [product.md](product.md)                         | Problem, users, loop, non-goals         |
| [architecture.md](architecture.md)               | Processes, domains, data flow           |
| [stack.md](stack.md)                             | Chosen tech and why                     |
| [folder-structure.md](folder-structure.md)       | Repo layout                             |
| [audio-capture.md](audio-capture.md)             | Per-OS backends                         |
| [providers.md](providers.md)                     | STT and LLM provider registry           |
| [security.md](security.md)                       | Secrets, OAuth, consent                 |
| [coding-guidelines.md](coding-guidelines.md)     | Vue/TS style, KISS/DRY                  |
| [quality-gates.md](quality-gates.md)             | Lint, typecheck, test, CI               |
| [packaging.md](packaging.md)                     | Installers, ffmpeg, signing later       |
| [recorder-ui.md](recorder-ui.md)                 | Library, Record, and recording detail   |
| [vue-ecosystem-notes.md](vue-ecosystem-notes.md) | Vue changes over the last six months    |
| [open-decisions.md](open-decisions.md)           | Locked choices and remaining soft items |

Read [open-decisions.md](open-decisions.md) before treating the stack as locked.

Run the app with `npm install && npm run dev`. Contributor setup is the root [CONTRIBUTING.md](../CONTRIBUTING.md). The recorder layout is [recorder-ui.md](recorder-ui.md).
