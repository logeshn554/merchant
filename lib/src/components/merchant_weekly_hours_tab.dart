import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantWeeklyHoursTab extends StatelessWidget {
  final List<OperatingHourIntervalModel> intervals;
  final bool isSaving;
  final VoidCallback onSave;
  final void Function(int day) onToggleDay;
  final void Function(int day) onAddInterval;
  final void Function(int index) onRemoveInterval;
  final void Function(int index, OperatingHourIntervalModel updated) onIntervalUpdated;

  const MerchantWeeklyHoursTab({
    super.key,
    required this.intervals,
    required this.isSaving,
    required this.onSave,
    required this.onToggleDay,
    required this.onAddInterval,
    required this.onRemoveInterval,
    required this.onIntervalUpdated,
  });

  static const List<String> _dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  Future<void> _pickTime(BuildContext context, int index, bool isStart) async {
    final currentStr = isStart ? intervals[index].openTime : intervals[index].closeTime;
    final parts = currentStr.split(':');
    final initialTime = TimeOfDay(hour: int.tryParse(parts[0]) ?? 9, minute: int.tryParse(parts[1]) ?? 0);

    final picked = await showTimePicker(context: context, initialTime: initialTime);
    if (picked != null) {
      final formatted = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      final old = intervals[index];
      onIntervalUpdated(
        index,
        OperatingHourIntervalModel(
          id: old.id,
          outletId: old.outletId,
          dayOfWeek: old.dayOfWeek,
          openTime: isStart ? formatted : old.openTime,
          closeTime: isStart ? old.closeTime : formatted,
          slotIndex: old.slotIndex,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: 7,
            itemBuilder: (context, day) {
              final dayIntervals = <MapEntry<int, OperatingHourIntervalModel>>[];
              for (int i = 0; i < intervals.length; i++) {
                if (intervals[i].dayOfWeek == day) {
                  dayIntervals.add(MapEntry(i, intervals[i]));
                }
              }

              return Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AllGoColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AllGoColors.divider),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_dayNames[day], style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.bold)),
                        Row(
                          children: [
                            Text(dayIntervals.isEmpty ? 'Closed' : 'Open', style: AllGoTypography.caption),
                            const SizedBox(width: 8),
                            Switch(
                              value: dayIntervals.isNotEmpty,
                              activeColor: const Color(0xFF6200EA),
                              onChanged: (_) => onToggleDay(day),
                            ),
                          ],
                        ),
                      ],
                    ),
                    if (dayIntervals.isNotEmpty) ...[
                      const Divider(height: 16),
                      ...dayIntervals.map((entry) {
                        final idx = entry.key;
                        final interval = entry.value;
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              Expanded(
                                child: InkWell(
                                  onTap: () => _pickTime(context, idx, true),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                    decoration: BoxDecoration(
                                      border: Border.all(color: AllGoColors.divider),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(interval.openTime, style: AllGoTypography.bodyMedium),
                                  ),
                                ),
                              ),
                              const Padding(
                                padding: EdgeInsets.symmetric(horizontal: 8),
                                child: Text('to'),
                              ),
                              Expanded(
                                child: InkWell(
                                  onTap: () => _pickTime(context, idx, false),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                    decoration: BoxDecoration(
                                      border: Border.all(color: AllGoColors.divider),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(interval.closeTime, style: AllGoTypography.bodyMedium),
                                  ),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.remove_circle_outline, color: AllGoColors.error, size: 20),
                                onPressed: () => onRemoveInterval(idx),
                              ),
                            ],
                          ),
                        );
                      }),
                      TextButton.icon(
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Add Time Slot'),
                        onPressed: () => onAddInterval(day),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        ),
        Container(
          padding: const EdgeInsets.all(16),
          color: AllGoColors.surface,
          child: AllGoButton(
            label: 'Save Weekly Hours',
            isLoading: isSaving,
            onPressed: onSave,
          ),
        ),
      ],
    );
  }
}
