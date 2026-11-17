# Contributing

Commits use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `refactor:`. The version in the root `package.json` and `server/src/version.ts` stays in lockstep. Record user-visible changes in `CHANGELOG.md`.

## Checks

Pull requests should be green on:

- **iOS** — SwiftLint, SwiftFormat `--lint`, XcodeGen, `xcodebuild test` on a simulator.
- **Web** — secret scan, generated SQL types, ESLint, `tsc`, server tests, coverage lcov, Next build, Playwright, `npm audit --omit=dev --audit-level=high`.

## Branch protection

On GitHub, protect `main` so those two workflows are required and force-push is off. This repository's automation cannot turn that rule on; a repo admin has to.

## Secrets

Do not commit `.env`, `.p8`, or provisioning profiles. `.env.example` lists every key and leaves the values empty. The sample password and sample TOTP secret are published on purpose and are documented as demo-only.

## Sample data

If a record is not a fact from the public One Hope site, label it Sample in the UI and set `sample: true` in the payload.
