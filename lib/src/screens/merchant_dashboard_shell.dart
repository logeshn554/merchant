import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';
import 'operating_hours_screen.dart';
import 'merchant_profile_screen.dart';
import '../components/merchant_live_orders_tab.dart';
import '../components/merchant_menu_catalog_tab.dart';
import '../components/merchant_financials_tab.dart';

class MerchantDashboardShell extends ConsumerStatefulWidget {
  const MerchantDashboardShell({super.key});

  @override
  ConsumerState<MerchantDashboardShell> createState() => _MerchantDashboardShellState();
}

class _MerchantDashboardShellState extends ConsumerState<MerchantDashboardShell> {
  // Operational order queues: New Orders, Preparing, Ready for Courier, History
  // Financial metrics: client.getMerchantEarnings, Total Net Earnings, Platform Commission (15%), Gross Delivered Food
  int _currentTabIndex = 0;
  int _selectedOrderTab = 0;
  bool _isLoading = true;
  bool _isTogglingOutlet = false;

  MerchantDashboardData? _dashboardData;
  List<MerchantOrder> _orders = [];
  List<ProductItem> _products = [];
  Map<String, dynamic>? _earningsData;
  bool _isOpen = true;
  int _defaultPrepMinutes = 15;

  @override
  void initState() {
    super.initState();
    _loadAllDashboardData();
  }

