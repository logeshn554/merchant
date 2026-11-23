import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantRegistrationStepIndicator extends StatelessWidget {
  final int currentStep;
  final ValueChanged<int> onStepTapped;

  const MerchantRegistrationStepIndicator({
    super.key,
    required this.currentStep,
    required this.onStepTapped,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: AllGoColors.surface,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(7, (i) {
          final isDone = i < currentStep;
          final isCurrent = i == currentStep;
          return GestureDetector(
            onTap: isDone ? () => onStepTapped(i) : null,
            child: CircleAvatar(
              radius: 14,
              backgroundColor: isDone
                  ? AllGoColors.success
                  : isCurrent
                      ? const Color(0xFF6200EA)
                      : AllGoColors.divider,
              child: isDone
                  ? const Icon(Icons.check, size: 14, color: Colors.white)
                  : Text(
                      '${i + 1}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isCurrent ? Colors.white : AllGoColors.textTertiary,
                      ),
                    ),
            ),
          );
        }),
      ),
    );
  }
}
