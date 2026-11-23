import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:merchant_mobile/src/screens/phone_login_screen.dart';

void main() {
  group('Merchant Mobile App Smoke Tests', () {
    testWidgets('PhoneLoginScreen renders Merchant Portal login UI correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: PhoneLoginScreen(),
          ),
        ),
      );

      // Verify title in AppBar
      expect(find.text('Merchant Portal'), findsOneWidget);

      // Verify heading and subtitle
      expect(find.text('Manage Your AllGo Store'), findsOneWidget);
      expect(
        find.text('Log in as a restaurant owner, dark store operator, or outlet manager.'),
        findsOneWidget,
      );

      // Verify CTA button
      expect(find.text('Send Verification Code'), findsOneWidget);
    });
  });
}
