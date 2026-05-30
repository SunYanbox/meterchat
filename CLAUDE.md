Development must strictly follow the TDD (Red-Green-Refactor) principles, where commits are prohibited during the Red phase, and commits are allowed during the Green and Refactor phases upon success.

Sub-agents are prohibited from creating a large number of development branches and merging them into the main branch. They must develop on a specific created branch, commit and push to the remote repository only after tests pass, and submit a PR using `gh`.

A development round must be a complete set of development work that can be pushed via a PR. Any items with dependencies must be arranged into the next round.

The main branch is named `main` (the default base branch for sub-development branches).  
The development branch is named `develop` (the target branch for PRs).

All commit messages and pull requests must be written in **English**.