import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantStepReview extends StatelessWidget {
  final String businessName;
  final String merchantType;
  final String address;
  final String pin;
  final String pan;
  final String fssai;
  final String beneficiary;
  final String bankAccount;
  final String ifsc;

  const MerchantStepReview({
    super.key,
    required this.businessName,
    required this.merchantType,
    required this.address,
    required this.pin,
    required this.pan,
    required this.fssai,
    required this.beneficiary,
    required this.bankAccount,
    required this.ifsc,
  });

  Widget _buildCard(String title, String main, String sub) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AllGoColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AllGoColors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AllGoTypography.caption.copyWith(fontWeight: FontWeight.bold, color: const Color(0xFF6200EA))),
          const SizedBox(height: 4),
          Text(main.isEmpty ? 'Not Provided' : main, style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(sub, style: AllGoTypography.caption),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Step 7: Review & Final Submission', style: AllGoTypography.heading2),
        const SizedBox(height: 6),
        Text('Please verify all details before submitting for platform approval.', style: AllGoTypography.subtitle),
        const SizedBox(height: 24),
        _buildCard('Business', businessName, 'Category: $merchantType'),
        const SizedBox(height: 12),
        _buildCard('Location', address, 'PIN: $pin'),
        const SizedBox(height: 12),
        _buildCard('PAN & FSSAI', 'PAN: ${pan.toUpperCase()}', 'FSSAI: $fssai'),
        const SizedBox(height: 12),
        _buildCard('Settlement Bank', beneficiary, 'A/C: ••••${bankAccount.length > 4 ? bankAccount.substring(bankAccount.length - 4) : bankAccount} | IFSC: ${ifsc.toUpperCase()}'),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF6200EA).withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              const Icon(Icons.verified_user, color: Color(0xFF6200EA), size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'By submitting, you agree to the AllGo Merchant Terms and standard 15% platform commission.',
                  style: AllGoTypography.caption.copyWith(color: AllGoColors.textPrimary),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
