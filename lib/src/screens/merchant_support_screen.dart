import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantSupportScreen extends ConsumerStatefulWidget {
  const MerchantSupportScreen({super.key});

  @override
  ConsumerState<MerchantSupportScreen> createState() => _MerchantSupportScreenState();
}

class _MerchantSupportScreenState extends ConsumerState<MerchantSupportScreen> {
  bool _isLoading = true;
  List<dynamic> _tickets = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.getUserSupportTickets(role: 'MERCHANT_ADMIN');
      if (mounted) setState(() { _tickets = res; _isLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _createTicket() async {
    final subCtrl = TextEditingController();
    final descCtrl = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Merchant Support Inquiry'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: subCtrl, decoration: const InputDecoration(labelText: 'Subject')),
            const SizedBox(height: 12),
            TextField(controller: descCtrl, maxLines: 3, decoration: const InputDecoration(labelText: 'Details')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Submit')),
        ],
      ),
    );

    if (ok == true && mounted) {
      final client = ref.read(apiClientProvider);
      await client.createSupportTicket({
        'category': 'MERCHANT_QUERY',
        'subject': subCtrl.text.trim(),
        'description': descCtrl.text.trim(),
      }, role: 'MERCHANT_ADMIN');
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.background,
      appBar: const AllGoAppBar(title: 'Merchant Support', showBackButton: true),
      floatingActionButton: FloatingActionButton(
        onPressed: _createTicket,
        backgroundColor: Colors.purple,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _tickets.isEmpty
              ? const Center(child: Text('No merchant support tickets opened.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _tickets.length,
                  itemBuilder: (ctx, idx) {
                    final t = _tickets[idx];
                    return Card(
                      child: ListTile(
                        title: Text(t['subject']?.toString() ?? 'Ticket', style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text('Status: ${t['status']}'),
                      ),
                    );
                  },
                ),
    );
  }
}
