console.error('Bulao uses deployed Cloudflare resources only. Configure EXPO_PUBLIC_API_BASE_URL with your HTTPS Worker URL. Follow docs/auth-setup.md; local Worker/database development is disabled.');
process.exitCode = 1;
