# Production release process

This process implements the branch model in `DEV_GUIDELINES.md`.

The current Qwen 2.5 7B runtime configuration, benchmark, and release-gate results
are recorded in [`QWEN_7B_RELEASE_REPORT.md`](./QWEN_7B_RELEASE_REPORT.md).

## Branches and environments

| Branch | Purpose | Deployment |
| --- | --- | --- |
| `develop` | Integration branch. Every task PR is merged here first. | No production deployment. |
| `staging` | Release-candidate validation branch. Only receives PRs from `develop`. | Amplify staging environment. |
| `main` | Stable production branch. Only receives approved PRs from `staging`. | Amplify production environment and the production backend release. |

## Required release sequence

1. Create `feature/<phase>-<short-description>` or `bugfix/<short-description>` from `develop`.
2. Run lint, typecheck, tests, coverage and build locally; commit with Conventional Commits.
3. Open one PR for one task into `develop` using the repository template.
4. After CI and review, open a PR from `develop` to `staging`; validate the Amplify staging URL and staging API.
5. Open a PR from `staging` to `main` only after staging acceptance.
6. After the production PR is merged, deploy the backend from the exact `main` commit and record the commit SHA, stack status and test result in the release PR.

Do not push directly to protected branches. Do not deploy production from `develop` or `staging`.

## Rollback

1. Identify the last known-good `main` commit or release PR.
2. Revert the production PR through GitHub; do not force-push.
3. Let Amplify rebuild `main`, then deploy the backend from that reverted `main` commit.
4. Verify the production stack is `UPDATE_COMPLETE` and run the affected smoke test.
