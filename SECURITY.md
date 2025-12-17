# Security Policy

## Supported versions

fami follows semantic versioning. Security fixes are released for the latest published version on the current major line. If you are on an older major line, please upgrade before requesting a backport.

## Reporting a vulnerability

Please report suspected vulnerabilities privately.

Preferred: use GitHub’s “Report a vulnerability” flow for the repository (this creates a private security advisory thread):
https://github.com/pxseu/fami/security/advisories/new

If you cannot use GitHub advisories, contact the maintainer via GitHub and request a private security contact method:
https://github.com/pxseu

Please do not open a public GitHub issue or discussion with exploit details.

When reporting, include the affected version(s), a minimal reproduction or proof of concept, expected vs actual behavior, and an impact assessment (for example cookie injection, incorrect attribute handling, parsing inconsistencies, or denial of service).

## What to expect

We aim to acknowledge reports within 72 hours and provide an initial triage within 7 days. For confirmed issues, we will coordinate a fix and disclosure with you. Timelines can vary based on severity and complexity.

If you do not receive an acknowledgment within 72 hours, please follow up via the same channel you used to report the issue.

## Coordinated disclosure

Please keep reports private until a fix is released and an advisory is published. We will credit reporters in the advisory unless you prefer to remain anonymous.

## Scope

This policy covers the fami npm package and its source repository, including cookie parsing and serialization and the higher-level schema API.

Issues in downstream applications (for example, insecure cookie flags, unsafe session design, or incorrect usage) are typically out of scope, but reports that demonstrate a concrete weakness or surprising behavior in fami itself are in scope.

## Security releases

Security fixes are shipped as patch releases when possible and will be documented in release notes and/or a GitHub security advisory. Upgrading to the latest version is the recommended mitigation.

## Safe harbor

If you act in good faith, avoid privacy violations and service disruption, and give us a reasonable opportunity to remediate before public disclosure, we consider your research authorized under this policy. A reasonable opportunity typically means waiting at least 90 days after initial report for remediation.