  Future<void> _loadAllDashboardData() async {
    setState(() => _isLoading = true);
    final client = ref.read(apiClientProvider);
    try {
      final data = await client.getMerchantDashboard().catchError((_) => MerchantDashboardData.empty());
      final orders = await client.getMerchantOrders().catchError((_) => <MerchantOrder>[]);
      final products = await client.getMerchantProducts().catchError((_) => <ProductItem>[]);
      final earnings = await client.getMerchantEarnings().catchError((_) => <String, dynamic>{});

      if (mounted) {
        setState(() {
          _dashboardData = data;
          _orders = orders;
          _products = products;
          _earningsData = earnings;
          _isOpen = data.outletIsOpen;
          _defaultPrepMinutes = data.defaultPrepTimeMinutes;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleToggleOutlet(bool val) async {
    setState(() => _isTogglingOutlet = true);
    final client = ref.read(apiClientProvider);
    try {
      final outletId = _dashboardData?.outletId ?? 'outlet-primary';
      await client.updateOutletStatus(outletId, val, defaultPrepTimeMinutes: _defaultPrepMinutes);
      setState(() => _isOpen = val);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(val ? 'STORE IS OPEN: Accepting live customer orders' : 'STORE IS CLOSED: Store paused'),
          backgroundColor: val ? AllGoColors.success : AllGoColors.textSecondary,
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _isTogglingOutlet = false);
    }
  }

  Future<void> _handleAcceptOrder(MerchantOrder order) async {
    final client = ref.read(apiClientProvider);
    try {
      await client.updateOrderStatus(order.id, 'ACCEPTED');
      _loadAllDashboardData();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  Future<void> _handleRejectOrder(MerchantOrder order) async {
    final client = ref.read(apiClientProvider);
    try {
      await client.updateOrderStatus(order.id, 'CANCELLED');
      _loadAllDashboardData();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  Future<void> _handleUpdateOrderStatus(MerchantOrder order, String nextStatus) async {
    final client = ref.read(apiClientProvider);
    try {
      await client.updateOrderStatus(order.id, nextStatus);
      _loadAllDashboardData();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  Future<void> _handleToggleProductStock(ProductItem product, bool inStock) async {
    final client = ref.read(apiClientProvider);
    try {
      await client.updateMerchantInventory(product.id, isInStock: inStock);
      setState(() {
        final idx = _products.indexWhere((p) => p.id == product.id);
        if (idx != -1) _products[idx] = product.copyWith(isInStock: inStock);
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  void _showAddProductModal() {
    final nameCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    bool isVeg = true;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setMState) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, top: 20, left: 20, right: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Add New Catalog Product', style: AllGoTypography.heading3),
              const SizedBox(height: 16),
              AllGoTextField(label: 'Item Name', controller: nameCtrl),
              const SizedBox(height: 12),
              AllGoTextField(label: 'Base Price (₹)', controller: priceCtrl, keyboardType: TextInputType.number),
              const SizedBox(height: 12),
              SwitchListTile(
                value: isVeg,
                title: Text(isVeg ? 'Vegetarian' : 'Non-Vegetarian'),
                activeColor: Colors.green,
                onChanged: (v) => setMState(() => isVeg = v),
              ),
              const SizedBox(height: 16),
              AllGoButton(
                label: 'Save Product',
                onPressed: () async {
                  Navigator.pop(ctx);
                  final client = ref.read(apiClientProvider);
                  await client.createMerchantProduct({
                    'name': nameCtrl.text.trim(),
                    'basePriceInr': double.tryParse(priceCtrl.text) ?? 100.0,
                    'isVeg': isVeg,
                    'stockQuantity': 50,
                  });
                  _loadAllDashboardData();
                },
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOverviewScreen() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _isOpen ? Colors.green.shade50 : Colors.red.shade50,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _isOpen ? Colors.green : Colors.red),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_isOpen ? 'STORE IS OPEN' : 'STORE IS CLOSED', style: AllGoTypography.heading3.copyWith(color: _isOpen ? Colors.green.shade800 : Colors.red.shade800)),
                  Text(_isOpen ? 'Accepting live customer orders' : 'Store is paused. Orders disabled', style: AllGoTypography.caption),
                ],
              ),
              Switch(
                value: _isOpen,
                activeColor: Colors.green,
                onChanged: _isTogglingOutlet ? null : (v) => _handleToggleOutlet(v),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Card(
          child: ListTile(
            leading: const Icon(Icons.access_time, color: Color(0xFF6200EA)),
            title: const Text('Store Operating Hours & Closures'),
            subtitle: const Text('Configure weekly hours and holiday closures'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => OperatingHoursScreen(outletId: _dashboardData?.outletId ?? 'primary')),
              );
            },
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.background,
      appBar: AllGoAppBar(title: _currentTabIndex == 0 ? 'Merchant Overview' : _currentTabIndex == 1 ? 'Live Orders' : _currentTabIndex == 2 ? 'Menu Catalog' : _currentTabIndex == 3 ? 'Financials' : 'Store Profile'),
      body: _currentTabIndex == 0
          ? _buildOverviewScreen()
          : _currentTabIndex == 1
              ? MerchantLiveOrdersTab(
                  selectedOrderTab: _selectedOrderTab,
                  onTabSelected: (idx) => setState(() => _selectedOrderTab = idx),
                  orders: _orders,
                  isLoading: _isLoading,
                  onRefresh: _loadAllDashboardData,
                  onAccept: _handleAcceptOrder,
                  onReject: _handleRejectOrder,
                  onUpdateStatus: _handleUpdateOrderStatus,
                )
              : _currentTabIndex == 2
                  ? MerchantMenuCatalogTab(
                      products: _products,
                      isLoading: _isLoading,
                      onRefresh: _loadAllDashboardData,
                      onToggleStock: _handleToggleProductStock,
                      onAddProduct: _showAddProductModal,
                    )
                  : _currentTabIndex == 3
                      ? MerchantFinancialsTab(
                          earningsData: _earningsData,
                          isLoading: _isLoading,
                          onRefresh: _loadAllDashboardData,
                        )
                      : const MerchantProfileScreen(),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentTabIndex,
        selectedItemColor: const Color(0xFF6200EA),
        unselectedItemColor: AllGoColors.textTertiary,
        type: BottomNavigationBarType.fixed,
        onTap: (idx) => setState(() => _currentTabIndex = idx),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), label: 'Overview'),
          BottomNavigationBarItem(icon: Icon(Icons.receipt_long_outlined), label: 'Orders'),
          BottomNavigationBarItem(icon: Icon(Icons.restaurant_menu), label: 'Menu'),
          BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet_outlined), label: 'Earnings'),
          BottomNavigationBarItem(icon: Icon(Icons.storefront_outlined), label: 'Store'),
        ],
      ),
    );
  }
}
