import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantRegistrationBottomBar extends StatelessWidget {
  final int currentStep;
  final bool isSubmitting;
  final VoidCallback onBack;
  final VoidCallback onContinue;

  const MerchantRegistrationBottomBar({
    super.key,
    required this.currentStep,
    required this.isSubmitting,
    required this.onBack,
    required this.onContinue,
  });

  @override
  Widget build(BuildContext context) {
    final isLastStep = currentStep == 6;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: const BoxDecoration(
        color: AllGoColors.surface,
        border: Border(top: BorderSide(color: AllGoColors.divider, width: 0.5)),
      ),
      child: Row(
        children: [
          if (currentStep > 0)
            Expanded(
              child: OutlinedButton(
                onPressed: isSubmitting ? null : onBack,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Back', style: TextStyle(color: Color(0xFF6200EA))),
              ),
            ),
          if (currentStep > 0) const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: AllGoButton(
              label: isLastStep ? 'Submit Application' : 'Continue',
              isLoading: isSubmitting,
              onPressed: onContinue,
            ),
          ),
        ],
      ),
    );
  }
}
