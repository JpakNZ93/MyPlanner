# Vercel Hybrid CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions quality gate and trigger Vercel production deployments from `main` through a Vercel Deploy Hook after CI passes.

**Architecture:** The repository contains one GitHub Actions workflow that runs lint, tests, and build on pull requests to `main` and pushes to `main`. On `main` pushes, a second job waits for CI to pass and calls the Vercel Deploy Hook stored in the `VERCEL_DEPLOY_HOOK_URL` GitHub secret. The workflow must not call `vercel deploy` or commit the deploy hook URL.

**Tech Stack:** GitHub Actions, Node.js 22, npm, Vite, React, TypeScript, Vitest, ESLint, Vercel Deploy Hooks.

---

## File Structure

- Create/modify: `.github/workflows/ci.yml`
  - Responsibility: define the GitHub Actions `CI` workflow that installs dependencies, runs the repository quality checks, and triggers the Vercel deploy hook after `main` passes.
- Modify: `README.md`
  - Responsibility: document how CI, the Vercel deploy hook, production deploys, and branch protection are expected to work for future maintainers and agents.
- Existing reference: `package.json`
  - Responsibility: provides the existing `lint`, `test`, and `build` scripts used by the workflow.
- Existing reference: `vercel.json`
  - Responsibility: keeps app route rewrites unchanged; no CI/CD implementation change belongs here.

## Task 1: Add the GitHub Actions CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`
- Reference: `package.json`

- [ ] **Step 1: Confirm the required npm scripts exist**

Run:

```bash
node -e "const pkg=require('./package.json'); for (const script of ['lint','test','build']) { if (!pkg.scripts?.[script]) { throw new Error('Missing script: ' + script); } } console.log('Required scripts found:', ['lint','test','build'].join(', '));"
```

Expected output includes:

```text
Required scripts found: lint, test, build
```

- [ ] **Step 2: Create the workflows directory**

Run:

```bash
mkdir -p .github/workflows
```

Expected: command exits with status 0.

- [ ] **Step 3: Create `.github/workflows/ci.yml`**

Write this exact file:

```yaml
name: CI

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  quality:
    name: CI
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run lint
        run: npm run lint

      - name: Run tests
        run: npm run test

      - name: Run build
        run: npm run build

  deploy-production:
    name: Deploy Production
    runs-on: ubuntu-latest
    needs: quality
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
      - name: Trigger Vercel deploy hook
        env:
          VERCEL_DEPLOY_HOOK_URL: ${{ secrets.VERCEL_DEPLOY_HOOK_URL }}
        run: |
          if [ -z "$VERCEL_DEPLOY_HOOK_URL" ]; then
            echo "VERCEL_DEPLOY_HOOK_URL secret is required."
            exit 1
          fi

          curl -fsS -X POST "$VERCEL_DEPLOY_HOOK_URL"
```

- [ ] **Step 4: Check the workflow diff for whitespace errors**

Run:

```bash
git diff --check -- .github/workflows/ci.yml
```

Expected: command exits with status 0 and prints no whitespace errors.

- [ ] **Step 5: Inspect the workflow file**

Run:

```bash
sed -n '1,120p' .github/workflows/ci.yml
```

Expected output shows:

```text
name: CI
```

Expected output also shows no `vercel deploy`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, or literal deploy hook URL.

- [ ] **Step 6: Commit the workflow**

Run:

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add github actions quality gate"
```

Expected: git creates one commit containing only `.github/workflows/ci.yml`.

## Task 2: Document the Hybrid CI/CD Contract

**Files:**
- Modify: `README.md`
- Reference: `docs/superpowers/specs/2026-06-14-vercel-cicd-hybrid-design.md`

- [ ] **Step 1: Add a CI/CD section to `README.md`**

Insert this section after the local setup section and before `## Google Sheets setup`:

```markdown
## CI/CD

GitHub Actions runs CI checks, then triggers Vercel production deployments through a Vercel Deploy Hook after `main` passes.

- Pull requests targeting `main` run the `CI` workflow.
- Pushes to `main` run the same `CI` workflow and then the `Deploy Production` job.
- The `CI` job installs dependencies with `npm ci`, then runs `npm run lint`, `npm run test`, and `npm run build`.
- The `Deploy Production` job calls the Vercel Deploy Hook from the `VERCEL_DEPLOY_HOOK_URL` GitHub secret.
- Do not commit the deploy hook URL to the repository.

Recommended GitHub branch protection for `main`:

1. Require a pull request before merging.
2. Require status checks to pass before merging.
3. Require the GitHub Actions `CI` check.
4. Store the Vercel Deploy Hook URL as the `VERCEL_DEPLOY_HOOK_URL` repository secret.

The deploy hook should target the Vercel `workspace` project and the `main` branch. Pull request preview deployments depend on the Vercel Git integration remaining enabled for preview branches.
```

