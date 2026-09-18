import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, LockKeyhole, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import { AppLogo } from '../components/common/AppLogo';
import { getCurrentAdmin, signInAdmin, signOutAdmin, AdminProfile } from '../services/adminAuth';

export const AdminPortal: React.FC = () => {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (!mounted) return;

      setCheckingSession(true);
      setError(null);

      if (!user || user.isAnonymous) {
        setAdmin(null);
        setCheckingSession(false);
        return;
      }

      try {
        const currentAdmin = await getCurrentAdmin();
        if (mounted) {
          setAdmin(currentAdmin);
          if (!currentAdmin) {
            setError('This account does not have administrator access.');
          }
        }
      } catch {
        if (mounted) {
          setAdmin(null);
          setError('Unable to verify administrator access.');
        }
      } finally {
        if (mounted) setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const authenticatedAdmin = await signInAdmin(email.trim(), password);
      setAdmin(authenticatedAdmin);
      setPassword('');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/not-admin') {
        setError('This account is not authorized for administrator access.');
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid administrator email or password.');
      } else if (code === 'auth/user-not-found') {
        setError('No administrator account was found with this email.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err?.message || 'Administrator sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOutAdmin();
      setAdmin(null);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Administrator sign-out failed.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#F9F9FF] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto border-3 border-[#0F1E36] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-wider text-[#081B38]">
            Verifying administrator access...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9FF] text-[#081B38] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-[#E8EDFF] shadow-xl overflow-hidden">
          <div className="p-6 border-b border-[#E8EDFF] bg-[#F9F9FF]">
            <div className="flex items-center gap-3">
              <AppLogo size={38} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6B46C1]">
                  Administrator Portal
                </p>
                <h1 className="text-lg font-bold tracking-tight">Construction Project Tracker</h1>
              </div>
            </div>
          </div>

          {admin ? (
            <div className="p-6 space-y-5">
              <div className="p-4 rounded-xl bg-[#F1F3FF] border border-[#E0E8FF]">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck size={16} />
                  Administrator authenticated
                </div>
                <div className="mt-3 space-y-2">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-[#75777E]">Email</span>
                    <span className="text-sm font-semibold">{admin.email}</span>
                  </div>
                  {admin.displayName && (
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-[#75777E]">Name</span>
                      <span className="text-sm font-semibold">{admin.displayName}</span>
                    </div>
                  )}
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-[#75777E]">Role</span>
                    <span className="text-sm font-semibold">Administrator</span>
                  </div>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-[#75777E]">
                The administrator authentication boundary is active. Administrative modules can be added here without exposing administrator registration to regular users.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { window.location.href = '/'; }}
                  className="h-11 rounded-xl bg-[#F1F3FF] hover:bg-[#E8EDFF] text-[#081B38] text-xs font-bold flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={15} />
                  Return to Tracker
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="h-11 rounded-xl bg-[#000412] hover:bg-[#0F1E36] text-white text-xs font-bold flex items-center justify-center gap-2"
                >
                  <LogOut size={15} />
                  {loading ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-[#FFDAD6] text-[#BA1A1A] text-xs font-semibold flex items-start gap-2 border border-[#FF5449]/30">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mb-5 p-3.5 rounded-xl bg-[#F1F3FF] border border-[#E0E8FF]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F1E36]">
                  <LockKeyhole size={16} />
                  <span>Restricted administrator access</span>
                </div>
                <p className="text-[11px] text-[#75777E] mt-1 leading-relaxed">
                  Administrator accounts are provisioned separately. There is no public administrator registration.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#44474D] mb-1">
                    Administrator Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full h-11 px-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38]"
                    placeholder="admin@example.com"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#44474D] mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full h-11 px-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38]"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-[#000412] hover:bg-[#0F1E36] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 mt-2"
                >
                  <LogIn size={16} />
                  {loading ? 'Verifying...' : 'Sign In as Administrator'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => { window.location.href = '/'; }}
                className="w-full mt-3 h-10 text-xs font-semibold text-[#75777E] hover:text-[#081B38] flex items-center justify-center gap-2"
              >
                <ArrowLeft size={14} />
                Return to regular user access
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
