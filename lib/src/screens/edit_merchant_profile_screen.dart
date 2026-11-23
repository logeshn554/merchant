import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class EditMerchantProfileScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic>? profileData;
  const EditMerchantProfileScreen({super.key, this.profileData});

  @override
  ConsumerState<EditMerchantProfileScreen> createState() => _EditMerchantProfileScreenState();
}

class _EditMerchantProfileScreenState extends ConsumerState<EditMerchantProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _descController;
  late final TextEditingController _phoneController;
  late final TextEditingController _emailController;
  late String _selectedType;
  bool _isSaving = false;

  static const _merchantTypes = [
    'RESTAURANT',
    'CLOUD_KITCHEN',
    'GROCERY_STORE',
    'DARK_STORE',
    'HOME_SELLER',
  ];

  @override
  void initState() {
    super.initState();
    final m = widget.profileData?['merchant'] as Map<String, dynamic>?;
    _nameController = TextEditingController(text: m?['business_name']?.toString() ?? '');
    _descController = TextEditingController(text: m?['description']?.toString() ?? '');
    _phoneController = TextEditingController(
      text: m?['support_phone']?.toString() ?? m?['owner_phone']?.toString() ?? '',
    );
    _emailController = TextEditingController(
      text: m?['support_email']?.toString() ?? m?['owner_email']?.toString() ?? '',
    );
    _selectedType = (m?['merchant_type']?.toString() ?? 'RESTAURANT');
    if (!_merchantTypes.contains(_selectedType)) _selectedType = 'RESTAURANT';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);
    try {
      final client = ref.read(apiClientProvider);
      final m = widget.profileData?['merchant'] as Map<String, dynamic>?;
      final o = widget.profileData?['outlet'] as Map<String, dynamic>?;
      final user = ref.read(currentUserProvider);

      final phone = _phoneController.text.trim().isNotEmpty
          ? _phoneController.text.trim()
          : (user?.phoneNumber ?? '+919876543210');

      final payload = <String, dynamic>{
        'businessName': _nameController.text.trim(),
        'merchantType': _selectedType,
        'description': _descController.text.trim(),
        'supportEmail': _emailController.text.trim(),
        'panNumber': m?['pan_number'] ?? 'ABCDE1234F',
        'gstin': m?['gstin'],
        'fssaiLicenseNumber': m?['fssai_license_number'],
        'bankAccountNumber': m?['bank_account_number'] ?? '50100234567890',
        'bankIfsc': m?['bank_ifsc'] ?? 'HDFC0001234',
        'bankBeneficiaryName': m?['bank_beneficiary_name'] ?? _nameController.text.trim(),
        'outletName': o?['outlet_name'] ?? _nameController.text.trim(),
        'addressLine1': o?['address_line1'] ?? 'Main Street Commercial Road',
        'addressLine2': o?['address_line2'],
        'postalCode': o?['postal_code'] ?? '600040',
        'latitude': (o?['latitude'] as num?)?.toDouble() ?? 13.0850,
        'longitude': (o?['longitude'] as num?)?.toDouble() ?? 80.2101,
        'phone': phone,
        'defaultPrepTimeMinutes': (o?['default_prep_time_minutes'] as num?)?.toInt() ?? 15,
        'packagingFeeInr': (o?['packaging_fee_inr'] as num?)?.toDouble() ?? 10.0,
      };

      await client.registerMerchant(payload);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Business profile updated successfully!'),
          backgroundColor: AllGoColors.success,
        ),
      );
      Navigator.of(context).pop(true);
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Update failed: $err'), backgroundColor: AllGoColors.error),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.background,
      appBar: const AllGoAppBar(title: 'Edit Business Profile'),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text('Store & Business Details', style: AllGoTypography.heading3),
              const SizedBox(height: 6),
              Text(
                'Update your brand name, operating business category, and merchant customer care contacts.',
                style: AllGoTypography.caption,
              ),
              const SizedBox(height: 20),
              AllGoTextField(
                label: 'Business / Brand Name',
                hint: 'e.g., Anjappar Chettinad Restaurant',
                controller: _nameController,
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Brand name is required' : null,
              ),
              const SizedBox(height: 16),
              Text('Business Category', style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
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
                    value: _selectedType,
                    isExpanded: true,
                    items: _merchantTypes.map((type) {
                      return DropdownMenuItem(
                        value: type,
                        child: Text(type.replaceAll('_', ' '), style: AllGoTypography.bodyMedium),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedType = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),
              AllGoTextField(
                label: 'Store Description',
                hint: 'Brief summary of your menu, cuisine, or specialty products',
                controller: _descController,
                maxLines: 3,
              ),
              const SizedBox(height: 16),
              AllGoTextField(
                label: 'Support Phone Number',
                hint: '+919876543210',
                controller: _phoneController,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 16),
              AllGoTextField(
                label: 'Support Email Address',
                hint: 'help@merchantstore.com',
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 28),
              AllGoButton(
                label: _isSaving ? 'Saving Changes...' : 'Save Business Profile',
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
