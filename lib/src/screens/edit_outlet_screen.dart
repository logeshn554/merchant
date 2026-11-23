import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class EditOutletScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic>? profileData;
  const EditOutletScreen({super.key, this.profileData});

  @override
  ConsumerState<EditOutletScreen> createState() => _EditOutletScreenState();
}

class _EditOutletScreenState extends ConsumerState<EditOutletScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _address1Controller;
  late final TextEditingController _address2Controller;
  late final TextEditingController _postalCodeController;
  late final TextEditingController _phoneController;
  late final TextEditingController _pkgFeeController;
  late int _prepMinutes;
  bool _isSaving = false;

  static const _prepOptions = [5, 10, 15, 20, 25, 30, 45, 60];

  @override
  void initState() {
    super.initState();
    final o = widget.profileData?['outlet'] as Map<String, dynamic>?;
    final m = widget.profileData?['merchant'] as Map<String, dynamic>?;

    _nameController = TextEditingController(text: o?['outlet_name']?.toString() ?? m?['business_name']?.toString() ?? '');
    _address1Controller = TextEditingController(text: o?['address_line1']?.toString() ?? '');
    _address2Controller = TextEditingController(text: o?['address_line2']?.toString() ?? '');
    _postalCodeController = TextEditingController(text: o?['postal_code']?.toString() ?? '');
    _phoneController = TextEditingController(text: o?['phone']?.toString() ?? m?['owner_phone']?.toString() ?? '');
    _pkgFeeController = TextEditingController(text: ((o?['packaging_fee_inr'] as num?)?.toStringAsFixed(2)) ?? '10.00');
    final prep = (o?['default_prep_time_minutes'] as num?)?.toInt() ?? 15;
    _prepMinutes = _prepOptions.contains(prep) ? prep : 15;
  }

  @override
  void dispose() {
    for (final c in [_nameController, _address1Controller, _address2Controller, _postalCodeController, _phoneController, _pkgFeeController]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);
    try {
      final client = ref.read(apiClientProvider);
      final m = widget.profileData?['merchant'] as Map<String, dynamic>?;
      final o = widget.profileData?['outlet'] as Map<String, dynamic>?;

      final payload = <String, dynamic>{
        'businessName': m?['business_name'] ?? _nameController.text.trim(),
        'merchantType': m?['merchant_type'] ?? 'RESTAURANT',
        'panNumber': m?['pan_number'] ?? 'ABCDE1234F',
        'gstin': m?['gstin'],
        'fssaiLicenseNumber': m?['fssai_license_number'],
        'bankAccountNumber': m?['bank_account_number'] ?? '50100234567890',
        'bankIfsc': m?['bank_ifsc'] ?? 'HDFC0001234',
        'bankBeneficiaryName': m?['bank_beneficiary_name'] ?? _nameController.text.trim(),
        'outletName': _nameController.text.trim(),
        'addressLine1': _address1Controller.text.trim(),
        'addressLine2': _address2Controller.text.trim().isNotEmpty ? _address2Controller.text.trim() : null,
        'postalCode': _postalCodeController.text.trim(),
        'latitude': (o?['latitude'] as num?)?.toDouble() ?? 13.0850,
        'longitude': (o?['longitude'] as num?)?.toDouble() ?? 80.2101,
        'phone': _phoneController.text.trim(),
        'defaultPrepTimeMinutes': _prepMinutes,
        'packagingFeeInr': double.tryParse(_pkgFeeController.text.trim()) ?? 10.00,
      };

      await client.registerMerchant(payload);
      if (o?['id'] != null) {
        try {
          await client.updateOutletStatus(o!['id'].toString(), o['is_open'] == true, defaultPrepTimeMinutes: _prepMinutes);
        } catch (_) {}
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Outlet details and prep buffer updated!'), backgroundColor: AllGoColors.success),
      );
      Navigator.of(context).pop(true);
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Update failed: $err'), backgroundColor: AllGoColors.error));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.background,
      appBar: const AllGoAppBar(title: 'Edit Outlet & Operations'),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text('Outlet Location & Operations', style: AllGoTypography.heading3),
              const SizedBox(height: 6),
              Text('Configure branch address, dispatch buffer, and kitchen pickup contact.', style: AllGoTypography.caption),
              const SizedBox(height: 20),
              AllGoTextField(
                label: 'Outlet Name / Branch Title',
                hint: 'e.g., Anna Nagar Outlet',
                controller: _nameController,
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Outlet name is required' : null,
              ),
              const SizedBox(height: 16),
              AllGoTextField(
                label: 'Address Line 1 (Street / Landmark)',
                hint: 'No. 12, 2nd Avenue',
                controller: _address1Controller,
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Street address is required' : null,
              ),
              const SizedBox(height: 16),
              AllGoTextField(
                label: 'Address Line 2 (Area / Locality)',
                hint: 'Near Roundtana (Optional)',
                controller: _address2Controller,
              ),
              const SizedBox(height: 16),
              AllGoTextField(
                label: '6-digit Postal PIN Code',
                hint: '600040',
                controller: _postalCodeController,
                keyboardType: TextInputType.number,
                validator: (v) {
                  if (v == null || v.trim().length != 6 || int.tryParse(v.trim()) == null) {
                    return 'Enter valid 6-digit PIN code';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              AllGoTextField(
                label: 'Outlet Order Hotline (+91...)',
                hint: '+919876543210',
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Contact phone is required' : null,
              ),
              const SizedBox(height: 16),
              Text('Default Kitchen Prep Time', style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: AllGoColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AllGoColors.divider),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<int>(
                    value: _prepMinutes,
                    isExpanded: true,
                    items: _prepOptions.map((mins) {
                      return DropdownMenuItem(value: mins, child: Text('$mins minutes buffer', style: AllGoTypography.bodyMedium));
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _prepMinutes = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),
              AllGoTextField(
                label: 'Packaging Fee (INR)',
                hint: '10.00',
                controller: _pkgFeeController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 28),
              AllGoButton(
                label: _isSaving ? 'Saving Changes...' : 'Save Outlet Details',
                isLoading: _isSaving,
                onPressed: _isSaving ? null : _handleSave,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
