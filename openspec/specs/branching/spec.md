# Branching Specification

## Purpose

Define where development work lands in this repository. As of 2026-10-12, `develop` is the development branch and every change is made there from now on. `master` holds what has been promoted from `develop`.

## Requirements

### Requirement: Develop is the development branch

The repository MUST have a long-lived branch named `develop`, and it SHALL be the branch where all development work is integrated.

#### Scenario: Starting new work

- GIVEN a contributor or an agent is about to make a change
- WHEN they choose the branch to work from
- THEN they MUST start from the current tip of `develop`

#### Scenario: Default working branch

- GIVEN a session starts with no branch specified
- WHEN work begins
- THEN the working branch MUST be `develop` or a branch created from it

### Requirement: All changes land on develop

Every change to the repository, including code, tests, migrations, configuration, and documentation, MUST be committed to `develop` or to a short-lived branch that is merged into `develop`.

#### Scenario: Committing a change directly

- GIVEN a small change is ready and `develop` is checked out
- WHEN the change is committed
- THEN the commit MUST be created on `develop`

#### Scenario: Using a short-lived branch

- GIVEN a change is developed on a short-lived branch such as `feat/<name>` or `fix/<name>`
- WHEN the change is complete
- THEN the branch MUST have been created from `develop`
- AND it MUST be merged into `develop`, not into `master`

### Requirement: Master is not a working branch

Commits MUST NOT be created directly on `master`. `master` SHALL change only by merging `develop` into it.

#### Scenario: Attempting to commit on master

- GIVEN `master` is checked out
- WHEN a change is ready to be committed
- THEN the contributor MUST switch to `develop`, or to a branch created from it, before committing

#### Scenario: Promoting work to master

- GIVEN `develop` contains work that is ready to be promoted
- WHEN `master` is updated
- THEN the update MUST be a merge of `develop` into `master`
- AND `npm run check` SHOULD pass on `develop` before the merge
