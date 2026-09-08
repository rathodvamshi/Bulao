const endpoints = [
  { method: 'GET', path: '/api/v1/auth/me', desc: 'Get current user' },
  { method: 'GET', path: '/api/v1/auth/session', desc: 'Get session' },
  {
    method: 'POST',
    path: '/api/v1/auth/send-otp',
    desc: 'Send OTP',
    body: { phone: '+919999999900' }
  },
  {
    method: 'POST',
    path: '/api/v1/auth/verify-otp',
    desc: 'Verify OTP',
    body: {
      phone: '+919999999900',
      requestId: 'test-uuid',
      otp: '1234'
    }
  },
  {
    method: 'POST',
    path: '/api/v1/auth/resend-otp',
    desc: 'Resend OTP',
    body: {
      phone: '+919999999900',
      requestId: 'test-uuid'
    }
  },
  {
    method: 'POST',
    path: '/api/v1/auth/logout',
    desc: 'Logout'
  },
];

for (const ep of endpoints) {
  console.log(`Testing: ${ep.method} ${ep.path} - ${ep.desc}`);
  if (ep.body) {
    console.log('Body:', JSON.stringify(ep.body));
  }
}
