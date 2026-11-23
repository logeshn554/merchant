import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';
import 'src/screens/splash_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: AllGoMerchantApp(),
    ),
  );
}

class AllGoMerchantApp extends StatelessWidget {
  const AllGoMerchantApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AllGo Merchant',
      debugShowCheckedModeBanner: false,
      theme: AllGoTheme.lightTheme.copyWith(
        colorScheme: ColorScheme.light(
          primary: const Color(0xFF6200EA),
          secondary: AllGoColors.secondary,
          surface: AllGoColors.surface,
          error: AllGoColors.error,
        ),
      ),
      home: const SplashScreen(),
    );
  }
}

