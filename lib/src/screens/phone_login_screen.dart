import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';
import 'otp_verify_screen.dart';

class PhoneLoginScreen extends ConsumerStatefulWidget {
  const PhoneLoginScreen({super.key});

  @override
  ConsumerState<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends ConsumerState<PhoneLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleContinue() async {
    if (!_formKey.currentState!.validate()) return;

    final rawDigits = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    final fullE164Phone = '+91$rawDigits';

    final authNotifier = ref.read(authNotifierProvider.notifier);
    final success = await authNotifier.requestOtp(fullE164Phone);

    if (!mounted) return;

    if (success) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => OtpVerifyScreen(phone: fullE164Phone),
        ),
      );
    } else {
      final error = ref.read(authNotifierProvider).errorMessage ?? 'Failed to send OTP';
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
      appBar: const AllGoAppBar(title: 'Merchant Portal', showBackButton: false),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 16),
                Text('Manage Your AllGo Store', style: AllGoTypography.heading2),
                const SizedBox(height: 8),
                Text(
                  'Log in as a restaurant owner, dark store operator, or outlet manager.',
                  style: AllGoTypography.subtitle,
                ),
                const SizedBox(height: 36),
                AllGoPhoneInput(
                  controller: _phoneController,
                  enabled: !authState.isLoading,
                ),
                const Spacer(),
                AllGoButton(
                  label: 'Send Verification Code',
                  isLoading: authState.isLoading,
                  onPressed: _handleContinue,
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

