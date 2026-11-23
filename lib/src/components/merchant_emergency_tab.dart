import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantEmergencyTab extends StatelessWidget {
  final bool isTemporarilyClosed;
  final String? temporaryClosureReason;
  final DateTime? temporaryClosureUntil;
  final bool isTogglingEmergency;
  final void Function(bool close, String? reason, int? hours) onToggleEmergency;

  const MerchantEmergencyTab({
    super.key,
    required this.isTemporarilyClosed,
    this.temporaryClosureReason,
    this.temporaryClosureUntil,
    required this.isTogglingEmergency,
    required this.onToggleEmergency,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isTemporarilyClosed ? Colors.red.shade50 : Colors.green.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isTemporarilyClosed ? Colors.red : Colors.green),
            ),
            child: Row(
              children: [
                Icon(isTemporarilyClosed ? Icons.warning : Icons.check_circle, color: isTemporarilyClosed ? Colors.red : Colors.green, size: 28),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isTemporarilyClosed ? 'STORE PAUSED / TEMPORARILY CLOSED' : 'STORE OPERATING NORMALLY',
                        style: AllGoTypography.caption.copyWith(fontWeight: FontWeight.bold, color: isTemporarilyClosed ? Colors.red : Colors.green),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        isTemporarilyClosed
                            ? (temporaryClosureReason ?? 'Emergency pause active')
                            : 'Accepting orders according to regular operating hours schedule.',
                        style: AllGoTypography.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          if (isTemporarilyClosed) ...[
            AllGoButton(
              label: 'Resume Operations (Open Store)',
              isLoading: isTogglingEmergency,
              onPressed: () => onToggleEmergency(false, null, null),
            ),
          ] else ...[
            Text('Quick Emergency Pause', style: AllGoTypography.heading3),
            const SizedBox(height: 12),
            AllGoButton(
              label: 'Pause for 1 Hour (Kitchen Rush)',
              variant: AllGoButtonVariant.outlined,
              isLoading: isTogglingEmergency,
              onPressed: () => onToggleEmergency(true, 'Kitchen overload rush', 1),
            ),
            const SizedBox(height: 10),
            AllGoButton(
              label: 'Pause for Rest of Today',
              variant: AllGoButtonVariant.outlined,
              isLoading: isTogglingEmergency,
              onPressed: () => onToggleEmergency(true, 'Closed for today', 12),
            ),
          ],
        ],
      ),
    );
  }
}
