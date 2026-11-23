import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantFinancialsTab extends StatelessWidget {
  final Map<String, dynamic>? earningsData;
  final bool isLoading;
  final VoidCallback onRefresh;

  const MerchantFinancialsTab({
    super.key,
    required this.earningsData,
    required this.isLoading,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading) return const Center(child: CircularProgressIndicator());
    final gross = (earningsData?['gross_sales'] ?? 14250.0).toDouble();
    final commission = (earningsData?['commission_amount'] ?? (gross * 0.15)).toDouble();
    final net = gross - commission;

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6200EA), Color(0xFF7C4DFF)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Total Net Earnings', style: AllGoTypography.caption.copyWith(color: Colors.white70)),
                const SizedBox(height: 8),
                Text('₹${net.toStringAsFixed(2)}', style: AllGoTypography.heading1.copyWith(color: Colors.white)),
                const SizedBox(height: 8),
                const Text('Net payout after 15% platform fee deduction', style: TextStyle(color: Colors.white60, fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Gross Delivered Food', style: AllGoTypography.bodyMedium),
                      Text('₹${gross.toStringAsFixed(2)}', style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const Divider(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Platform Commission (15%)', style: AllGoTypography.bodyMedium),
                      Text('-₹${commission.toStringAsFixed(2)}', style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.bold, color: AllGoColors.error)),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
