const base = 'https://bulao-api-staging.codecheck369.workers.dev';
const cases = [
  ['health','GET','/api/v1/health',undefined,200],
  ['categories','GET','/api/v1/categories',undefined,200],
  ['send invalid phone','POST','/api/auth/send-otp',{phone:'123'},400],
  ['verify invalid OTP','POST','/api/auth/verify-otp',{phone:'+919999999991',requestId:crypto.randomUUID(),otp:'123'},400],
  ['resend missing reference','POST','/api/auth/resend-otp',{},400],
  ['session unsigned','GET','/api/auth/session',undefined,401],
  ['logout unsigned','POST','/api/auth/logout',{},401],
  ['profile unsigned','GET','/api/v1/users/me',undefined,401],
  ['auth me unsigned','GET','/api/v1/auth/me',undefined,401],
  ['v1 send invalid phone','POST','/api/v1/auth/send-otp',{phone:'123'},400],
  ['v1 verify invalid OTP','POST','/api/v1/auth/verify-otp',{phone:'+919999999991',requestId:crypto.randomUUID(),otp:'123'},400],
  ['v1 resend missing reference','POST','/api/v1/auth/resend-otp',{},400],
  ['v1 session unsigned','GET','/api/v1/auth/session',undefined,401],
  ['v1 logout unsigned','POST','/api/v1/auth/logout',{},401],
];
for (const [name,method,path,body,expected] of cases) {
  const response = await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:'http://localhost:8082'},body:body ? JSON.stringify(body):undefined,redirect:'error'});
  const data = await response.json();
  console.log(JSON.stringify({name,status:response.status,expected,pass:response.status===expected,code:data.error?.code,requestId:response.headers.get('X-Request-Id'),cors:response.headers.get('Access-Control-Allow-Origin'),cache:response.headers.get('Cache-Control')}));
}
const preflight = await fetch(base+'/api/auth/send-otp',{method:'OPTIONS',headers:{Origin:'http://localhost:8082','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
console.log(JSON.stringify({name:'CORS preflight',status:preflight.status,pass:preflight.status===204&&preflight.headers.get('Access-Control-Allow-Origin')==='http://localhost:8082'}));
