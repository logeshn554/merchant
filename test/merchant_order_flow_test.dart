import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';
import 'package:merchant_mobile/src/components/merchant_live_orders_tab.dart';

void main() {
  group('Merchant Order Flow Tests', () {
    testWidgets('MerchantLiveOrdersTab displays order list and responds to accept/reject', (tester) async {
      final mockOrder = MerchantOrder(
        id: 'ord_merch_test_1',
        subOrderNumber: 'AG-2026-8888',
        customerName: 'Priya Raman',
        customerPhone: '+919123456789',
        status: 'PLACED',
        verticalType: 'FOOD',
        itemsTotalInr: 450.0,
        packagingFeeInr: 20.0,
        merchantCommissionInr: 45.0,
        merchantNetPayoutInr: 425.0,
        taxTotalInr: 22.5,
        prepTimeMinutes: 20,
        createdAt: DateTime.now().toIso8601String(),
        items: const [
          MerchantOrderItem(
            itemId: 'item_1',
            itemName: 'Paneer Butter Masala',
            quantity: 1,
            unitPriceInr: 250.0,
            totalPriceInr: 250.0,
          ),
          MerchantOrderItem(
            itemId: 'item_2',
            itemName: 'Butter Naan',
            quantity: 2,
            unitPriceInr: 100.0,
            totalPriceInr: 200.0,
          ),
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
