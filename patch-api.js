const fs = require('fs');

const path = 'web/src/lib/api.ts';
let content = fs.readFileSync(path, 'utf8');

// Insert fetchApi definition
const fetchApiDef = `
async function fetchApi(input: string, init?: RequestInit) {
  const token = localStorage.getItem('recordbook_token');
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', \`Bearer \${token}\`);
  const res = await fetch(input, { ...init, headers });
  if (!res.ok) {
    let err = 'API error';
    try { const data = await res.json(); err = data.error || err; } catch(e){}
    throw new Error(err);
  }
  return res;
}
`;

content = content.replace("const API = 'http://localhost:3001/api';", "const API = 'http://localhost:3001/api';\n" + fetchApiDef);

// Replace auth functions
const oldAuth = `export async function sendOtp(phone: string): Promise<SendOtpResponse> {
  void phone;
  return { message: 'OTP sent', devOtp: '123456' };
}

export async function verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
  void otp;
  return {
    token: 'mock-token',
    user: { id: 1, phone, name: 'Test User', createdAt: new Date().toISOString() },
  };
}

export async function getMe(): Promise<User> {
  return { id: 1, phone: '9999999999', name: 'Test User', createdAt: new Date().toISOString() };
}`;

const newAuth = `export async function sendOtp(phone: string): Promise<SendOtpResponse> {
  const res = await fetchApi(\`\${API}/auth/send-otp\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
  return res.json();
}

export async function verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
  const res = await fetchApi(\`\${API}/auth/verify-otp\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp }) });
  return res.json();
}

export async function getMe(): Promise<User> {
  const res = await fetchApi(\`\${API}/auth/me\`);
  return res.json();
}`;

content = content.replace(oldAuth, newAuth);

// Replace all fetch( with fetchApi(
// Be careful to not replace the fetch( inside fetchApi
// Also we need to only replace fetch( inside the rest of the file
const parts = content.split(fetchApiDef);
if (parts.length === 2) {
  parts[1] = parts[1].replace(/\sfetch\(/g, ' fetchApi(');
  content = parts[0] + fetchApiDef + parts[1];
}

// Write back
fs.writeFileSync(path, content, 'utf8');
console.log('Updated api.ts');
