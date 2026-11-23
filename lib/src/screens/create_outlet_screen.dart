import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class CreateOutletScreen extends ConsumerStatefulWidget {
  const CreateOutletScreen({super.key});

  @override
  ConsumerState<CreateOutletScreen> createState() => _CreateOutletScreenState();
}

class _CreateOutletScreenState extends ConsumerState<CreateOutletScreen> {
  final _formKey = GlobalKey<FormState>();

  final _outletNameController = TextEditingController();
  final _addressLine1Controller = TextEditingController();
  final _addressLine2Controller = TextEditingController();
  final _postalCodeController = TextEditingController();
  final _phoneController = TextEditingController();
  final _prepTimeController = TextEditingController(text: '15');
  final _packagingFeeController = TextEditingController(text: '10.0');

  double _latitude = 13.0827;
  double _longitude = 80.2707;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _outletNameController.dispose();
    _addressLine1Controller.dispose();
    _addressLine2Controller.dispose();
    _postalCodeController.dispose();
    _phoneController.dispose();
    _prepTimeController.dispose();
    _packagingFeeController.dispose();
    super.dispose();
  }

  Future<void> _handleCreateOutlet() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final client = ref.read(apiClientProvider);
      final payload = {
        'outletName': _outletNameController.text.trim(),
        'addressLine1': _addressLine1Controller.text.trim(),
        'addressLine2': _addressLine2Controller.text.trim().isNotEmpty ? _addressLine2Controller.text.trim() : null,
        'postalCode': _postalCodeController.text.trim(),
        'phone': _phoneController.text.trim(),
        'latitude': _latitude,
        'longitude': _longitude,
        'defaultPrepTimeMinutes': int.tryParse(_prepTimeController.text.trim()) ?? 15,
        'packagingFeeInr': double.tryParse(_packagingFeeController.text.trim()) ?? 10.0,
      };

      await client.createMerchantOutlet(payload);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Branch outlet submitted! It is in PENDING_APPROVAL status until admin verification.'),
            backgroundColor: AllGoColors.success,
          ),
        );
        Navigator.of(context).pop(true); // Return success to reload outlets
      }
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = e.toString());
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.background,
      appBar: const AllGoAppBar(title: 'Add New Outlet Branch'),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Info Banner
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF6200EA).withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF6200EA).withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, color: Color(0xFF6200EA), size: 24),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'New branch outlets start in PENDING_APPROVAL and remain closed until approved by platform compliance.',
                          style: AllGoTypography.caption.copyWith(color: AllGoColors.textPrimary),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AllGoColors.error.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AllGoColors.error),
                    ),
                    child: Text(_errorMessage!, style: const TextStyle(color: AllGoColors.error)),
                  ),
                  const SizedBox(height: 16),
                ],

                // Outlet Details
                Text('Branch Information', style: AllGoTypography.heading3),
                const SizedBox(height: 12),
                AllGoTextField(
                  label: 'Outlet / Branch Name',
                  hint: 'e.g. Velachery Main Branch',
                  controller: _outletNameController,
                  validator: (v) => v == null || v.trim().isEmpty ? 'Outlet name is required' : null,
                ),
                const SizedBox(height: 14),
                AllGoTextField(
                  label: 'Branch Contact Phone',
                  hint: '+919876543210',
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  validator: (v) => v == null || v.trim().length < 10 ? 'Valid phone number is required' : null,
                ),
                const SizedBox(height: 14),

                Text('Location & Address', style: AllGoTypography.heading3),
                const SizedBox(height: 12),
                AllGoTextField(
                  label: 'Address Line 1',
                  hint: 'Door / Plot No, Street name',
                  controller: _addressLine1Controller,
                  validator: (v) => v == null || v.trim().isEmpty ? 'Address is required' : null,
                ),
                const SizedBox(height: 14),
                AllGoTextField(
                  label: 'Address Line 2 (Optional)',
                  hint: 'Landmark / Area',
                  controller: _addressLine2Controller,
                ),
                const SizedBox(height: 14),
                AllGoTextField(
                  label: 'Postal Code (PIN)',
                  hint: '600042',
                  controller: _postalCodeController,
                  keyboardType: TextInputType.number,
                  validator: (v) => v == null || v.trim().length != 6 ? '6-digit PIN code required' : null,
                ),
                const SizedBox(height: 14),

                Text('Kitchen Operations', style: AllGoTypography.heading3),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: AllGoTextField(
                        label: 'Default Prep (mins)',
                        controller: _prepTimeController,
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: AllGoTextField(
                        label: 'Packaging Fee (INR)',
                        controller: _packagingFeeController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 28),

                AllGoButton(
                  label: 'Submit Branch for Approval',
                  isLoading: _isSubmitting,
                  onPressed: _handleCreateOutlet,
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
