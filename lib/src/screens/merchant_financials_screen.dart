import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantFinancialsScreen extends ConsumerStatefulWidget {
  const MerchantFinancialsScreen({super.key});

  @override
  ConsumerState<MerchantFinancialsScreen> createState() => _MerchantFinancialsScreenState();
}

class _MerchantFinancialsScreenState extends ConsumerState<MerchantFinancialsScreen> {
  bool _isLoading = true;
  double _grossSales = 0.0;
  double _commission = 0.0;
  double _netSettled = 0.0;
  List<dynamic> _settlements = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final client = ref.read(apiClientProvider);
      final overview = await client.getMerchantFinancialOverview();
      final settles = await client.getMerchantSettlements();
      if (mounted) {
        setState(() {
          _grossSales = (overview['totalGrossSalesInr'] as num?)?.toDouble() ?? 0.0;
          _commission = (overview['totalCommissionInr'] as num?)?.toDouble() ?? 0.0;
          _netSettled = (overview['netSettledInr'] as num?)?.toDouble() ?? 0.0;
          _settlements = settles;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.background,
      appBar: const AllGoAppBar(title: 'Settlements & Invoices', showBackButton: true),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF4A148C), Color(0xFF7B1FA2)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('TOTAL GROSS SALES', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        Text('₹${_grossSales.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Platform Commission', style: TextStyle(color: Colors.white70, fontSize: 11)),
                                Text('₹${_commission.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Net Settled to Bank', style: TextStyle(color: Colors.white70, fontSize: 11)),
                                Text('₹${_netSettled.toStringAsFixed(2)}', style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 16)),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text('SETTLEMENT STATEMENTS', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AllGoColors.textSecondary)),
                  const SizedBox(height: 12),
                  if (_settlements.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AllGoColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AllGoColors.divider),
                      ),
                      child: const Text('No merchant settlement statements yet.', style: TextStyle(color: AllGoColors.textTertiary)),
                    )
                  else
                    ..._settlements.map((s) {
                      final net = (s['net_payable_inr'] as num?)?.toDouble() ?? 0.0;
                      final orders = s['total_orders'] ?? 0;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AllGoColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AllGoColors.divider, width: 0.6),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Statement #${s['id'].toString().substring(0, 8)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                                Text('$orders sub-orders • TCS: ₹${s['tax_withheld_tcs_inr']}', style: const TextStyle(fontSize: 12, color: AllGoColors.textSecondary)),
                              ],
                            ),
                            Text('₹${net.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.purple, fontSize: 16)),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}
