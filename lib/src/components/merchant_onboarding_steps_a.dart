import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantStepOwner extends StatelessWidget {
  final TextEditingController ownerNameController;
  final TextEditingController ownerEmailController;
  final String? phoneNumber;

  const MerchantStepOwner({
    super.key,
    required this.ownerNameController,
    required this.ownerEmailController,
    this.phoneNumber,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Step 1: Owner Details', style: AllGoTypography.heading2),
        const SizedBox(height: 6),
        Text('Official identity of the business owner or legal representative.', style: AllGoTypography.subtitle),
        const SizedBox(height: 24),
        AllGoTextField(
          label: 'Owner Full Name',
          hint: 'e.g. Ramesh Kumar',
          controller: ownerNameController,
        ),
        const SizedBox(height: 16),
        AllGoTextField(
          label: 'Registered Mobile Number',
          hint: phoneNumber ?? '+919876543210',
          enabled: false,
        ),
        const SizedBox(height: 16),
        AllGoTextField(
          label: 'Contact Email Address',
          hint: 'ramesh.kumar@anjappar.com',
          controller: ownerEmailController,
          keyboardType: TextInputType.emailAddress,
        ),
      ],
    );
  }
}

class MerchantStepBusiness extends StatelessWidget {
  final TextEditingController businessNameController;
  final TextEditingController descriptionController;
  final String selectedMerchantType;
  final ValueChanged<String> onTypeChanged;

  const MerchantStepBusiness({
    super.key,
    required this.businessNameController,
    required this.descriptionController,
    required this.selectedMerchantType,
    required this.onTypeChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Step 2: Business Information', style: AllGoTypography.heading2),
        const SizedBox(height: 6),
        Text('Commercial trade name and operational vertical.', style: AllGoTypography.subtitle),
        const SizedBox(height: 24),
        AllGoTextField(
          label: 'Commercial Business Name',
          hint: 'Anjappar Chettinad Restaurant',
          controller: businessNameController,
        ),
        const SizedBox(height: 16),
        Text('Business Category', style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: AllGoColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AllGoColors.divider),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: selectedMerchantType,
              isExpanded: true,
              items: const [
                DropdownMenuItem(value: 'RESTAURANT', child: Text('Restaurant (Food Delivery)')),
                DropdownMenuItem(value: 'CLOUD_KITCHEN', child: Text('Cloud Kitchen / Virtual Brand')),
                DropdownMenuItem(value: 'GROCERY_STORE', child: Text('Grocery Retail Store')),
                DropdownMenuItem(value: 'DARK_STORE', child: Text('Dark Store (15-min Quick Commerce)')),
                DropdownMenuItem(value: 'HOME_SELLER', child: Text('Home Food Seller')),
              ],
              onChanged: (val) {
                if (val != null) onTypeChanged(val);
              },
            ),
          ),
        ),
        const SizedBox(height: 16),
        AllGoTextField(
          label: 'Brief Description / Specialty',
          hint: 'Authentic Chettinad non-veg specialties & seeraga samba biryani',
          controller: descriptionController,
          maxLines: 2,
        ),
      ],
    );
  }
}

class MerchantStepLocation extends StatelessWidget {
  final TextEditingController outletNameController;
  final TextEditingController address1Controller;
  final TextEditingController address2Controller;
  final TextEditingController postalCodeController;
  final TextEditingController cityController;

  const MerchantStepLocation({
    super.key,
    required this.outletNameController,
    required this.address1Controller,
    required this.address2Controller,
    required this.postalCodeController,
    required this.cityController,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Step 3: Outlet Location', style: AllGoTypography.heading2),
        const SizedBox(height: 6),
        Text('Physical store address for customer ordering and driver dispatch.', style: AllGoTypography.subtitle),
        const SizedBox(height: 24),
        AllGoTextField(
          label: 'Outlet / Branch Name',
          hint: 'Anjappar - T. Nagar Main Branch',
          controller: outletNameController,
        ),
        const SizedBox(height: 16),
        AllGoTextField(
          label: 'Door / Building / Street Address',
          hint: '7/2, Usman Road, T. Nagar',
          controller: address1Controller,
        ),
        const SizedBox(height: 16),
        AllGoTextField(
          label: 'Area / Landmark (Optional)',
          hint: 'Opposite Ranganathan Street Entrance',
          controller: address2Controller,
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: AllGoTextField(
                label: 'City',
                hint: 'Chennai',
                controller: cityController,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: AllGoTextField(
                label: 'PIN Code',
                hint: '600017',
                controller: postalCodeController,
                keyboardType: TextInputType.number,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
