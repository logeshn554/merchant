import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantNotificationsScreen extends ConsumerStatefulWidget {
  const MerchantNotificationsScreen({super.key});

  @override
  ConsumerState<MerchantNotificationsScreen> createState() => _MerchantNotificationsScreenState();
}

class _MerchantNotificationsScreenState extends ConsumerState<MerchantNotificationsScreen> {
  bool _isLoading = true;
  List<dynamic> _notifications = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.getNotifications(role: 'MERCHANT_ADMIN');
      if (mounted) {
        setState(() {
          _notifications = (res['notifications'] as List<dynamic>?) ?? [];
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
      appBar: const AllGoAppBar(title: 'Merchant Alerts', showBackButton: true),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _notifications.isEmpty
              ? const Center(child: Text('No store alerts or settlement notices.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _notifications.length,
                  itemBuilder: (ctx, idx) {
                    final n = _notifications[idx];
                    return Card(
                      child: ListTile(
                        leading: const Icon(Icons.store, color: Colors.purple),
                        title: Text(n['title']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(n['body']?.toString() ?? ''),
                      ),
                    );
                  },
                ),
    );
  }
}
