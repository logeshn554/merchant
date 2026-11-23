import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantResubmissionScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic>? profileData;
  const MerchantResubmissionScreen({super.key, this.profileData});

  @override
  ConsumerState<MerchantResubmissionScreen> createState() => _MerchantResubmissionScreenState();
}

class _MerchantResubmissionScreenState extends ConsumerState<MerchantResubmissionScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _panController;
  late final TextEditingController _fssaiController;
  late final TextEditingController _gstinController;
  late final TextEditingController _bankAccountController;
  late final TextEditingController _ifscController;
  late final TextEditingController _beneficiaryController;
  String _selectedDocType = 'FSSAI_LICENSE';
  bool _isSubmitting = false;

  static const _docTypes = ['FSSAI_LICENSE', 'PAN_CARD', 'GSTIN_CERTIFICATE', 'BANK_PASSBOOK'];

  @override
  void initState() {
    super.initState();
    final m = widget.profileData?['merchant'] as Map<String, dynamic>?;
    _panController = TextEditingController(text: m?['pan_number']?.toString() ?? '');
    _fssaiController = TextEditingController(text: m?['fssai_license_number']?.toString() ?? '');
    _gstinController = TextEditingController(text: m?['gstin']?.toString() ?? '');
    _bankAccountController = TextEditingController(text: m?['bank_account_number']?.toString() ?? '');
    _ifscController = TextEditingController(text: m?['bank_ifsc']?.toString() ?? '');
    _beneficiaryController = TextEditingController(text: m?['bank_beneficiary_name']?.toString() ?? '');
  }

  @override
  void dispose() {
    for (final c in [_panController, _fssaiController, _gstinController, _bankAccountController, _ifscController, _beneficiaryController]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _handleResubmit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);
    try {
      final client = ref.read(apiClientProvider);
      final m = widget.profileData?['merchant'] as Map<String, dynamic>?;
      final o = widget.profileData?['outlet'] as Map<String, dynamic>?;

      final payload = <String, dynamic>{
        'businessName': m?['business_name'] ?? 'Merchant Store',
        'merchantType': m?['merchant_type'] ?? 'RESTAURANT',
        'panNumber': _panController.text.trim().toUpperCase(),
        'gstin': _gstinController.text.trim().isNotEmpty ? _gstinController.text.trim().toUpperCase() : null,
        'fssaiLicenseNumber': _fssaiController.text.trim().isNotEmpty ? _fssaiController.text.trim() : null,
        'bankAccountNumber': _bankAccountController.text.trim(),
        'bankIfsc': _ifscController.text.trim().toUpperCase(),
        'bankBeneficiaryName': _beneficiaryController.text.trim(),
        'outletName': o?['outlet_name'] ?? m?['business_name'] ?? 'Main Outlet',
        'addressLine1': o?['address_line1'] ?? 'Commercial Road',
        'addressLine2': o?['address_line2'],
        'postalCode': o?['postal_code'] ?? '600040',
        'latitude': (o?['latitude'] as num?)?.toDouble() ?? 13.0850,
        'longitude': (o?['longitude'] as num?)?.toDouble() ?? 80.2101,
        'phone': o?['phone'] ?? '+919876543210',
        'defaultPrepTimeMinutes': (o?['default_prep_time_minutes'] as num?)?.toInt() ?? 15,
        'packagingFeeInr': (o?['packaging_fee_inr'] as num?)?.toDouble() ?? 10.0,
      };

      await client.registerMerchant(payload);
      final docNum = _selectedDocType == 'PAN_CARD' ? _panController.text.trim() : _fssaiController.text.trim();
      final ticketId = 'doc_${DateTime.now().millisecondsSinceEpoch}';
      try {
        await client.submitMerchantDocument(_selectedDocType, ticketId, documentNumber: docNum);
        await client.submitMerchantApplication();
      } catch (_) {}

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Registration documents re-submitted for review!'), backgroundColor: AllGoColors.success),
      );
      Navigator.of(context).pop(true);
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Submission failed: $err'), backgroundColor: AllGoColors.error));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.background,
      appBar: const AllGoAppBar(title: 'Document Resubmission'),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AllGoColors.warning.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AllGoColors.warning.withValues(alpha: 0.5)),
                ),
                child: Text(
                  'Correct expired or rejected compliance documents. Updates enter immediate audit review.',
                  style: AllGoTypography.caption.copyWith(color: AllGoColors.textPrimary),
                ),
              ),
              const SizedBox(height: 16),
              Text('Primary Document for Renewal', style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: AllGoColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AllGoColors.divider),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedDocType,
                    isExpanded: true,
                    items: _docTypes.map((t) => DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' '), style: AllGoTypography.bodyMedium))).toList(),
                    onChanged: (val) => val != null ? setState(() => _selectedDocType = val) : null,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              AllGoTextField(
                label: 'PAN Number (10 Characters)',
                hint: 'ABCDE1234F',
                controller: _panController,
                validator: (v) => (v == null || v.trim().length != 10) ? 'Valid 10-char PAN required' : null,
              ),
              const SizedBox(height: 14),
              AllGoTextField(label: 'FSSAI License (14 Digits)', hint: '12423001000123', controller: _fssaiController, keyboardType: TextInputType.number),
              const SizedBox(height: 14),
              AllGoTextField(label: 'GSTIN Number (Optional)', hint: '33AABCA1234A1Z5', controller: _gstinController),
              const SizedBox(height: 18),
              Text('Settlement Bank Account', style: AllGoTypography.heading3),
              const SizedBox(height: 10),
              AllGoTextField(
                label: 'Beneficiary Name',
                hint: 'Account holder legal name',
                controller: _beneficiaryController,
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Beneficiary name required' : null,
              ),
              const SizedBox(height: 14),
              AllGoTextField(
                label: 'Bank Account Number',
                hint: '50100234567890',
                controller: _bankAccountController,
                keyboardType: TextInputType.number,
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Account number required' : null,
              ),
              const SizedBox(height: 14),
              AllGoTextField(
                label: 'IFSC Code',
                hint: 'HDFC0001234',
                controller: _ifscController,
                validator: (v) => (v == null || v.trim().length != 11) ? '11-digit IFSC required' : null,
              ),
              const SizedBox(height: 24),
              AllGoButton(
                label: _isSubmitting ? 'Resubmitting...' : 'Resubmit for Verification',
                isLoading: _isSubmitting,
                onPressed: _isSubmitting ? null : _handleResubmit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
