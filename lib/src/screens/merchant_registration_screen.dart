import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';
import 'approval_status_screen.dart';
import '../components/merchant_onboarding_steps_a.dart';
import '../components/merchant_onboarding_steps_b.dart';
import '../components/merchant_registration_bottom_bar.dart';
import '../components/merchant_registration_review.dart';

class MerchantRegistrationScreen extends ConsumerStatefulWidget {
  const MerchantRegistrationScreen({super.key});

  @override
  ConsumerState<MerchantRegistrationScreen> createState() => _MerchantRegistrationScreenState();
}

class _MerchantRegistrationScreenState extends ConsumerState<MerchantRegistrationScreen> {
  int _currentStep = 0;
  bool _isSubmitting = false;

  // Step 1: Owner Details
  final _ownerNameController = TextEditingController();
  final _ownerEmailController = TextEditingController();

  // Step 2: Business Details
  final _businessNameController = TextEditingController();
  String _selectedMerchantType = 'RESTAURANT';
  final _descriptionController = TextEditingController();

  // Step 3: Location
  final _outletNameController = TextEditingController();
  final _cityController = TextEditingController();
  final _addressLine1Controller = TextEditingController();
  final _addressLine2Controller = TextEditingController();
  final _postalCodeController = TextEditingController();
  double _latitude = 13.0850;
  double _longitude = 80.2101;

  // Step 4: Documents
  final _panController = TextEditingController();
  final _fssaiController = TextEditingController();
  final _gstinController = TextEditingController();

  // Step 5: Bank Details
  final _bankBeneficiaryController = TextEditingController();
  final _bankAccountController = TextEditingController();
  final _ifscController = TextEditingController();

  // Step 6: Store Configuration
  int _defaultPrepMinutes = 15;
  double _packagingFeeInr = 10.0;

  @override
  void initState() {
    super.initState();
    _loadExistingProfileIfAny();
  }

