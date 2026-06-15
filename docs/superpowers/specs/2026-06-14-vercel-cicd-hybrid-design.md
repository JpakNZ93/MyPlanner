# Vercel Hybrid CI/CD Design

## Summary

Add a hybrid CI/CD setup for the existing Vercel-deployed app. GitHub Actions provides the quality gate for pull requests and `main` branch updates, then triggers Vercel production deployments through a Vercel Deploy Hook after `main` passes CI.

## Goals

- Feature branches and pull requests can receive Vercel Preview deployments through Vercel Git integration.
- Merges to `main` automatically deploy to Vercel Production through a deploy-hook job after CI passes.
- Pull requests targeting `main` run lint, tests, and build before merge.
- Pushes to `main` run the same checks so production commits have a recorded CI result.
- The repo documents the expected Vercel and GitHub configuration for future agents.

## Non-Goals

- Do not use `vercel deploy` in GitHub Actions.
- Do not add Vercel CLI tokens, org IDs, or project IDs to GitHub Actions.
- Do not commit the Vercel Deploy Hook URL.
- Do not change application runtime behavior, Vercel functions, or environment variable names.
- Do not replace Vercel's native preview comment/status behavior.

## Architecture

Use GitHub Actions as the merge gate and production deploy trigger:

1. A feature branch or pull request is pushed to GitHub.
2. Vercel can detect the Git event and create a Preview deployment if preview Git integration is enabled.
3. GitHub Actions runs the repository quality checks.
4. The pull request is merged only after the GitHub Actions CI check passes.
5. The merge commit lands on `main`.
6. GitHub Actions runs the same checks on the `main` push.
7. After those checks pass, the `Deploy Production` job calls the Vercel Deploy Hook stored in `VERCEL_DEPLOY_HOOK_URL`.
8. Vercel builds and aliases the `main` commit as a Production deployment.

This keeps deploy orchestration inside Vercel while letting GitHub trigger the existing deploy hook after quality checks pass.

## Repository Changes

Add `.github/workflows/ci.yml` with one workflow, named `CI`.

Workflow triggers:

- `pull_request` targeting `main`
- `push` to `main`

Workflow behavior for the `quality` job:

1. Check out the repository.
2. Set up Node.js.
3. Enable npm dependency caching.
4. Install dependencies with `npm ci`.
5. Run `npm run lint`.
6. Run `npm run test`.
7. Run `npm run build`.

Workflow behavior for the `deploy-production` job:

1. Run only for `push` events to `refs/heads/main`.
2. Depend on the `quality` job.
3. Read the deploy hook from the `VERCEL_DEPLOY_HOOK_URL` GitHub secret.
4. Fail with a clear message if the secret is missing.
5. Call the hook with `curl -fsS -X POST`.

The current `package.json` already exposes the required scripts:

- `lint`
- `test`
- `build`

No Vercel CLI deploy step should be added to this workflow.

## GitHub Branch Protection

Configure the GitHub `main` branch protection rule outside the repository so merges require the `CI` workflow to pass before merge.

Recommended settings:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Select the GitHub Actions `CI` check as required.
- Store the Vercel Deploy Hook URL as the `VERCEL_DEPLOY_HOOK_URL` repository secret.
- Keep Vercel Preview checks visible on pull requests if preview Git integration is enabled.

If GitHub requires a specific check name, use the workflow/job name that appears after the first Actions run.

## Vercel Configuration

Keep the current Vercel project and deploy hook enabled.

Expected Vercel behavior:

- Pull requests and non-production branches can create Preview deployments when Vercel Git integration is enabled for previews.
- The `main` branch is the Production branch.
- Merges to `main` deploy Production when GitHub Actions calls the `main` deploy hook after CI passes.
- Existing Vercel environment variables remain managed in Vercel project settings.

Production deploys from `main` should be controlled by the GitHub Actions deploy-hook path. Do not leave a separate Vercel native production auto-deploy path enabled for `main`, because it can deploy a merge commit before the GitHub Actions `quality` job has passed.

The existing `vercel.json` rewrites for `/success` and `/cancel` remain unchanged.

## Error Handling

The CI workflow should fail fast through normal command exit codes:

- `npm ci` fails when `package-lock.json` and `package.json` are out of sync.
- `npm run lint` fails on lint errors.
- `npm run test` fails on unit test failures.
- `npm run build` fails on TypeScript or Vite build errors.

Deploy-hook trigger failures are handled by the GitHub Actions `Deploy Production` job. Build and runtime deployment failures are handled by Vercel and should be investigated in Vercel deployment logs.

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
   - GitHub Actions runs `CI` and then `Deploy Production`.
   - Vercel creates a Production deployment for the merge commit.
   - GitHub Actions records a passing `CI` run for the `main` push.

## Future Agent Notes

- Do not add `vercel deploy` to GitHub Actions for this design.
- Do not introduce `VERCEL_TOKEN`, `VERCEL_ORG_ID`, or `VERCEL_PROJECT_ID` GitHub secrets unless the deployment strategy is intentionally changed later.
- Use only `VERCEL_DEPLOY_HOOK_URL` for the production deploy trigger.
- Keep the `quality` job focused on checks that can block merge safely.
- If additional checks are added later, prefer extending the same `CI` workflow unless a new check needs separate branch protection semantics.
