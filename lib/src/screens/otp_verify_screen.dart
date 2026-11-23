import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';
import 'merchant_dashboard_shell.dart';
import 'approval_status_screen.dart';
import 'merchant_registration_screen.dart';

class OtpVerifyScreen extends ConsumerStatefulWidget {
  final String phone;

  const OtpVerifyScreen({super.key, required this.phone});

  @override
  ConsumerState<OtpVerifyScreen> createState() => _OtpVerifyScreenState();
}

class _OtpVerifyScreenState extends ConsumerState<OtpVerifyScreen> {
  int _secondsRemaining = 60;
  Timer? _countdownTimer;
  String _enteredCode = '';

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  void _startCountdown() {
    _secondsRemaining = 60;
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_secondsRemaining > 0) {
        setState(() => _secondsRemaining--);
      } else {
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _handleVerify(String code) async {
    _enteredCode = code;
    final authNotifier = ref.read(authNotifierProvider.notifier);
    final success = await authNotifier.verifyOtp(code, platform: 'ANDROID');

    if (!mounted) return;

    if (success) {
      final client = ref.read(apiClientProvider);
      client.activeRole = 'MERCHANT_ADMIN';

      Widget targetScreen;
      try {
        final profile = await client.getMerchantProfile();
        final status = profile['status']?.toString() ?? 'NOT_REGISTERED';
        if (status == 'NOT_REGISTERED' || profile['merchant'] == null) {
          targetScreen = const MerchantRegistrationScreen();
        } else if (status == 'APPROVED' || status == 'LIVE' || status == 'ACTIVE') {
          targetScreen = const MerchantDashboardShell();
        } else {
          targetScreen = ApprovalStatusScreen(status: status);
        }
      } catch (_) {
        targetScreen = const ApprovalStatusScreen(status: 'SUBMITTED');
      }

      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => targetScreen),
        (route) => false,
      );
    } else {
      final error = ref.read(authNotifierProvider).errorMessage ?? 'Verification failed';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: AllGoColors.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    return Scaffold(
      backgroundColor: AllGoColors.surface,
      appBar: const AllGoAppBar(title: 'Merchant Verification'),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              Text('Enter 6-digit code', style: AllGoTypography.heading2),
              const SizedBox(height: 8),
              Text('Dispatched via SMS to ${widget.phone}.', style: AllGoTypography.subtitle),
              const SizedBox(height: 36),
              AllGoOtpInput(
                length: 6,
                onCompleted: (code) => _handleVerify(code),
                onChanged: (code) => _enteredCode = code,
              ),
              const SizedBox(height: 24),
              Center(
                child: Text(
                  _secondsRemaining > 0
                      ? 'Resend OTP in $_secondsRemaining seconds'
                      : 'Resend code available',
                  style: AllGoTypography.bodyMedium.copyWith(color: AllGoColors.textTertiary),
                ),
              ),
              const Spacer(),
              AllGoButton(
                label: 'Verify & Access Dashboard',
                isLoading: authState.isLoading,
                onPressed: _enteredCode.length == 6 ? () => _handleVerify(_enteredCode) : null,
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

