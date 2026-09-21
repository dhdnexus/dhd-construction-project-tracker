import React, { useState } from 'react';
import { X, LogIn, UserPlus, LogOut, User, Mail, Lock, ShieldCheck, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { UserProfile } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onSignIn: (email: string, pass: string) => Promise<void>;
  onSignUp: (email: string, pass: string, displayName?: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onSignIn,
  onSignUp,
  onLogout,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        await onSignIn(email.trim(), password);
        setSuccessMsg('Signed in successfully.');
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        if (!email.trim() || !password) {
          throw new Error('Please enter both email and password.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await onSignUp(email.trim(), password, displayName.trim());
        setSuccessMsg('Account created and logged in.');
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (code === 'auth/user-not-found') {
        setError('No user account found with this email.');
      } else if (code === 'auth/email-already-in-use') {
        setError('An account already exists with this email.');
      } else if (code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err?.message || 'Authentication failed. Please check your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    setLoading(true);
    try {
      await onLogout();
      setSuccessMsg('Signed out. Continuing in anonymous preview mode.');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Logout failed');
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = !userProfile.isAnonymous && !!userProfile.email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081B38]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#E8EDFF] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#E8EDFF] flex items-center justify-between bg-[#F9F9FF]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#000412] text-white flex items-center justify-center">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#081B38]">
                {isAuthenticated ? 'User Account' : 'Sign In / Account'}
              </h3>
              <p className="text-xs text-[#75777E]">
                {isAuthenticated
                  ? 'Authenticated multi-client session'
                  : 'Sign in to access your cloud projects anywhere'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[#75777E] hover:text-[#081B38] hover:bg-[#E8EDFF] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#FFDAD6] text-[#BA1A1A] text-xs font-semibold flex items-center gap-2 border border-[#FF5449]/30">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-[#DCFCE7] text-[#15803D] text-xs font-semibold flex items-center gap-2 border border-[#86EFAC]">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* If already authenticated */}
          {isAuthenticated ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#F9F9FF] border border-[#E8EDFF] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#75777E] uppercase">Account Status</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]">
                    Verified Member
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#75777E] block">Email</span>
                  <span className="text-sm font-bold text-[#081B38]">{userProfile.email}</span>
                </div>
                {userProfile.displayName && (
                  <div>
                    <span className="text-xs text-[#75777E] block">Name</span>
                    <span className="text-sm font-bold text-[#081B38]">{userProfile.displayName}</span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-[#75777E] block">User UID</span>
                  <span className="text-[11px] font-mono text-[#75777E]">{userProfile.uid}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogoutClick}
                disabled={loading}
                className="w-full h-11 bg-[#F1F3FF] hover:bg-[#FFDAD6] text-[#BA1A1A] text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-[#E8EDFF] transition-colors cursor-pointer"
              >
                <LogOut size={16} />
                <span>{loading ? 'Signing out...' : 'Sign Out of Account'}</span>
              </button>
            </div>
          ) : (
            // Sign in / Sign up form
            <div>
              {/* Anonymous session notice */}
              <div className="p-3.5 rounded-xl bg-[#F1F3FF] border border-[#E0E8FF] mb-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F1E36]">
                  <ShieldCheck size={16} />
                  <span>Current: Anonymous Preview Session</span>
                </div>
                <p className="text-[11px] text-[#75777E] mt-1 leading-relaxed">
                  You are currently using an isolated preview session (UID: {userProfile.uid.slice(0, 8)}...). Sign in or register to persist your projects across devices.
                </p>
              </div>

              {/* Mode switch pills */}
              <div className="grid grid-cols-2 p-1 bg-[#F1F3FF] rounded-xl mb-4 border border-[#E8EDFF]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-white text-[#081B38] shadow-xs'
                      : 'text-[#75777E] hover:text-[#081B38]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-white text-[#081B38] shadow-xs'
                      : 'text-[#75777E] hover:text-[#081B38]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#44474D] mb-1">
                      Full Name / Company
                    </label>
                    <div className="relative">
                      <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#75777E]" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Lead Engineer"
                        className="w-full h-10 pl-9 pr-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38] transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#44474D] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#75777E]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="engineer@project.com"
                      className="w-full h-10 pl-9 pr-3 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#44474D] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#75777E]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 pl-9 pr-11 text-xs bg-[#F9F9FF] border border-[#E8EDFF] rounded-xl focus:outline-none focus:border-[#081B38] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-[#75777E] hover:text-[#081B38]"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {mode === 'signup' && (
                    <span className="text-[10px] text-[#75777E] mt-1 block">
                      Must be at least 6 characters.
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-[#000412] hover:bg-[#0F1E36] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer mt-4"
                >
                  {mode === 'signin' ? <LogIn size={16} /> : <UserPlus size={16} />}
                  <span>
                    {loading
                      ? 'Processing...'
                      : mode === 'signin'
                      ? 'Sign In to Tracker'
                      : 'Register & Launch'}
                  </span>
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-[#E8EDFF]">
                <button
                  type="button"
                  onClick={() => { window.location.href = '/admin'; }}
                  className="w-full h-10 rounded-xl text-xs font-semibold text-[#0F1E36] bg-[#F1F3FF] hover:bg-[#E8EDFF] border border-[#E0E8FF] flex items-center justify-center gap-2 transition-colors"
                >
                  <ShieldCheck size={15} />
                  Administrator Sign In
                </button>
                <p className="text-[10px] text-center text-[#75777E] mt-2">
                  Administrator accounts are provisioned separately.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
