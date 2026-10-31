import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { theme } from '../theme';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { merchantApi } from '../api/client';

interface AuthScreenProps {
  onSuccess: (user: any) => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<'email' | 'otp'>('email');
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSendOtp = async () => {
    setError('');
    setNotice('');
    setDevOtpHint('');
    if (!phone || phone.trim().length < 10) {
      setError('Please provide a valid phone number with country code.');
      return;
    }
    setLoading(true);
    try {
      const res = await merchantApi.sendOtp(phone.trim());
      setOtpSent(true);
      if (res.devOtp) {
        setDevOtpHint(`Development code: ${res.devOtp}`);
        setOtpCode(res.devOtp);
      }
      setNotice(res.message || 'Verification code sent to your phone.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setNotice('');
    if (!otpCode || otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      const res = await merchantApi.verifyOtp(phone.trim(), otpCode.trim());
      onSuccess(res.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setNotice('');
    if (!email || !password) {
      setError('Please fill in email and password.');
      return;
    }
    if (isRegister && (!name || !phone || !restaurantName)) {
      setError('Please provide your name, phone, and restaurant name.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const res = await merchantApi.register(name.trim(), email.trim(), password, phone.trim(), restaurantName.trim());
        onSuccess(res.profile);
      } else {
        const res = await merchantApi.login(email.trim(), password);
        onSuccess(res.profile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.brandBox}>
          <View style={styles.brandLogo}>
            <Text style={styles.brandLogoText}>M</Text>
          </View>
          <Text style={styles.brandTitle}>AllGo <Text style={{ color: theme.colors.primary }}>Merchant</Text></Text>
          <Text style={styles.brandSubtitle}>Restaurant Kitchen & Orders Manager</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {authMode === 'otp'
              ? otpSent ? 'Enter SMS Code' : 'Partner Phone Sign In'
              : isRegister ? 'Register Restaurant' : 'Merchant Sign In'}
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {notice ? (
            <View style={[styles.errorBox, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.primary }]}>
              <Text style={[styles.errorText, { color: theme.colors.primary }]}>{notice}</Text>
              {devOtpHint ? <Text style={{ color: theme.colors.emerald, fontWeight: '700', fontSize: 13, marginTop: 4 }}>{devOtpHint}</Text> : null}
            </View>
          ) : null}

          {authMode === 'otp' ? (
            <>
              {!otpSent ? (
                <>
                  <Input
                    label="Merchant Phone Number"
                    placeholder="+919876543211"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                  <Button
                    title="Send Verification Code"
                    onPress={handleSendOtp}
                    loading={loading}
                    style={{ marginTop: theme.spacing.sm }}
                  />
                </>
              ) : (
                <>
                  <Input
                    label="6-Digit SMS Code"
                    placeholder="123456"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otpCode}
                    onChangeText={setOtpCode}
                  />
                  <Button
                    title="Verify Code & Sign In"
                    onPress={handleVerifyOtp}
                    loading={loading}
                    style={{ marginTop: theme.spacing.sm }}
                  />
                  <TouchableOpacity
                    style={{ marginTop: theme.spacing.md, alignItems: 'center' }}
                    onPress={() => {
                      setOtpSent(false);
                      setOtpCode('');
                      setNotice('');
                    }}
                  >
                    <Text style={{ color: theme.colors.textSecondary, fontSize: theme.fontSize.xs }}>
                      Change phone number
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => {
                  setAuthMode('email');
                  setError('');
                  setNotice('');
                }}
              >
                <Text style={styles.switchText}>Sign in with Email & Password instead</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {isRegister && (
                <>
                  <Input
                    label="Restaurant Name"
                    placeholder="Spice Symphony"
                    value={restaurantName}
                    onChangeText={setRestaurantName}
                  />
                  <Input
                    label="Owner Name"
                    placeholder="Chef Rajesh"
                    value={name}
                    onChangeText={setName}
                  />
                  <Input
                    label="Phone Number"
                    placeholder="+919876543211"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </>
              )}

              <Input
                label="Business Email"
                placeholder="merchant@allgo.in"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Input
                label="Password"
                placeholder="••••••••••••"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <Button
                title={isRegister ? 'Submit Application' : 'Open Kitchen Hub'}
                onPress={handleSubmit}
                loading={loading}
                style={{ marginTop: theme.spacing.sm }}
              />

              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => {
                  setAuthMode('otp');
                  setError('');
                  setNotice('');
                }}
              >
                <Text style={styles.switchText}>Sign in with Phone & OTP</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.switchButton, { marginTop: theme.spacing.sm }]}
                onPress={() => {
                  setIsRegister(!isRegister);
                  setError('');
                  setNotice('');
                }}
              >
                <Text style={[styles.switchText, { color: theme.colors.textSecondary }]}>
                  {isRegister
                    ? 'Already an approved merchant? Sign in'
                    : 'Want to partner with AllGo? Register restaurant'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  brandLogo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  brandLogoText: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.white,
  },
  brandTitle: {
    fontSize: theme.fontSize.display,
    fontWeight: '900',
    color: theme.colors.text,
  },
  brandSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
  },
  cardTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  errorBox: {
    backgroundColor: theme.colors.roseLight,
    borderColor: theme.colors.rose,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.rose,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
  },
  switchText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
});
