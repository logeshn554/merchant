import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantStepCompliance extends StatelessWidget {
  final TextEditingController panController;
  final TextEditingController fssaiController;
  final TextEditingController gstinController;

  const MerchantStepCompliance({
    super.key,
    required this.panController,
    required this.fssaiController,
    required this.gstinController,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Step 4: Compliance & Regulatory', style: AllGoTypography.heading2),
        const SizedBox(height: 6),
        Text('Government registrations required by Indian commercial law.', style: AllGoTypography.subtitle),
        const SizedBox(height: 24),
        AllGoTextField(
          label: 'Business / Proprietor PAN',
          hint: 'AAAAA9999A',
          controller: panController,
        ),
        const SizedBox(height: 16),
        AllGoTextField(
          label: 'FSSAI License Number (14 Digits)',
          hint: '12423001000123',
          controller: fssaiController,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 16),
        AllGoTextField(
          label: 'GSTIN (Optional for small merchants)',
          hint: '33AAAAA9999A1Z5',
          controller: gstinController,
        ),
      ],
    );
  }
}

class MerchantStepBank extends StatelessWidget {
  final TextEditingController bankAccountController;
  final TextEditingController bankIfscController;
  final TextEditingController bankBeneficiaryController;

  const MerchantStepBank({
    super.key,
    required this.bankAccountController,
    required this.bankIfscController,
    required this.bankBeneficiaryController,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Step 5: Bank Settlements', style: AllGoTypography.heading2),
        const SizedBox(height: 6),
        Text('Bank account for automated daily/weekly payout transfers.', style: AllGoTypography.subtitle),
        const SizedBox(height: 24),
        AllGoTextField(
          label: 'Bank Account Number',
          hint: '918020012345678',
          controller: bankAccountController,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 16),
        AllGoTextField(
          label: 'Bank IFSC Code',
          hint: 'HDFC0001234',
          controller: bankIfscController,
        ),
        const SizedBox(height: 16),
        AllGoTextField(
          label: 'Beneficiary Name (as per passbook)',
          hint: 'Anjappar Chettinad Restaurants Pvt Ltd',
          controller: bankBeneficiaryController,
        ),
      ],
    );
  }
}

class MerchantStepOperations extends StatelessWidget {
  final int defaultPrepMinutes;
  final double packagingFeeInr;
  final ValueChanged<int> onPrepChanged;
  final ValueChanged<double> onFeeChanged;

  const MerchantStepOperations({
    super.key,
    required this.defaultPrepMinutes,
    required this.packagingFeeInr,
    required this.onPrepChanged,
    required this.onFeeChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Step 6: Store Operations', style: AllGoTypography.heading2),
        const SizedBox(height: 6),
        Text('Default kitchen preparation time and customer packaging fee.', style: AllGoTypography.subtitle),
        const SizedBox(height: 24),
        Text('Kitchen Preparation Time: $defaultPrepMinutes mins', style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.bold)),
        Slider(
          value: defaultPrepMinutes.toDouble(),
          min: 5,
          max: 60,
          divisions: 11,
          activeColor: const Color(0xFF6200EA),
          label: '$defaultPrepMinutes mins',
          onChanged: (val) => onPrepChanged(val.toInt()),
        ),
        const SizedBox(height: 24),
        Text('Per-Order Packaging Fee (₹)', style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.bold)),
        Slider(
          value: packagingFeeInr,
          min: 0,
          max: 50,
          divisions: 10,
          activeColor: const Color(0xFF6200EA),
          label: '₹${packagingFeeInr.toInt()}',
          onChanged: onFeeChanged,
        ),
      ],
    );
  }
}
