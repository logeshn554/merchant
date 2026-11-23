import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:allgo_mobile_shared/allgo_mobile_shared.dart';
import '../components/merchant_weekly_hours_tab.dart';
import '../components/merchant_special_closures_tab.dart';
import '../components/merchant_emergency_tab.dart';

class OperatingHoursScreen extends ConsumerStatefulWidget {
  final String outletId;
  final String? outletName;

  const OperatingHoursScreen({
    super.key,
    required this.outletId,
    this.outletName,
  });

  @override
  ConsumerState<OperatingHoursScreen> createState() => _OperatingHoursScreenState();
}

class _OperatingHoursScreenState extends ConsumerState<OperatingHoursScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isTogglingEmergency = false;
  String? _errorMessage;

  List<OperatingHourIntervalModel> _intervals = [];
  List<SpecialClosureModel> _specialClosures = [];
  bool _isTemporarilyClosed = false;
  String? _temporaryClosureReason;
  DateTime? _temporaryClosureUntil;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadAllData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAllData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final client = ref.read(apiClientProvider);
      final results = await Future.wait([
        client.getOutletOperatingHours(widget.outletId),
        client.getOutletSpecialClosures(widget.outletId),
      ]);

      final intervals = results[0] as List<OperatingHourIntervalModel>;
      final closures = results[1] as List<SpecialClosureModel>;

      if (mounted) {
        setState(() {
          _intervals = List.from(intervals);
          _specialClosures = List.from(closures);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _saveOperatingHours() async {
    setState(() => _isSaving = true);
    try {
      final client = ref.read(apiClientProvider);
      final payload = _intervals.map((i) => i.toJson()).toList();
      final updated = await client.setOutletOperatingHours(widget.outletId, payload);
      if (mounted) {
        setState(() => _intervals = List.from(updated));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Weekly operating hours saved successfully!'),
            backgroundColor: AllGoColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save hours: $e'), backgroundColor: AllGoColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _toggleEmergencyClosure(bool close, String? reason, int? hours) async {
    setState(() => _isTogglingEmergency = true);
    try {
      final client = ref.read(apiClientProvider);
      final until = hours != null ? DateTime.now().add(Duration(hours: hours)).toIso8601String() : null;
      await client.toggleOutletTemporaryClosure(
        widget.outletId,
        isClosed: close,
        reason: reason,
        closureUntil: until,
      );
      if (mounted) {
        setState(() {
          _isTemporarilyClosed = close;
          _temporaryClosureReason = reason;
          _temporaryClosureUntil = hours != null ? DateTime.now().add(Duration(hours: hours)) : null;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to toggle emergency state: $e'), backgroundColor: AllGoColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isTogglingEmergency = false);
    }
  }

  Future<void> _addSpecialClosure(String start, String end, String reason) async {
    try {
      final client = ref.read(apiClientProvider);
      final newClosure = await client.addOutletSpecialClosure(widget.outletId, {
        'startDate': start,
        'endDate': end,
        'isFullDay': true,
        'reason': reason,
      });
      if (mounted) {
        setState(() => _specialClosures.add(newClosure));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to add special closure: $e'), backgroundColor: AllGoColors.error),
        );
      }
    }
  }

  Future<void> _deleteSpecialClosure(String closureId) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.deleteOutletSpecialClosure(widget.outletId, closureId);
      if (mounted) {
        setState(() => _specialClosures.removeWhere((c) => c.id == closureId));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to delete closure: $e'), backgroundColor: AllGoColors.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AllGoColors.background,
      appBar: AppBar(
        title: const Text('Store Operating Hours'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: const Color(0xFF6200EA),
          unselectedLabelColor: AllGoColors.textSecondary,
          indicatorColor: const Color(0xFF6200EA),
          tabs: const [
            Tab(text: 'Weekly Schedule'),
            Tab(text: 'Special Closures'),
            Tab(text: 'Emergency Pause'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('Error: $_errorMessage', style: const TextStyle(color: AllGoColors.error)),
                      const SizedBox(height: 12),
                      AllGoButton(label: 'Retry', onPressed: _loadAllData),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    MerchantWeeklyHoursTab(
                      intervals: _intervals,
                      isSaving: _isSaving,
                      onSave: _saveOperatingHours,
                      onToggleDay: (day) {
                        setState(() {
                          final exists = _intervals.where((i) => i.dayOfWeek == day).toList();
                          if (exists.isNotEmpty) {
                            _intervals.removeWhere((i) => i.dayOfWeek == day);
                          } else {
                            _intervals.add(OperatingHourIntervalModel(
                              dayOfWeek: day,
                              openTime: '09:00',
                              closeTime: '22:00',
                            ));
                          }
                        });
                      },
                      onAddInterval: (day) {
                        setState(() {
                          _intervals.add(OperatingHourIntervalModel(
                            dayOfWeek: day,
                            openTime: '18:00',
                            closeTime: '23:00',
                          ));
                        });
                      },
                      onRemoveInterval: (idx) => setState(() => _intervals.removeAt(idx)),
                      onIntervalUpdated: (idx, updated) => setState(() => _intervals[idx] = updated),
                    ),
                    MerchantSpecialClosuresTab(
                      specialClosures: _specialClosures,
                      onAddClosure: _addSpecialClosure,
                      onDeleteClosure: _deleteSpecialClosure,
                    ),
                    MerchantEmergencyTab(
                      isTemporarilyClosed: _isTemporarilyClosed,
                      temporaryClosureReason: _temporaryClosureReason,
                      temporaryClosureUntil: _temporaryClosureUntil,
                      isTogglingEmergency: _isTogglingEmergency,
                      onToggleEmergency: _toggleEmergencyClosure,
                    ),
                  ],
                ),
    );
  }
}