  Future<void> _loadExistingProfileIfAny() async {
    try {
      final client = ref.read(apiClientProvider);
      final profileData = await client.getMerchantProfile();
      if (profileData['merchant'] != null) {
        final m = profileData['merchant'];
        final o = profileData['outlet'];
        setState(() {
          _businessNameController.text = m['business_name'] ?? '';
          _selectedMerchantType = m['merchant_type'] ?? 'RESTAURANT';
          _panController.text = m['pan_number'] ?? '';
          _fssaiController.text = m['fssai_license_number'] ?? '';
          _gstinController.text = m['gstin'] ?? '';
          _bankBeneficiaryController.text = m['bank_beneficiary_name'] ?? '';
          _bankAccountController.text = m['bank_account_number'] ?? '';
          _ifscController.text = m['bank_ifsc'] ?? '';
          if (o != null) {
            _addressLine1Controller.text = o['address_line1'] ?? '';
            _addressLine2Controller.text = o['address_line2'] ?? '';
            _postalCodeController.text = o['postal_code'] ?? '';
            _defaultPrepMinutes = (o['default_prep_time_minutes'] as num?)?.toInt() ?? 15;
            _packagingFeeInr = (o['packaging_fee_inr'] as num?)?.toDouble() ?? 10.0;
          }
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _ownerNameController.dispose();
    _ownerEmailController.dispose();
    _businessNameController.dispose();
    _descriptionController.dispose();
    _outletNameController.dispose();
    _cityController.dispose();
    _addressLine1Controller.dispose();
    _addressLine2Controller.dispose();
    _postalCodeController.dispose();
    _panController.dispose();
    _fssaiController.dispose();
    _gstinController.dispose();
    _bankBeneficiaryController.dispose();
    _bankAccountController.dispose();
    _ifscController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (_businessNameController.text.trim().isEmpty) {
      _showError('Please enter business name');
      setState(() => _currentStep = 1);
      return;
    }
    if (_panController.text.trim().length != 10) {
      _showError('Valid 10-character PAN number is mandatory');
      setState(() => _currentStep = 3);
      return;
    }
    if (_bankAccountController.text.trim().isEmpty || _ifscController.text.trim().isEmpty) {
      _showError('Bank account and IFSC code are required for settlements');
      setState(() => _currentStep = 4);
      return;
    }

    setState(() => _isSubmitting = true);
    final client = ref.read(apiClientProvider);

    try {
      final user = ref.read(currentUserProvider);
      final phone = user?.phoneNumber ?? '+919876543210';

      final payload = {
        'businessName': _businessNameController.text.trim(),
        'merchantType': _selectedMerchantType,
        'panNumber': _panController.text.trim().toUpperCase(),
        'gstin': _gstinController.text.trim().isNotEmpty ? _gstinController.text.trim().toUpperCase() : null,
        'fssaiLicenseNumber': _fssaiController.text.trim().isNotEmpty ? _fssaiController.text.trim() : null,
        'bankAccountNumber': _bankAccountController.text.trim(),
        'bankIfsc': _ifscController.text.trim().toUpperCase(),
        'bankBeneficiaryName': _bankBeneficiaryController.text.trim().isNotEmpty
            ? _bankBeneficiaryController.text.trim()
            : _businessNameController.text.trim(),
        'outletName': _outletNameController.text.trim().isNotEmpty
            ? _outletNameController.text.trim()
            : _businessNameController.text.trim(),
        'city': _cityController.text.trim().isNotEmpty ? _cityController.text.trim() : 'Chennai',
        'addressLine1': _addressLine1Controller.text.trim().isNotEmpty ? _addressLine1Controller.text.trim() : 'Commercial Road',
        'addressLine2': _addressLine2Controller.text.trim().isNotEmpty ? _addressLine2Controller.text.trim() : null,
        'postalCode': _postalCodeController.text.trim().isNotEmpty ? _postalCodeController.text.trim() : '600040',
        'latitude': _latitude,
        'longitude': _longitude,
        'phone': phone,
        'defaultPrepTimeMinutes': _defaultPrepMinutes,
        'packagingFeeInr': _packagingFeeInr,
      };

      await client.registerMerchant(payload);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Application submitted successfully! Operational verification in progress.'),
          backgroundColor: AllGoColors.success,
        ),
      );

      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => const ApprovalStatusScreen(status: 'SUBMITTED'),
        ),
      );
    } catch (err) {
      if (!mounted) return;
      _showError(err.toString());
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AllGoColors.error),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.background,
      appBar: const AllGoAppBar(title: 'Merchant Registration'),
      body: SafeArea(
        child: Column(
          children: [
            // Step Progress Indicator
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              color: AllGoColors.surface,
              child: Row(
                children: List.generate(7, (index) {
                  final isDone = index < _currentStep;
                  final isCurrent = index == _currentStep;
                  return Expanded(
                    child: Container(
                      height: 4,
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      decoration: BoxDecoration(
                        color: isDone || isCurrent ? const Color(0xFF6200EA) : AllGoColors.divider,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  );
                }),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: _buildCurrentStepContent(),
              ),
            ),
            MerchantRegistrationBottomBar(
              currentStep: _currentStep,
              isSubmitting: _isSubmitting,
              onBack: () => setState(() => _currentStep--),
              onContinue: () {
                if (_currentStep == 6) {
                  _handleSubmit();
                } else {
                  setState(() => _currentStep++);
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  // Statutory Compliance & Regulatory Checklist:
  // Step 1: Owner Details
  // Step 2: Business Information
  // Step 3: Outlet Location
  // Step 4: Compliance & Regulatory: Business / Proprietor PAN, FSSAI License, GSTIN
  // Step 5: Bank Settlements: Bank IFSC Code, Bank Account Number, Beneficiary Name
  // Step 6: Store Operations
  // Step 7: Review & Final Submission

  Widget _buildCurrentStepContent() {
    switch (_currentStep) {
      case 0:
        return MerchantStepOwner(
          ownerNameController: _ownerNameController,
          ownerEmailController: _ownerEmailController,
          phoneNumber: ref.read(currentUserProvider)?.phoneNumber,
        );
      case 1:
        return MerchantStepBusiness(
          businessNameController: _businessNameController,
          descriptionController: _descriptionController,
          selectedMerchantType: _selectedMerchantType,
          onTypeChanged: (val) => setState(() => _selectedMerchantType = val),
        );
      case 2:
        return MerchantStepLocation(
          outletNameController: _outletNameController,
          address1Controller: _addressLine1Controller,
          address2Controller: _addressLine2Controller,
          postalCodeController: _postalCodeController,
          cityController: _cityController,
        );
      case 3:
        return MerchantStepCompliance(
          panController: _panController,
          fssaiController: _fssaiController,
          gstinController: _gstinController,
        );
      case 4:
        return MerchantStepBank(
          bankAccountController: _bankAccountController,
          bankIfscController: _ifscController,
          bankBeneficiaryController: _bankBeneficiaryController,
        );
      case 5:
        return MerchantStepOperations(
          defaultPrepMinutes: _defaultPrepMinutes,
          packagingFeeInr: _packagingFeeInr,
          onPrepChanged: (val) => setState(() => _defaultPrepMinutes = val),
          onFeeChanged: (val) => setState(() => _packagingFeeInr = val),
        );
      case 6:
        return MerchantStepReview(
          businessName: _businessNameController.text,
          merchantType: _selectedMerchantType,
          address: _addressLine1Controller.text,
          pin: _postalCodeController.text,
          pan: _panController.text,
          fssai: _fssaiController.text,
          beneficiary: _bankBeneficiaryController.text,
          bankAccount: _bankAccountController.text,
          ifsc: _ifscController.text,
        );
      default:
        return const SizedBox();
    }
  }

}
