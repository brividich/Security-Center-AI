import { LoginForm } from "../components/auth/LoginForm";

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-950">Security Center AI</h1>
          <p className="mt-2 text-sm text-slate-500">Login</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
