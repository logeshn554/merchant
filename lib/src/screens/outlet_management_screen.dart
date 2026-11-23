import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';
import 'create_outlet_screen.dart';
import 'operating_hours_screen.dart';
import 'store_branding_media_screen.dart';

class OutletManagementScreen extends ConsumerStatefulWidget {
  const OutletManagementScreen({super.key});

  @override
  ConsumerState<OutletManagementScreen> createState() => _OutletManagementScreenState();
}

class _OutletManagementScreenState extends ConsumerState<OutletManagementScreen> {
  List<dynamic> _outlets = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchOutlets();
  }

  Future<void> _fetchOutlets() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final client = ref.read(apiClientProvider);
      final list = await client.getMerchantOutlets();
      if (mounted) {
        setState(() {
          _outlets = list;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.background,
      appBar: AllGoAppBar(
        title: 'Manage Outlets',
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 22),
            onPressed: _isLoading ? null : _fetchOutlets,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF6200EA),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_business),
        label: const Text('Add Branch'),
        onPressed: () async {
          final res = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => const CreateOutletScreen()),
          );
          if (res == true) {
            _fetchOutlets();
          }
        },
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF6200EA)))
            : _errorMessage != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline, size: 48, color: AllGoColors.error),
                          const SizedBox(height: 12),
                          Text('Failed to load outlets', style: AllGoTypography.heading3),
                          const SizedBox(height: 6),
                          Text(_errorMessage!, style: AllGoTypography.caption, textAlign: TextAlign.center),
                          const SizedBox(height: 16),
                          OutlinedButton(onPressed: _fetchOutlets, child: const Text('Retry')),
                        ],
                      ),
                    ),
                  )
                : _outlets.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.store_mall_directory_outlined, size: 64, color: AllGoColors.textTertiary),
                              const SizedBox(height: 16),
                              Text('No Outlets Found', style: AllGoTypography.heading2),
                              const SizedBox(height: 8),
                              Text(
                                'You have not registered any outlets yet. Tap below to create your first branch.',
                                style: AllGoTypography.caption,
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 24),
                              AllGoButton(
                                label: 'Create Primary Outlet',
                                onPressed: () async {
                                  final res = await Navigator.of(context).push<bool>(
                                    MaterialPageRoute(builder: (_) => const CreateOutletScreen()),
                                  );
                                  if (res == true) _fetchOutlets();
                                },
                              ),
                            ],
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchOutlets,
                        color: const Color(0xFF6200EA),
                        child: ListView.builder(
                          padding: const EdgeInsets.only(left: 20, right: 20, top: 16, bottom: 80),
                          itemCount: _outlets.length,
                          itemBuilder: (context, idx) {
                            final o = _outlets[idx] as Map<String, dynamic>;
                            final outletName = o['outlet_name']?.toString() ?? 'Outlet Branch';
                            final address = o['address_line1']?.toString() ?? '';
                            final postal = o['postal_code']?.toString() ?? '';
                            final outletStatus = o['outlet_status']?.toString() ?? 'PENDING_APPROVAL';
                            final isOpen = o['is_open'] == true;

                            Color statusColor = AllGoColors.warning;
                            String statusLabel = 'PENDING APPROVAL';
                            if (outletStatus == 'ACTIVE') {
                              statusColor = AllGoColors.success;
                              statusLabel = 'ACTIVE & OPERATIONAL';
                            } else if (outletStatus == 'SUSPENDED') {
                              statusColor = AllGoColors.error;
                              statusLabel = 'SUSPENDED';
                            } else if (outletStatus == 'REJECTED') {
                              statusColor = AllGoColors.error;
                              statusLabel = 'REJECTED';
                            }

                            return Container(
                              margin: const EdgeInsets.only(bottom: 14),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AllGoColors.surface,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AllGoColors.divider),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      CircleAvatar(
                                        radius: 20,
                                        backgroundColor: const Color(0xFFEDE7F6),
                                        child: const Icon(Icons.storefront, color: Color(0xFF6200EA), size: 20),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(outletName, style: AllGoTypography.heading3.copyWith(fontSize: 16)),
                                            Text('$address (PIN: $postal)', style: AllGoTypography.caption),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  const Divider(height: 1),
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: statusColor.withOpacity(0.12),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          statusLabel,
                                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: statusColor),
                                        ),
                                      ),
                                      Row(
                                        children: [
                                          Icon(
                                            isOpen ? Icons.check_circle : Icons.pause_circle_outline,
                                            size: 16,
                                            color: isOpen ? AllGoColors.success : AllGoColors.textTertiary,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            isOpen ? 'Open for Orders' : 'Store Closed',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: isOpen ? AllGoColors.success : AllGoColors.textTertiary,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: OutlinedButton.icon(
                                          onPressed: () {
                                            Navigator.of(context).push(
                                              MaterialPageRoute(
                                                builder: (_) => OperatingHoursScreen(
                                                  outletId: o['id'].toString(),
                                                  outletName: outletName,
                                                ),
                                              ),
                                            );
                                          },
                                          icon: const Icon(Icons.schedule, size: 16),
                                          label: const Text('Operating Hours'),
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor: const Color(0xFF6200EA),
                                            side: const BorderSide(color: Color(0xFF6200EA)),
                                            visualDensity: VisualDensity.compact,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: OutlinedButton.icon(
                                          onPressed: () {
                                            Navigator.of(context).push(
                                              MaterialPageRoute(
                                                builder: (_) => StoreBrandingMediaScreen(
                                                  outletId: o['id'].toString(),
                                                  outletName: outletName,
                                                ),
                                              ),
                                            );
                                          },
                                          icon: const Icon(Icons.image_outlined, size: 16),
                                          label: const Text('Logo & Banner'),
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor: AllGoColors.primary,
                                            side: const BorderSide(color: AllGoColors.primary),
                                            visualDensity: VisualDensity.compact,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
      ),
    );
  }
}
