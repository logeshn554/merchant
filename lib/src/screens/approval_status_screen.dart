import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';
import 'phone_login_screen.dart';
import 'merchant_dashboard_shell.dart';
import 'merchant_resubmission_screen.dart';

class ApprovalStatusScreen extends ConsumerStatefulWidget {
  final String status;
  const ApprovalStatusScreen({super.key, this.status = 'SUBMITTED'});

  @override
  ConsumerState<ApprovalStatusScreen> createState() => _ApprovalStatusScreenState();
}

class _ApprovalStatusScreenState extends ConsumerState<ApprovalStatusScreen> {
  late String _currentStatus;
  bool _isChecking = false;

  @override
  void initState() {
    super.initState();
    _currentStatus = widget.status;
    _refreshStatus();
  }

  Future<void> _refreshStatus() async {
    setState(() => _isChecking = true);
    try {
      final client = ref.read(apiClientProvider);
      final profile = await client.getMerchantProfile();
      if (mounted) setState(() => _currentStatus = profile['status'] ?? _currentStatus);
    } catch (_) {}
    if (mounted) setState(() => _isChecking = false);
  }

  Future<void> _handleLogout() async {
    await ref.read(authNotifierProvider.notifier).logout();
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const PhoneLoginScreen()), (route) => false);
    }
  }

  Future<void> _openResubmission() async {
    final updated = await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const MerchantResubmissionScreen()));
    if (updated == true) _refreshStatus();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.background,
      appBar: AllGoAppBar(
        title: 'Application Status',
        showBackButton: false,
        actions: [
          IconButton(icon: const Icon(Icons.refresh, size: 22), onPressed: _isChecking ? null : _refreshStatus),
          IconButton(icon: const Icon(Icons.logout, size: 20), onPressed: _handleLogout),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              _buildStatusCard(),
              const SizedBox(height: 16),
              _buildLockWarning(),
              const SizedBox(height: 24),
              Text('Compliance & Verification Steps', style: AllGoTypography.heading3),
              const SizedBox(height: 14),
              _buildStepTile(
                '1. FSSAI Food License & GSTIN Compliance',
                'Government registration and tax verification',
                ['APPROVED', 'UNDER_REVIEW', 'SUBMITTED'].contains(_currentStatus),
              ),
              _buildStepTile(
                '2. Bank Penny-Drop Verification',
                'Automated settlement account validation',
                _currentStatus == 'APPROVED',
              ),
              _buildStepTile(
                '3. Operational Menu Inspection',
                'Catalog review and pricing verification',
                _currentStatus == 'APPROVED',
              ),
              const Spacer(),
              _buildActionButton(),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusCard() {
    Color cardColor;
    Color iconColor;
    IconData icon;
    String title;
    String subtitle;

    switch (_currentStatus) {
      case 'APPROVED':
      case 'LIVE':
        cardColor = AllGoColors.success.withValues(alpha: 0.12);
        iconColor = AllGoColors.success;
        icon = Icons.check_circle_outline;
        title = 'Store Approved & Operational';
        subtitle = 'Your outlet is verified and ready to accept live customer orders.';
        break;
      case 'DOCUMENTS_REQUIRED':
        cardColor = AllGoColors.warning.withValues(alpha: 0.12);
        iconColor = AllGoColors.warning;
        icon = Icons.assignment_late_outlined;
        title = 'Additional Compliance Required';
        subtitle = 'Please re-submit your FSSAI or PAN documentation for verification.';
        break;
      case 'REJECTED':
        cardColor = AllGoColors.error.withValues(alpha: 0.12);
        iconColor = AllGoColors.error;
        icon = Icons.cancel_outlined;
        title = 'Application Rejected';
        subtitle = 'Compliance criteria not met. Update your store details to re-apply.';
        break;
      case 'SUSPENDED':
        cardColor = AllGoColors.error.withValues(alpha: 0.12);
        iconColor = AllGoColors.error;
        icon = Icons.block;
        title = 'Account Suspended';
        subtitle = 'Your merchant outlet is temporarily paused by platform administration.';
        break;
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
      default:
        cardColor = const Color(0xFF6200EA).withValues(alpha: 0.12);
        iconColor = const Color(0xFF6200EA);
        icon = Icons.pending_actions_outlined;
        title = 'Outlet Pending Verification';
        subtitle = 'Our onboarding team is reviewing your FSSAI and bank documents (est. 24-48 hrs).';
        break;
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: iconColor.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Icon(icon, color: iconColor, size: 36),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AllGoTypography.heading3.copyWith(fontSize: 16, color: iconColor)),
                const SizedBox(height: 4),
                Text(subtitle, style: AllGoTypography.caption.copyWith(color: AllGoColors.textPrimary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLockWarning() {
    final isApproved = _currentStatus == 'APPROVED' || _currentStatus == 'LIVE';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AllGoColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AllGoColors.divider),
      ),
      child: Row(
        children: [
          Icon(isApproved ? Icons.store_outlined : Icons.lock_outline, color: isApproved ? AllGoColors.success : AllGoColors.textSecondary, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              isApproved
                  ? 'Store Online: You can now toggle your kitchen open and manage live order flow.'
                  : 'Orders Disabled: Outlets cannot accept live customer orders until administrative approval is complete.',
              style: AllGoTypography.caption.copyWith(fontWeight: FontWeight.w600, color: AllGoColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepTile(String title, String subtitle, bool isCompleted) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        children: [
          Icon(isCompleted ? Icons.check_circle : Icons.radio_button_unchecked, color: isCompleted ? AllGoColors.success : AllGoColors.textTertiary, size: 22),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
                Text(subtitle, style: AllGoTypography.caption),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton() {
    if (_currentStatus == 'APPROVED' || _currentStatus == 'LIVE') {
      return AllGoButton(
        label: 'Enter Store Dashboard',
        onPressed: () => Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const MerchantDashboardShell())),
      );
    }
    return Column(
      children: [
        AllGoButton(
          label: 'Correct & Re-Submit Documents',
          icon: Icons.upload_file_outlined,
          onPressed: _openResubmission,
        ),
        const SizedBox(height: 10),
        OutlinedButton(
          onPressed: _isChecking ? null : _refreshStatus,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            side: const BorderSide(color: Color(0xFF6200EA)),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: Text(_isChecking ? 'Checking status...' : 'Check Approval Status', style: const TextStyle(color: Color(0xFF6200EA), fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }
}
