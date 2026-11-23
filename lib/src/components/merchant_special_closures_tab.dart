import 'package:flutter/material.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';

class MerchantSpecialClosuresTab extends StatelessWidget {
  final List<SpecialClosureModel> specialClosures;
  final void Function(String start, String end, String reason) onAddClosure;
  final void Function(String closureId) onDeleteClosure;

  const MerchantSpecialClosuresTab({
    super.key,
    required this.specialClosures,
    required this.onAddClosure,
    required this.onDeleteClosure,
  });

  void _showAddModal(BuildContext context) {
    final reasonController = TextEditingController();
    DateTime selectedDate = DateTime.now().add(const Duration(days: 1));

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            top: 20,
            left: 20,
            right: 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Schedule Special Closure', style: AllGoTypography.heading3),
              const SizedBox(height: 16),
              AllGoTextField(
                label: 'Reason (e.g. Diwali Holiday, Renovation)',
                controller: reasonController,
              ),
              const SizedBox(height: 16),
              ListTile(
                title: const Text('Closure Date'),
                subtitle: Text('${selectedDate.toLocal()}'.split(' ')[0]),
                trailing: const Icon(Icons.calendar_today),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: ctx,
                    initialDate: selectedDate,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (picked != null) setModalState(() => selectedDate = picked);
                },
              ),
              const SizedBox(height: 20),
              AllGoButton(
                label: 'Confirm Closure',
                onPressed: () {
                  Navigator.pop(ctx);
                  onAddClosure(
                    '${selectedDate.toIso8601String().split('T')[0]}T00:00:00.000Z',
                    '${selectedDate.toIso8601String().split('T')[0]}T23:59:59.000Z',
                    reasonController.text.trim().isEmpty ? 'Holiday' : reasonController.text.trim(),
                  );
                },
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: AllGoButton(
            label: 'Add Holiday / Special Closure',
            icon: Icons.add,
            onPressed: () => _showAddModal(context),
          ),
        ),
        Expanded(
          child: specialClosures.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.event_available, size: 48, color: AllGoColors.textTertiary),
                      const SizedBox(height: 12),
                      Text('No special closures scheduled', style: AllGoTypography.subtitle),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: specialClosures.length,
                  itemBuilder: (context, index) {
                    final closure = specialClosures[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        leading: const Icon(Icons.event_busy, color: Colors.orange),
                        title: Text(closure.reason ?? 'Special Closure', style: AllGoTypography.bodyMedium.copyWith(fontWeight: FontWeight.bold)),
                        subtitle: Text(
                          closure.isFullDay
                              ? '${closure.startDate.split('T')[0]} (Full Day)'
                              : '${closure.startDate} to ${closure.endDate}',
                          style: AllGoTypography.caption,
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete_outline, color: AllGoColors.error),
                          onPressed: () => onDeleteClosure(closure.id ?? ''),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
