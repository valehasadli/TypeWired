# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |
| < 1.0   | ❌        |

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, use one of these private channels:

- **GitHub private vulnerability reporting** (preferred): go to the
  repository's *Security* tab → *Report a vulnerability*.
- **Email**: valehasadli@gmail.com with a description of the issue, steps to
  reproduce, and the affected version.

You can expect an acknowledgement within a few days. Once the issue is
confirmed, a fix will be prioritized and released, and you will be credited
in the release notes unless you prefer otherwise.

## Scope

TypeWired is a dependency injection container with zero runtime dependencies.
Reports of most interest include: prototype pollution vectors through
registration/resolution, denial-of-service through crafted dependency graphs,
and any way a registration could execute code at unexpected times (e.g. at
registration rather than resolution).
