# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

We take the security of ElasticScope seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via:
- GitHub Security Advisories: https://github.com/fuykun/ElasticScope/security/advisories
- Or email the maintainers directly

Please include the following information:
- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Response Timeline

- We will acknowledge receipt of your vulnerability report within 48 hours
- We will provide a more detailed response within 7 days
- We will work on a fix and keep you informed of the progress
- Once the fix is ready, we will release a security update
- We will publicly disclose the vulnerability after the fix is released

## Security Best Practices

When using ElasticScope:

1. **Never expose Elasticsearch credentials in public repositories**
2. **Use HTTPS for Elasticsearch connections in production**
3. **Keep ElasticScope updated to the latest version**
4. **Use authentication for your Elasticsearch clusters**
5. **Limit network access to Elasticsearch**
6. **Review and restrict Elasticsearch user permissions**
7. **Use environment variables for sensitive configuration**

## Safe Usage

- ElasticScope stores connection information in the browser's local storage
- No credentials are sent to external servers
- All communication is directly between your browser and Elasticsearch
- Review the Docker configuration before deploying to production

Thank you for helping keep ElasticScope and its users safe!
