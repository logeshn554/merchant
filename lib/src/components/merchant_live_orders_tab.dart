import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantLiveOrdersTab extends StatelessWidget {
  final int selectedOrderTab;
  final ValueChanged<int> onTabSelected;
  final List<MerchantOrder> orders;
  final bool isLoading;
  final VoidCallback onRefresh;
  final void Function(MerchantOrder order) onAccept;
  final void Function(MerchantOrder order) onReject;
  final void Function(MerchantOrder order, String nextStatus) onUpdateStatus;

  const MerchantLiveOrdersTab({
    super.key,
    required this.selectedOrderTab,
    required this.onTabSelected,
    required this.orders,
    required this.isLoading,
    required this.onRefresh,
    required this.onAccept,
    required this.onReject,
    required this.onUpdateStatus,
  });

  List<MerchantOrder> get filteredOrders {
    switch (selectedOrderTab) {
      case 0:
        return orders.where((o) => o.status == 'CREATED' || o.status == 'PAID' || o.status == 'PLACED').toList();
      case 1:
        return orders.where((o) => o.status == 'ACCEPTED' || o.status == 'PREPARING').toList();
      case 2:
        return orders.where((o) => o.status == 'READY_FOR_PICKUP' || o.status == 'DISPATCHED' || o.status == 'OUT_FOR_DELIVERY').toList();
      case 3:
      default:
        return orders.where((o) => o.status == 'DELIVERED' || o.status == 'CANCELLED').toList();
    }
  }

  Widget _buildOrderTabChip(int index, String label) {
    final isSelected = selectedOrderTab == index;
    return GestureDetector(
      onTap: () => onTabSelected(index),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF6200EA) : AllGoColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? const Color(0xFF6200EA) : AllGoColors.divider),
        ),
        child: Text(
          label,
          style: AllGoTypography.caption.copyWith(
            color: isSelected ? Colors.white : AllGoColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final list = filteredOrders;
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: AllGoColors.surface,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildOrderTabChip(0, 'New Orders'),
                const SizedBox(width: 8),
                _buildOrderTabChip(1, 'Preparing'),
                const SizedBox(width: 8),
                _buildOrderTabChip(2, 'Ready'),
                const SizedBox(width: 8),
                _buildOrderTabChip(3, 'History'),
              ],
            ),
          ),
        ),
        Expanded(
          child: isLoading
              ? const Center(child: CircularProgressIndicator())
              : list.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.receipt_long_outlined, size: 48, color: AllGoColors.textTertiary),
                          const SizedBox(height: 12),
                          Text('No orders in this queue', style: AllGoTypography.subtitle),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: () async => onRefresh(),
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: list.length,
                        itemBuilder: (context, index) {
                          final order = list[index];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text('#${order.subOrderNumber}', style: AllGoTypography.heading3.copyWith(fontSize: 16)),
                                      Text('₹${order.itemsTotalInr.toStringAsFixed(0)}', style: AllGoTypography.heading3.copyWith(color: AllGoColors.success)),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text('Status: ${order.status}', style: AllGoTypography.caption.copyWith(fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 12),
                                  if (selectedOrderTab == 0)
                                    Row(
                                      children: [
                                        Expanded(
                                          child: OutlinedButton(
                                            onPressed: () => onReject(order),
                                            style: OutlinedButton.styleFrom(foregroundColor: AllGoColors.error),
                                            child: const Text('Reject'),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: ElevatedButton(
                                            onPressed: () => onAccept(order),
                                            style: ElevatedButton.styleFrom(backgroundColor: AllGoColors.success, foregroundColor: Colors.white),
                                            child: const Text('Accept Order'),
                                          ),
                                        ),
                                      ],
                                    )
                                  else if (selectedOrderTab == 1)
                                    AllGoButton(
                                      label: 'Mark as Food Ready',
                                      onPressed: () => onUpdateStatus(order, 'READY_FOR_PICKUP'),
                                    )
                                  else if (selectedOrderTab == 2)
                                    AllGoButton(
                                      label: 'Handover to Delivery Partner',
                                      onPressed: () => onUpdateStatus(order, 'DISPATCHED'),
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
