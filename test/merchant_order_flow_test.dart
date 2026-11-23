import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';
import 'package:allgo_merchant_mobile/src/components/merchant_live_orders_tab.dart';

void main() {
  group('Merchant Order Flow Tests', () {
    testWidgets('MerchantLiveOrdersTab displays order list and responds to accept/reject', (tester) async {
      final mockOrder = MerchantOrder(
        id: 'ord_merch_test_1',
        orderNumber: 'AG-2026-8888',
        customerName: 'Priya Raman',
        customerPhone: '+919123456789',
        status: 'PLACED',
        totalAmount: 450.0,
        itemCount: 2,
        createdAt: DateTime.now(),
        items: const [
          OrderItem(name: 'Paneer Butter Masala', quantity: 1, price: 250.0),
          OrderItem(name: 'Butter Naan', quantity: 2, price: 100.0),
        ],
      );

      bool accepted = false;
      bool rejected = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MerchantLiveOrdersTab(
              selectedOrderTab: 0,
              onTabSelected: (_) {},
              orders: [mockOrder],
              isLoading: false,
              onRefresh: () {},
              onAccept: (_) => accepted = true,
              onReject: (_) => rejected = true,
              onUpdateStatus: (_, __) {},
            ),
          ),
        ),
      );

      expect(find.text('AG-2026-8888'), findsOneWidget);
      expect(find.text('Priya Raman'), findsOneWidget);
      expect(find.text('Accept Order'), findsOneWidget);
      expect(find.text('Reject'), findsOneWidget);

      await tester.tap(find.text('Accept Order'));
      await tester.pump();
      expect(accepted, isTrue);
    });
  });
}