- [ ] **Step 2: Verify the README section is in the intended location**

Run:

```bash
sed -n '18,70p' README.md
```

Expected output order:

```text
## Local setup
```

then:

```text
## CI/CD
```

then:

```text
## Google Sheets setup
```

- [ ] **Step 3: Check the README diff for whitespace errors**

Run:

```bash
git diff --check -- README.md
```

Expected: command exits with status 0 and prints no whitespace errors.

- [ ] **Step 4: Commit the documentation update**

Run:

```bash
git add README.md
git commit -m "docs: document hybrid ci cd flow"
```

Expected: git creates one commit containing only `README.md`.

## Task 3: Run Local Quality Verification

**Files:**
- Verify: `.github/workflows/ci.yml`
- Verify: `README.md`
- Verify: existing source and test files covered by package scripts

- [ ] **Step 1: Install dependencies from the lockfile**

Run:

```bash
npm ci
```

Expected: command exits with status 0.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected output includes the script header:

```text
> lint
> eslint .
```

Expected: command exits with status 0.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test
```

Expected output includes:

```text
Test Files
```

Expected: command exits with status 0.

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected output includes:

```text
vite build
```

Expected: command exits with status 0.

- [ ] **Step 5: Confirm there are no unintended files**

Run:

```bash
git status --short
```

Expected: no uncommitted changes from dependency installation, linting, tests, or building.

If build artifacts appear, inspect `.gitignore` before deciding whether they are expected ignored files or accidental tracked changes.

## Task 4: Push and Update the Pull Request

**Files:**
- Existing committed changes only

- [ ] **Step 1: Push the branch**

Run:

```bash
git push -u origin cursor/main-deploy-hook-e61d
```

Expected: push exits with status 0.

- [ ] **Step 2: Update the pull request description**

Use the PR management tool to update the existing PR for branch `cursor/main-deploy-hook-e61d` with this body:

```markdown
## Summary
- Add a GitHub Actions `CI` workflow for pull requests to `main` and pushes to `main`.
- Add a `Deploy Production` job that calls the Vercel Deploy Hook after `main` CI passes.
- Document the deploy-hook contract, required GitHub secret, and recommended branch protection in the README.

## Verification
- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`
```

Expected: the PR reflects the workflow and README implementation, not only the design document.

## Task 5: Confirm Hosted CI/CD Behavior

**Files:**
- No repository file changes

- [ ] **Step 1: Confirm GitHub Actions starts on the pull request**

Open the pull request in GitHub and check the checks area.

Expected:

```text
CI
```

appears as a GitHub Actions check.

- [ ] **Step 2: Confirm Vercel preview deployment appears on the pull request**

Open the pull request checks or Vercel project dashboard.

Expected: Vercel creates a Preview deployment for the branch.

- [ ] **Step 3: Configure branch protection for `main`**

In GitHub repository settings, configure `main` branch protection:

1. Require a pull request before merging.
2. Require status checks to pass before merging.
3. Select the `CI` status check.
4. Save the rule.

Expected: future pull requests to `main` cannot merge until `CI` passes.

- [ ] **Step 4: Confirm production deployment after merge**

After the pull request merges to `main`, check Vercel.

Expected: Vercel creates a Production deployment for the merge commit.

- [ ] **Step 5: Confirm the `main` push CI run**

After the pull request merges to `main`, check GitHub Actions.

Expected: the `CI` workflow runs for the `main` push and exits with status 0.

## Self-Review Notes

- Spec coverage: Task 1 adds the GitHub Actions quality gate; Task 2 documents Vercel/GitHub responsibilities; Task 3 verifies lint, tests, and build; Task 4 pushes and updates the PR; Task 5 covers branch protection, preview deployment, production deployment, and the `main` push CI run.
- Placeholder scan: the plan contains concrete file paths, commands, expected outputs, commit messages, and PR body text.
- Type consistency: the workflow name and job name are both `CI`, matching the branch protection documentation and PR verification language.
