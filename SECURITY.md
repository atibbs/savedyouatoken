# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately using a
[GitHub Security Advisory](https://github.com/atibbs/savedyouatoken/security/advisories/new). Include
the affected package and version, impact, reproduction steps, and any suggested mitigation. Do not
open a public issue or include real prompts, credentials, production reports, or customer data.

Private vulnerability reporting is a publication gate and must be enabled before this repository is
made public. While the repository remains private, authorized collaborators should contact the
repository owner through their existing private project channel rather than use a public issue.

The project is currently maintainer-supported on a best-effort basis and does not promise a response
or remediation SLA. The maintainer will acknowledge a usable report when practical, investigate it,
and coordinate disclosure after a fix or mitigation is available. Please do not publicly disclose an
unresolved vulnerability without first allowing a reasonable opportunity to address it.

## Supported versions

Until a stable release policy is announced, security fixes are made only to the latest version of
each published package and to the default branch:

| Surface | Supported |
|---|---|
| `savedyouatoken` CLI latest npm version | Yes |
| `@savedyouatoken/sdk` latest npm version | Yes |
| `main` branch and current savedyouatoken.com deployment | Yes |
| Older package versions, forks, and modified deployments | No |

## Scope

Security reports are appropriate for vulnerabilities in the analysis engine, CLI, SDK, web
analyser, release pipeline, or official packages. General support requests, incorrect findings, and
feature proposals belong in the public issue tracker unless they reveal sensitive information.
