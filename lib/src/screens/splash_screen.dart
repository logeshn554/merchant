import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';
import 'phone_login_screen.dart';
import 'merchant_dashboard_shell.dart';
import 'approval_status_screen.dart';
import 'merchant_registration_screen.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkInitialAuth();
  }

  Future<void> _checkInitialAuth() async {
    await Future.delayed(const Duration(milliseconds: 800));
    if (!mounted) return;

    final client = ref.read(apiClientProvider);
    client.activeRole = 'MERCHANT_ADMIN';

    final authNotifier = ref.read(authNotifierProvider.notifier);
    await authNotifier.checkSession();

    if (!mounted) return;
    final authState = ref.read(authNotifierProvider);

    if (authState.isAuthenticated) {
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
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => targetScreen),
      );
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const PhoneLoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.surface,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: const Color(0xFF6200EA), // Merchant Deep Purple
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(
                Icons.storefront,
                size: 56,
                color: AllGoColors.textInverse,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'AllGo Merchant',
              style: AllGoTypography.heading1.copyWith(fontSize: 30),
            ),
            const SizedBox(height: 8),
            Text(
              'Restaurant & Store Order Management',
              style: AllGoTypography.subtitle,
            ),
            const SizedBox(height: 48),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: Color(0xFF6200EA),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

