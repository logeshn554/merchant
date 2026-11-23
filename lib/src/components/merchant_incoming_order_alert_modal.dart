import 'dart:async';
import 'package:flutter/material.dart';

class MerchantIncomingOrderAlertModal extends StatefulWidget {
  final String orderId;
  final String orderNumber;
  final String customerName;
  final int totalAmountPaise;
  final List<String> itemSummaries;
  final int timeoutSeconds;
  final Future<void> Function() onAccept;
  final Future<void> Function(String reason) onReject;

  const MerchantIncomingOrderAlertModal({
    super.key,
    required this.orderId,
    required this.orderNumber,
    required this.customerName,
    required this.totalAmountPaise,
    required this.itemSummaries,
    this.timeoutSeconds = 90,
    required this.onAccept,
    required this.onReject,
  });

  @override
  State<MerchantIncomingOrderAlertModal> createState() => _MerchantIncomingOrderAlertModalState();
}

class _MerchantIncomingOrderAlertModalState extends State<MerchantIncomingOrderAlertModal>
    with SingleTickerProviderStateMixin {
  late int _remainingSeconds;
  Timer? _timer;
  bool _isProcessing = false;
  late AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.timeoutSeconds;
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..repeat(reverse: true);

    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingSeconds <= 1) {
        timer.cancel();
        _handleTimeout();
      } else {
        setState(() => _remainingSeconds--);
      }
    });
  }

  void _handleTimeout() {
    if (!mounted || _isProcessing) return;
    widget.onReject('AUTO_REJECT_TIMEOUT');
    Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _acceptOrder() async {
    setState(() => _isProcessing = true);
    _timer?.cancel();
    try {
      await widget.onAccept();
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _rejectOrder(String reason) async {
    setState(() => _isProcessing = true);
    _timer?.cancel();
    try {
      await widget.onReject(reason);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final amountRupees = (widget.totalAmountPaise / 100).toStringAsFixed(2);

    return Scaffold(
      backgroundColor: const Color(0xFF1E1B4B),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FadeTransition(
                opacity: _animController,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDC2626),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.volume_up, color: Colors.white, size: 28),
                      SizedBox(width: 10),
                      Text(
                        'NEW INCOMING ORDER!',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Auto-rejecting in: $_remainingSeconds s',
                    style: TextStyle(
                      color: _remainingSeconds < 15 ? const Color(0xFFF87171) : Colors.amberAccent,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Order #${widget.orderNumber}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        Text('₹$amountRupees', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF15803D))),
                      ],
                    ),
                    const Divider(height: 20),
                    Text('Customer: ${widget.customerName}', style: const TextStyle(color: Colors.black87)),
                    const SizedBox(height: 8),
                    const Text('Items:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 4),
                    ...widget.itemSummaries.map((item) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Text('• $item', style: const TextStyle(fontSize: 13, color: Colors.black87)),
                    )),
                  ],
                ),
              ),
              const Spacer(),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isProcessing ? null : () => _rejectOrder('OUT_OF_STOCK'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white54, width: 1.5),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('REJECT', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isProcessing ? null : _acceptOrder,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _isProcessing
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('ACCEPT ORDER', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
