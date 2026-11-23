import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';
import 'package:merchant_mobile/src/components/merchant_profile_tiles.dart';
import 'package:merchant_mobile/src/screens/edit_merchant_profile_screen.dart';
import 'package:merchant_mobile/src/screens/edit_outlet_screen.dart';
import 'package:merchant_mobile/src/screens/merchant_resubmission_screen.dart';

void main() {
  group('Merchant Mobile Profile Editing & Resubmission Tests', () {
    testWidgets('MerchantInfoTile renders title, subtitle and edit icon when onTap is provided', (tester) async {
      bool tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MerchantInfoTile(
              title: 'Business Category',
              subtitle: 'RESTAURANT',
              icon: Icons.category_outlined,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Business Category'), findsOneWidget);
      expect(find.text('RESTAURANT'), findsOneWidget);
      expect(find.byIcon(Icons.edit_outlined), findsOneWidget);

      await tester.tap(find.text('Business Category'));
      expect(tapped, isTrue);
    });

    testWidgets('EditMerchantProfileScreen renders form fields and preloads profile data', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockData = {
        'merchant': {
          'business_name': 'Biryani Palace',
          'merchant_type': 'RESTAURANT',
          'description': 'Delicious dum biryani and kebabs',
          'support_phone': '+919123456780',
          'support_email': 'care@biryanipalace.com',
        },
      };

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: EditMerchantProfileScreen(profileData: mockData),
          ),
        ),
      );

      expect(find.text('Edit Business Profile'), findsOneWidget);
      expect(find.text('Store & Business Details'), findsOneWidget);
      expect(find.text('Biryani Palace'), findsOneWidget);
      expect(find.text('Delicious dum biryani and kebabs'), findsOneWidget);
      expect(find.text('+919123456780'), findsOneWidget);
      expect(find.text('care@biryanipalace.com'), findsOneWidget);
      expect(find.text('Save Business Profile'), findsOneWidget);
    });

    testWidgets('EditOutletScreen renders outlet address, pin code and prep time buffer', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockData = {
        'merchant': {'business_name': 'Biryani Palace'},
        'outlet': {
          'outlet_name': 'Anna Nagar Branch',
          'address_line1': '100 Feet Road',
          'address_line2': 'Near Metro Station',
          'postal_code': '600040',
          'phone': '+919123456780',
          'default_prep_time_minutes': 20,
          'packaging_fee_inr': 15.00,
        },
      };

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: EditOutletScreen(profileData: mockData),
          ),
        ),
      );

      expect(find.text('Edit Outlet & Operations'), findsOneWidget);
      expect(find.text('Anna Nagar Branch'), findsOneWidget);
      expect(find.text('100 Feet Road'), findsOneWidget);
      expect(find.text('+919123456780'), findsOneWidget);
      expect(find.text('20 minutes buffer'), findsOneWidget);
      expect(find.text('Save Outlet Details'), findsOneWidget);
    });

    testWidgets('MerchantResubmissionScreen renders compliance fields for PAN, FSSAI, GSTIN and Bank', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockData = {
        'merchant': {
          'business_name': 'Biryani Palace',
          'pan_number': 'BLRPA1234K',
          'fssai_license_number': '12423001000999',
          'gstin': '33AABCA1234A1Z9',
          'bank_beneficiary_name': 'Biryani Foods Pvt Ltd',
          'bank_account_number': '50100999999999',
          'bank_ifsc': 'SBIN0001234',
        },
      };

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: MerchantResubmissionScreen(profileData: mockData),
          ),
        ),
      );

      expect(find.text('Document Resubmission'), findsOneWidget);
      expect(find.text('BLRPA1234K'), findsOneWidget);
      expect(find.text('12423001000999'), findsOneWidget);
      expect(find.text('33AABCA1234A1Z9'), findsOneWidget);
      expect(find.text('Biryani Foods Pvt Ltd'), findsOneWidget);
      expect(find.text('50100999999999'), findsOneWidget);
      expect(find.text('SBIN0001234'), findsOneWidget);
      expect(find.text('Resubmit for Verification'), findsOneWidget);
    });
  });
}
