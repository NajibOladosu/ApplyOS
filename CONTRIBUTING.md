# Contributing to ApplyOS

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to ApplyOS. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [I Have a Question](#i-have-a-question)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
- [Styleguides](#styleguides)
  - [Git Commit Messages](#git-commit-messages)
  - [JavaScript/TypeScript Styleguide](#javascripttypescript-styleguide)
- [Testing](#testing)
- [Setting Up the Project](#setting-up-the-project)

## Code of Conduct

This project and everyone participating in it is governed by the [ApplyOS Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## I Have a Question

If you want to ask a question, we assume you have read the available [Documentation](README.md).

Before you ask a question, it is best to search for existing [Issues](https://github.com/NajibOladosu/ApplyOS/issues) that might help you. In case you've found a suitable issue and still need clarification, you can write your question in this issue. It is also advisable to search the internet for answers first.

If you then still feel the need to ask a question and need clarification, we recommend the following:

- Open an [Issue](https://github.com/NajibOladosu/ApplyOS/issues/new).
- Provide as much context as you can about what you're running into.
- Provide project and platform versions (nodejs, npm, etc), depending on what seems relevant.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for ApplyOS. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

- **Use a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps which reproduce the problem** in as many details as possible.
- **Provide specific examples** to demonstrate the steps. Include links to files or GitHub projects, or copy/pasteable snippets, which you use in those examples.
- **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
- **Explain which behavior you expected to see instead and why.**
- **Include screenshots and animated GIFs** which show you following the described steps and demonstrate the problem. 

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for ApplyOS, including completely new features and minor improvements to existing functionality.

- **Use a clear and descriptive title** for the issue to identify the suggestion.
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
- **Provide specific examples to demonstrate the steps**.
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why.

### Your First Code Contribution

Unsure where to begin contributing to ApplyOS? You can start by looking through these `good first issue` and `help wanted` issues:

- **Good first issues** - issues which should only require a few lines of code, and a test or two.
- **Help wanted issues** - issues which should be a bit more involved than `good first issue`.

## Styleguides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### JavaScript/TypeScript Styleguide

- We use [Prettier](https://prettier.io/) for code formatting.
- run `npm run lint` to check for linting errors.
- **Testing**: We use Vitest for testing. See [TESTING.md](docs/TESTING.md) for more details.

## Testing

Quality is a core value of ApplyOS. We encourage all contributors to write tests for their changes.

- **Check coverage**: `npm run test:coverage`
- **Run all tests**: `npm run test`
- **Mocking**: We provide global mocks for Supabase and AI services to ensure tests are fast and don't require external credentials.

Please refer to the [Testing Guide](docs/TESTING.md) for detailed instructions on writing and running tests.

## Setting Up the Project

1.  **Fork and Clone**
    Fork the repo on GitHub and clone it to your local machine:
    ```bash
    git clone https://github.com/YOUR-USERNAME/ApplyOS.git
    cd ApplyOS
    ```

2.  **Install Dependencies**
    We use `npm` (or `pnpm` depending on your preference, but lockfile is pnpm).
    ```bash
    npm install
    # or
    pnpm install
    ```

3.  **Environment Setup**
    Copy the example environment file:
    ```bash
    cp .env.example .env.local
    ```
    (Or create `.env.local` based on `README.md` instructions).

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Visit `http://localhost:3000`.

5.  **Create a Branch**
    ```bash
    git checkout -b feature/amazing-feature
    ```

6.  **Make Changes & Commit**
    ```bash
    git commit -m "Add some amazing feature"
    ```

7.  **Push & PR**
    ```bash
    git push origin feature/amazing-feature
    ```
    Open a Pull Request on GitHub.
