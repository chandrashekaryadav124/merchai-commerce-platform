import React, { useState } from 'react';
import {
  X, Lock, Mail, User as UserIcon, Shield, KeyRound, AlertCircle, CheckCircle,
  ChevronDown, Sparkles
} from 'lucide-react';
import { loginUser, registerUser, setInitialPassword } from '../../services/api';
import type { UserRole, User } from '../../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
}

export function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'setup_password'>('login');
  
  // Auth Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const role: UserRole = 'CUSTOMER';
  const [newPassword, setNewPassword] = useState('');

  // Customer Profile Demographic Fields (Optional)
  const [showOptionalProfile, setShowOptionalProfile] = useState(false);
  const [gender, setGender] = useState('');
  const [age, setAge] = useState<string>('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [pincodePrefix, setPincodePrefix] = useState<string>('');
  const [preferredDevice, setPreferredDevice] = useState('');
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState('');

  // State Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'login') {
        const data = await loginUser(email, password);
        localStorage.setItem('access_token', data.access_token);
        const userObj: User = {
          user_id: data.user_id,
          full_name: data.full_name,
          email: data.email,
          role: data.role.toUpperCase() as UserRole,
          is_active: true
        };
        onLoginSuccess(userObj, data.access_token);
        onClose();
      } else if (mode === 'register') {
        // Frontend Validations
        if (password !== confirmPassword) {
          setError('Passwords do not match. Please verify your password confirmation.');
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError('Password must be at least 6 characters long.');
          setLoading(false);
          return;
        }

        const ageNum = age ? parseFloat(age) : undefined;
        if (ageNum !== undefined && (isNaN(ageNum) || ageNum < 0 || ageNum > 120)) {
          setError('Please enter a valid age between 0 and 120.');
          setLoading(false);
          return;
        }

        const pincodeNum = pincodePrefix ? parseInt(pincodePrefix, 10) : undefined;
        if (pincodeNum !== undefined && (isNaN(pincodeNum) || pincodeNum < 0)) {
          setError('Please enter a valid numeric postal code prefix.');
          setLoading(false);
          return;
        }

        const data = await registerUser({
          full_name: fullName,
          email,
          password,
          role: role.toLowerCase(),
          gender: gender || undefined,
          age: ageNum,
          state: state || undefined,
          city: city || undefined,
          pincode_prefix: pincodeNum,
          preferred_device: preferredDevice || undefined,
          preferred_payment_method: preferredPaymentMethod || undefined
        });

        setSuccessMsg(`Account successfully created for ${data.email}! You can now sign in.`);
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } else if (mode === 'setup_password') {
        if (newPassword.length < 6) {
          setError('New password must be at least 6 characters long.');
          setLoading(false);
          return;
        }

        await setInitialPassword(email, newPassword);
        setSuccessMsg(`Password established successfully for ${email}. Please sign in with your new password.`);
        setMode('login');
        setNewPassword('');
      }
    } catch (err: any) {
      if (err.message?.includes('setup required') || err.message?.includes('403')) {
        setMode('setup_password');
        setError('Account activation required. Please enter your email and set a new password below.');
      } else {
        setError(err.message || 'Authentication operation failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={`bg-white border border-[#DCEAF0] rounded-3xl p-6 md:p-8 w-full ${mode === 'register' ? 'max-w-lg' : 'max-w-md'} relative shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#667085] hover:text-[#14213D] rounded-full bg-[#F5F1E8] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#14213D] text-[#FCA311] flex items-center justify-center shadow-md">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#14213D] font-['Space_Grotesk']">
              {mode === 'login' && 'Account Sign In'}
              {mode === 'register' && 'Customer Registration'}
              {mode === 'setup_password' && 'Activate Account'}
            </h2>
            <p className="text-xs text-[#667085] mt-0.5">
              Secure JWT authorization & server-side RBAC
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-[#B42318] text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-[#B42318] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[#15803D] text-xs flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-[#14213D] mb-1">
                Full Name <span className="text-[#B42318]">*</span>
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-3 text-[#567C8D]" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#14213D] mb-1">
              Email Address <span className="text-[#B42318]">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-[#567C8D]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
              />
            </div>
          </div>

          {mode !== 'setup_password' ? (
            <>
              <div>
                <label className="block text-xs font-bold text-[#14213D] mb-1">
                  Password <span className="text-[#B42318]">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-[#567C8D]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-[#14213D] mb-1">
                    Confirm Password <span className="text-[#B42318]">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-[#567C8D]" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="block text-xs font-bold text-[#14213D] mb-1">New Password for Activation</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-3 text-[#567C8D]" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                />
              </div>
            </div>
          )}

          {/* Optional Profile Demographics Section for Customer Registration */}
          {mode === 'register' && (
            <div className="mt-4 pt-4 border-t border-[#DCEAF0]">
              <button
                type="button"
                onClick={() => setShowOptionalProfile(!showOptionalProfile)}
                className="w-full flex items-center justify-between py-2 text-xs font-bold text-[#567C8D] hover:text-[#14213D] transition focus:outline-none cursor-pointer"
              >
                <span className="flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#FCA311]" />
                  <span>Demographic Profile Details (Optional)</span>
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showOptionalProfile ? 'rotate-180' : ''}`} />
              </button>

              {showOptionalProfile && (
                <div className="mt-3 space-y-3 bg-[#FAF9F6] p-4 rounded-2xl border border-[#DCEAF0] text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#667085] font-semibold mb-1">Gender</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full bg-white border border-[#DCEAF0] rounded-lg px-2.5 py-2 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                      >
                        <option value="">Not Specified</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-Binary">Non-Binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#667085] font-semibold mb-1">Age</label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="e.g. 28"
                        className="w-full bg-white border border-[#DCEAF0] rounded-lg px-2.5 py-2 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#667085] font-semibold mb-1">City</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Bengaluru"
                        className="w-full bg-white border border-[#DCEAF0] rounded-lg px-2.5 py-2 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                      />
                    </div>

                    <div>
                      <label className="block text-[#667085] font-semibold mb-1">State</label>
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="e.g. Karnataka"
                        className="w-full bg-white border border-[#DCEAF0] rounded-lg px-2.5 py-2 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#667085] font-semibold mb-1">Pincode Prefix</label>
                      <input
                        type="number"
                        value={pincodePrefix}
                        onChange={(e) => setPincodePrefix(e.target.value)}
                        placeholder="e.g. 560"
                        className="w-full bg-white border border-[#DCEAF0] rounded-lg px-2.5 py-2 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                      />
                    </div>

                    <div>
                      <label className="block text-[#667085] font-semibold mb-1">Preferred Device</label>
                      <select
                        value={preferredDevice}
                        onChange={(e) => setPreferredDevice(e.target.value)}
                        className="w-full bg-white border border-[#DCEAF0] rounded-lg px-2.5 py-2 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                      >
                        <option value="">Select Device</option>
                        <option value="Mobile App">Mobile App</option>
                        <option value="Desktop">Desktop</option>
                        <option value="Mobile Web">Mobile Web</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#667085] font-semibold mb-1">Preferred Payment Method</label>
                    <select
                      value={preferredPaymentMethod}
                      onChange={(e) => setPreferredPaymentMethod(e.target.value)}
                      className="w-full bg-white border border-[#DCEAF0] rounded-lg px-2.5 py-2 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                    >
                      <option value="">Select Payment Method</option>
                      <option value="UPI">UPI</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Cash on Delivery">Cash on Delivery</option>
                      <option value="Net Banking">Net Banking</option>
                      <option value="EMI">EMI</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl font-bold text-xs transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In to Account' : mode === 'register' ? 'Register Customer Account' : 'Set Password & Activate'}
            </span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#DCEAF0] text-center text-xs text-[#667085] flex justify-between font-bold">
          {mode === 'login' ? (
            <>
              <button onClick={() => setMode('register')} className="text-[#567C8D] hover:underline cursor-pointer">
                Create Account
              </button>
              <button onClick={() => setMode('setup_password')} className="text-[#B45309] hover:underline cursor-pointer">
                Activate Seeded Account
              </button>
            </>
          ) : (
            <button onClick={() => setMode('login')} className="text-[#14213D] hover:underline mx-auto cursor-pointer">
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
