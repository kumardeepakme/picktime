# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 3.x     | Yes       |
| < 3.0   | No        |

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it through
[GitHub's private advisory form](https://github.com/kumardeepakme/picktime/security/advisories/new),
or by email to inbox@kumardeepak.me.

Expect an acknowledgement within a few days. Since this is a client-side UI
component with no network access and no credential handling, the realistic
surface is limited to DOM injection through attribute values, so please include
a reproduction showing the untrusted input path.
