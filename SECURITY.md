# Security Configuration Guide

This document outlines the security configurations and best practices for Security Center AI.

## Required Environment Variables

### Critical Security Settings

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DJANGO_SECRET_KEY` | ✅ Yes | Cryptographic signing key | **None** - must be set |
| `DJANGO_ALLOWED_HOSTS` | ✅ Yes (prod) | Allowed hostnames | localhost,127.0.0.1 (dev only) |
| `DJANGO_DEBUG` | No | Debug mode | False |
| `SECURITY_CENTER_DEV_MODE` | No | Suppress DEBUG warning | False |

### SSL/TLS Settings (Production)

| Variable | Recommended | Description |
|----------|-------------|-------------|
| `DJANGO_SECURE_SSL_REDIRECT` | True | Force HTTPS redirects |
| `DJANGO_SESSION_COOKIE_SECURE` | True | Secure session cookies |
| `DJANGO_CSRF_COOKIE_SECURE` | True | Secure CSRF cookies |

## Security Headers

The following security headers are automatically configured:

### HTTP Strict Transport Security (HSTS)
- **Duration:** 1 year (31536000 seconds)
- **Include Subdomains:** Yes
- **Preload:** Yes

### Content Security
- **X-Frame-Options:** DENY
- **X-Content-Type-Options:** nosniff
- **X-XSS-Protection:** 1; mode=block
- **Referrer-Policy:** strict-origin-when-cross-origin

### Cookie Security
- **Session Cookie:** HttpOnly, Secure (in production)
- **CSRF Cookie:** HttpOnly, Secure (in production)

## Development vs Production

### Development Settings
```bash
DJANGO_DEBUG=True
SECURITY_CENTER_DEV_MODE=True
DJANGO_SECURE_SSL_REDIRECT=False
DJANGO_SESSION_COOKIE_SECURE=False
DJANGO_CSRF_COOKIE_SECURE=False
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
```

### Production Settings
```bash
DJANGO_DEBUG=False
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
DJANGO_ALLOWED_HOSTS=your-domain.com,www.your-domain.com
```

## Generating a Secure Secret Key

Use Django's built-in utility to generate a cryptographically secure secret key:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

**Important:**
- Never commit the secret key to version control
- Use different keys for development, staging, and production
- Rotate keys periodically (recommended: every 6-12 months)
- Store keys securely using environment variables or secret management systems

## Input Validation

All user input is validated and sanitized:

- **Query Parameters:** Validated against allowed choices
- **Numeric Input:** Verified as integers before database queries
- **Date Input:** Parsed with strict format validation (YYYY-MM-DD)
- **File Uploads:** Size limit (10MB) and extension whitelist

## Cache Control

Sensitive endpoints use strict cache control:
- `max-age=0`
- `no-cache`
- `no-store`
- `must-revalidate`

This prevents caching of sensitive data in browsers or proxies.

## CORS Configuration

CORS is restricted to specific origins:
- Development: `http://localhost:5173`, `http://127.0.0.1:5173`
- Production: Configure `CORS_ALLOWED_ORIGINS` explicitly

## CSRF Protection

- CSRF protection is enabled on all views
- No `@csrf_exempt` decorators are used
- CSRF tokens are required for all state-changing operations

## Rate Limiting

**Note:** Rate limiting is not currently implemented. Consider adding:
- `django-ratelimit` for API endpoints
- `django-axes` for authentication attempts
- `django-defender` for brute force protection

## Security Checklist

Before deploying to production:

- [ ] Set strong `DJANGO_SECRET_KEY`
- [ ] Set `DJANGO_DEBUG=False`
- [ ] Configure `DJANGO_ALLOWED_HOSTS`
- [ ] Enable SSL/TLS with valid certificate
- [ ] Set `DJANGO_SECURE_SSL_REDIRECT=True`
- [ ] Set `DJANGO_SESSION_COOKIE_SECURE=True`
- [ ] Set `DJANGO_CSRF_COOKIE_SECURE=True`
- [ ] Configure `CORS_ALLOWED_ORIGINS`
- [ ] Configure `CSRF_TRUSTED_ORIGINS`
- [ ] Enable database encryption at rest
- [ ] Configure backup encryption
- [ ] Set up log monitoring and alerting
- [ ] Implement rate limiting
- [ ] Enable security audit logging
- [ ] Configure firewall rules
- [ ] Regular security updates and patches

## Monitoring and Logging

Security-related events are logged:
- Failed authentication attempts
- Permission denials
- Configuration changes (audit log)
- Pipeline errors and warnings

## Additional Security Recommendations

1. **Use HTTPS Everywhere**
   - Obtain SSL/TLS certificate from trusted CA
   - Enable HSTS preload
   - Use TLS 1.2 or higher

2. **Database Security**
   - Use strong database passwords
   - Enable database encryption
   - Regular database backups
   - Limit database user permissions

3. **File System Security**
   - Restrict file permissions
   - Secure file uploads
   - Regular file system audits

4. **Network Security**
   - Configure firewall rules
   - Use VPN for remote access
   - Network segmentation
   - DDoS protection

5. **Application Security**
   - Regular dependency updates
   - Security scanning (SAST/DAST)
   - Penetration testing
   - Code review process

## Security Resources

- [Django Security Documentation](https://docs.djangoproject.com/en/stable/topics/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:
- Do not create public issues
- Email security@your-domain.com
- Include detailed description and reproduction steps
- Allow time for remediation before disclosure

## Version History

- **v0.5.1** - Initial security hardening
  - Added security headers
  - Implemented input validation
  - Added cache control
  - Enhanced SECRET_KEY validation
