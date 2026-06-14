# Vercel Hybrid CI/CD Design

## Summary

Add a hybrid CI/CD setup for the existing Vercel-deployed app. Vercel remains responsible for preview and production deployments through its Git integration, while GitHub Actions provides the quality gate for pull requests and `main` branch updates.

## Goals

- Feature branches and pull requests receive Vercel Preview deployments.
- Merges to `main` automatically deploy to Vercel Production.
- Pull requests targeting `main` run lint, tests, and build before merge.
- Pushes to `main` run the same checks so production commits have a recorded CI result.
- The repo documents the expected Vercel and GitHub configuration for future agents.

## Non-Goals

- Do not move deployment execution into GitHub Actions.
- Do not add Vercel tokens or project secrets to GitHub Actions.
- Do not change application runtime behavior, Vercel functions, or environment variable names.
- Do not replace Vercel's native preview comment/status behavior.

## Architecture

Use the existing connected Vercel project as the deployment engine:

1. A feature branch or pull request is pushed to GitHub.
2. Vercel detects the Git event and creates a Preview deployment.
3. GitHub Actions runs the repository quality checks.
4. The pull request is merged only after the GitHub Actions CI check passes.
5. The merge commit lands on `main`.
6. Vercel detects the `main` update and creates a Production deployment.
7. GitHub Actions also runs on the `main` push and records the same quality checks against the production commit.

This keeps deploy credentials and deploy orchestration inside Vercel, while GitHub owns the merge gate.

## Repository Changes

Add `.github/workflows/ci.yml` with one workflow, named `CI`.

Workflow triggers:

- `pull_request` targeting `main`
- `push` to `main`

Workflow behavior:

1. Check out the repository.
2. Set up Node.js.
3. Enable npm dependency caching.
4. Install dependencies with `npm ci`.
5. Run `npm run lint`.
6. Run `npm run test`.
7. Run `npm run build`.

The current `package.json` already exposes the required scripts:

- `lint`
- `test`
- `build`

No deploy step should be added to this workflow.

## GitHub Branch Protection

Configure the GitHub `main` branch protection rule outside the repository so merges require the `CI` workflow to pass before merge.

Recommended settings:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Select the GitHub Actions `CI` check as required.
- Keep Vercel Preview checks visible on pull requests, but do not make a separate deploy script in GitHub Actions.

If GitHub requires a specific check name, use the workflow/job name that appears after the first Actions run.

## Vercel Configuration

Keep the current Vercel Git integration enabled.

Expected Vercel behavior:

- Pull requests and non-production branches create Preview deployments.
- The `main` branch is the Production branch.
- Merges to `main` automatically deploy Production.
- Existing Vercel environment variables remain managed in Vercel project settings.

The existing `vercel.json` rewrites for `/success` and `/cancel` remain unchanged.

## Error Handling

The CI workflow should fail fast through normal command exit codes:

- `npm ci` fails when `package-lock.json` and `package.json` are out of sync.
- `npm run lint` fails on lint errors.
- `npm run test` fails on unit test failures.
- `npm run build` fails on TypeScript or Vite build errors.

Deployment failures are handled by Vercel and should be investigated in Vercel deployment logs, not retried from GitHub Actions.

## Testing and Verification

Implementation verification should include:

1. Run `npm run lint` locally.
2. Run `npm run test` locally.
3. Run `npm run build` locally.
4. Validate the workflow YAML syntax by inspection and, if available, through the first GitHub Actions run.
5. Open a pull request and confirm:
   - GitHub Actions starts the `CI` workflow.
   - Vercel creates a Preview deployment.
6. After merge to `main`, confirm:
   - Vercel creates a Production deployment.
   - GitHub Actions records a passing `CI` run for the `main` push.

## Future Agent Notes

- Do not add `vercel deploy` to GitHub Actions for this design.
- Do not introduce `VERCEL_TOKEN`, `VERCEL_ORG_ID`, or `VERCEL_PROJECT_ID` GitHub secrets unless the deployment strategy is intentionally changed later.
- Keep CI focused on quality checks that can block merge safely.
- If additional checks are added later, prefer extending the same `CI` workflow unless a new check needs separate branch protection semantics.
